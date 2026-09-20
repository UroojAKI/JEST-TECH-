import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InspectionStatus, InspectionConductedBy, RoleType, Prisma } from '@prisma/client';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';

export interface CreateInspectionDto {
  quotationId: string;
  conductedByType?: InspectionConductedBy;
  inspectorName?: string;
  inspectorPhone?: string;
  inspectorEmail?: string;
  inspectorCompany?: string;
  inspectorEmployeeId?: string;
  inspectorUserId?: string;
  inspectionDate?: string;
  inspectionTime?: string;
  createdById?: string;
}

export type InspectionPhotoType =
  | 'front'
  | 'back'
  | 'left'
  | 'right'
  | 'windshield'
  | 'chassis'
  | 'odometer';

export const MANDATORY_PHOTO_FIELDS: Array<{ key: string; type: InspectionPhotoType }> = [
  { key: 'frontImageKey', type: 'front' },
  { key: 'backImageKey', type: 'back' },
  { key: 'leftImageKey', type: 'left' },
  { key: 'rightImageKey', type: 'right' },
  { key: 'windshieldImageKey', type: 'windshield' },
  { key: 'chassisImageKey', type: 'chassis' },
  { key: 'odometerImageKey', type: 'odometer' },
];

@Injectable()
export class MotorInspectionService {
  private readonly logger = new Logger(MotorInspectionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly numberingEngine: NumberingEngineService,
  ) {}

  /**
   * Enforces the authoritative state-machine transition rules.
   * Prohibits arbitrary status overwrites.
   */
  validateTransition(
    current: InspectionStatus,
    action: string,
    actorRole?: RoleType,
  ): InspectionStatus {
    switch (current) {
      case InspectionStatus.REQUIRED:
        if (action === 'SCHEDULE') return InspectionStatus.PENDING;
        if (action === 'UPLOAD_PHOTO') return InspectionStatus.IN_PROGRESS;
        if (action === 'WAIVE') {
          this.assertBackOfficeOrAdmin(actorRole);
          return InspectionStatus.WAIVED;
        }
        break;

      case InspectionStatus.PENDING:
        if (action === 'UPLOAD_PHOTO') return InspectionStatus.IN_PROGRESS;
        if (action === 'WAIVE') {
          this.assertBackOfficeOrAdmin(actorRole);
          return InspectionStatus.WAIVED;
        }
        break;

      case InspectionStatus.IN_PROGRESS:
        if (action === 'UPLOAD_PHOTO') return InspectionStatus.IN_PROGRESS;
        if (action === 'SUBMIT_FOR_REVIEW') return InspectionStatus.SUBMITTED_FOR_REVIEW;
        break;

      case InspectionStatus.SUBMITTED_FOR_REVIEW:
        if (action === 'APPROVE') {
          this.assertBackOfficeOrAdmin(actorRole);
          return InspectionStatus.COMPLETED;
        }
        if (action === 'REJECT') {
          this.assertBackOfficeOrAdmin(actorRole);
          return InspectionStatus.REJECTED;
        }
        if (action === 'WAIVE') {
          this.assertBackOfficeOrAdmin(actorRole);
          return InspectionStatus.WAIVED;
        }
        break;

      case InspectionStatus.REJECTED:
        if (action === 'REWORK' || action === 'UPLOAD_PHOTO') return InspectionStatus.IN_PROGRESS;
        break;

      case InspectionStatus.COMPLETED:
      case InspectionStatus.WAIVED:
      case InspectionStatus.EXPIRED:
      case InspectionStatus.NOT_REQUIRED:
        throw new ConflictException(
          `Cannot perform action '${action}' on inspection in terminal state '${current}'`,
        );

      default:
        break;
    }

    throw new BadRequestException(
      `Invalid state transition: Cannot perform action '${action}' when inspection is in '${current}' status`,
    );
  }

  private assertBackOfficeOrAdmin(role?: RoleType) {
    if (role !== RoleType.ADMIN && role !== RoleType.BACK_OFFICE) {
      throw new ForbiddenException(
        'Action restricted: Only Back Office and Admin users are permitted to perform underwriting sign-off, rejection, or waiver.',
      );
    }
  }

  private async generateCode(tx?: Prisma.TransactionClient): Promise<string> {
    return this.numberingEngine.generateNext('INSPECTION', tx);
  }

  async createInspection(dto: CreateInspectionDto, actor?: ActorContext, txClient?: Prisma.TransactionClient) {
    const client = txClient || this.prisma;

    const quotation = await client.quotation.findUnique({
      where: { id: dto.quotationId },
    });
    if (!quotation)
      throw new NotFoundException(`Quotation ${dto.quotationId} not found`);

    if (actor && quotation.companyId !== actor.companyId) {
      throw new ForbiddenException('Tenant isolation violation: Quotation belongs to another company');
    }

    const existing = await client.motorInspection.findUnique({
      where: { quotationId: dto.quotationId },
    });
    if (existing) return existing;

    const inspectionCode = await this.generateCode(txClient);
    const inspection = await client.motorInspection.create({
      data: {
        inspectionCode,
        companyId: quotation.companyId,
        quotationId: dto.quotationId,
        status: InspectionStatus.REQUIRED,
        conductedByType: dto.conductedByType,
        inspectorName: dto.inspectorName,
        inspectorPhone: dto.inspectorPhone,
        inspectorEmail: dto.inspectorEmail,
        inspectorCompany: dto.inspectorCompany || 'JEST Inspection Network',
        inspectorEmployeeId: dto.inspectorEmployeeId,
        inspectorUserId: dto.inspectorUserId,
        inspectionDate: dto.inspectionDate ? new Date(dto.inspectionDate) : null,
        inspectionTime: dto.inspectionTime,
        createdById: dto.createdById || actor?.userId,
      },
    });

    await client.motorInspectionHistory.create({
      data: {
        inspectionId: inspection.id,
        fromStatus: InspectionStatus.NOT_REQUIRED,
        toStatus: InspectionStatus.REQUIRED,
        action: 'CREATE',
        actorId: actor?.userId || dto.createdById || 'SYSTEM',
        actorRole: (actor?.role as string) || 'SYSTEM',
        reason: 'Inspection aggregate initialized',
      },
    });

    this.logger.log(
      `Inspection ${inspection.inspectionCode} created for quotation ${dto.quotationId}`,
    );
    return inspection;
  }

  async recordPhoto(
    inspectionId: string,
    photoType: InspectionPhotoType,
    storageKey: string,
    actor?: ActorContext,
  ) {
    if (!storageKey?.trim()) {
      throw new BadRequestException('A valid storage key is required for an inspection photo');
    }

    const fieldMap: Record<InspectionPhotoType, string> = {
      front: 'frontImageKey',
      back: 'backImageKey',
      left: 'leftImageKey',
      right: 'rightImageKey',
      windshield: 'windshieldImageKey',
      chassis: 'chassisImageKey',
      odometer: 'odometerImageKey',
    };

    if (!fieldMap[photoType]) {
      throw new BadRequestException(`Unsupported inspection photo type: ${photoType}`);
    }

    const inspection = await this.prisma.motorInspection.findUnique({
      where: { id: inspectionId },
    });
    if (!inspection) {
      throw new NotFoundException(`Inspection ${inspectionId} not found`);
    }

    if (actor && inspection.companyId !== actor.companyId) {
      throw new ForbiddenException('Tenant isolation violation: Inspection belongs to another company');
    }

    const nextStatus = this.validateTransition(
      inspection.status,
      'UPLOAD_PHOTO',
      actor?.role,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.motorInspection.update({
        where: { id: inspectionId },
        data: {
          [fieldMap[photoType]]: storageKey,
          status: nextStatus,
        },
      });

      await tx.motorInspectionHistory.create({
        data: {
          inspectionId,
          fromStatus: inspection.status,
          toStatus: nextStatus,
          action: 'UPLOAD_PHOTO',
          actorId: actor?.userId || 'SYSTEM',
          actorRole: (actor?.role as string) || 'SYSTEM',
          reason: `Uploaded photo: ${photoType}`,
        },
      });

      this.logger.log(`Photo [${photoType}] recorded for inspection ${inspectionId}`);
      return updated;
    });
  }

  async submitForReview(inspectionId: string, actor: ActorContext) {
    const inspection = await this.prisma.motorInspection.findUnique({
      where: { id: inspectionId },
      include: { quotation: true },
    });
    if (!inspection) {
      throw new NotFoundException(`Inspection ${inspectionId} not found`);
    }

    if (actor && inspection.companyId !== actor.companyId) {
      throw new ForbiddenException('Tenant isolation violation: Inspection belongs to another company');
    }

    const nextStatus = this.validateTransition(
      inspection.status,
      'SUBMIT_FOR_REVIEW',
      actor?.role,
    );

    // Verify all 7 mandatory photos exist
    const missing = this.getMissingPhotos(inspection);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Cannot submit inspection for review. Missing mandatory photographs: ${missing.join(', ')}`,
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.motorInspection.update({
        where: { id: inspectionId },
        data: {
          status: nextStatus,
        },
      });

      await tx.motorInspectionHistory.create({
        data: {
          inspectionId,
          fromStatus: inspection.status,
          toStatus: nextStatus,
          action: 'SUBMIT_FOR_REVIEW',
          actorId: actor.userId,
          actorRole: actor.role as string,
          reason: 'All 7 mandatory photos verified. Submitted for underwriting sign-off.',
        },
      });

      await tx.quotation.update({
        where: { id: inspection.quotationId },
        data: {
          workflowState: 'INSPECTION_REQUIRED',
          motorMetadata: {
            ...((inspection.quotation?.motorMetadata as any) || {}),
            inspectionStatus: 'SUBMITTED_FOR_REVIEW',
          },
        },
      });

      this.logger.log(
        `Inspection ${inspectionId} submitted for review by ${actor.role} (${actor.userId})`,
      );
      return updated;
    });
  }

  async completeInspection(
    inspectionId: string,
    approverId: string,
    pdfKey?: string,
    pdfUrl?: string,
    actor?: ActorContext,
  ) {
    return this.approveInspection(inspectionId, actor || ({ userId: approverId, role: RoleType.BACK_OFFICE } as ActorContext), pdfKey, pdfUrl);
  }

  async approveInspection(
    inspectionId: string,
    actor: ActorContext,
    pdfKey?: string,
    pdfUrl?: string,
  ) {
    this.assertBackOfficeOrAdmin(actor.role);

    const inspection = await this.prisma.motorInspection.findUnique({
      where: { id: inspectionId },
      include: { quotation: true },
    });
    if (!inspection) {
      throw new NotFoundException(`Inspection ${inspectionId} not found`);
    }

    if (inspection.companyId !== actor.companyId) {
      throw new ForbiddenException('Tenant isolation violation: Inspection belongs to another company');
    }

    let quotation: any = inspection.quotation;
    if (!quotation && inspection.quotationId) {
      quotation = await this.prisma.quotation.findUnique({
        where: { id: inspection.quotationId },
      });
    }

    // Segregation of duties: quotation creator cannot approve its inspection
    if (quotation && quotation.createdById === actor.userId) {
      throw new ForbiddenException(
        'Segregation of duties violation: The user who created the quotation cannot approve its inspection. An underwriter or operations officer must sign off.',
      );
    }

    const nextStatus = this.validateTransition(
      inspection.status,
      'APPROVE',
      actor.role,
    );

    const missing = this.getMissingPhotos(inspection);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Cannot approve inspection. Missing mandatory photographs: ${missing.join(', ')}`,
      );
    }

    const meta = (inspection.quotation?.motorMetadata as Record<string, any>) || {};

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.motorInspection.update({
        where: { id: inspectionId },
        data: {
          status: nextStatus,
          completedAt: new Date(),
          reportPdfKey: pdfKey,
          reportPdfUrl: pdfUrl,
        },
      });

      await tx.motorInspectionHistory.create({
        data: {
          inspectionId,
          fromStatus: inspection.status,
          toStatus: nextStatus,
          action: 'APPROVE',
          actorId: actor.userId,
          actorRole: actor.role as string,
          reason: 'Underwriting sign-off approved',
        },
      });

      await tx.quotation.update({
        where: { id: inspection.quotationId },
        data: {
          workflowState: 'INSPECTION_COMPLETED',
          motorMetadata: {
            ...meta,
            inspectionStatus: 'COMPLETED',
            workflowStatus: 'READY_FOR_PROPOSAL',
          },
        },
      });

      this.logger.log(
        `Inspection ${inspectionId} approved by ${actor.role} (${actor.userId})`,
      );
      return updated;
    });
  }

  async rejectInspection(inspectionId: string, reason: string, actor?: ActorContext) {
    if (!reason?.trim()) {
      throw new BadRequestException('A non-empty rejection reason is required');
    }
    if (actor) {
      this.assertBackOfficeOrAdmin(actor.role);
    }

    const inspection = await this.prisma.motorInspection.findUnique({
      where: { id: inspectionId },
      include: { quotation: true },
    });
    if (!inspection) {
      throw new NotFoundException(`Inspection ${inspectionId} not found`);
    }

    if (actor && inspection.companyId !== actor.companyId) {
      throw new ForbiddenException('Tenant isolation violation: Inspection belongs to another company');
    }

    const nextStatus = this.validateTransition(
      inspection.status,
      'REJECT',
      actor?.role,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.motorInspection.update({
        where: { id: inspectionId },
        data: {
          status: nextStatus,
          rejectedAt: new Date(),
          rejectionReason: reason.trim(),
        },
      });

      await tx.motorInspectionHistory.create({
        data: {
          inspectionId,
          fromStatus: inspection.status,
          toStatus: nextStatus,
          action: 'REJECT',
          actorId: actor?.userId || 'SYSTEM',
          actorRole: (actor?.role as string) || 'SYSTEM',
          reason: reason.trim(),
        },
      });

      await tx.quotation.update({
        where: { id: inspection.quotationId },
        data: {
          workflowState: 'INSPECTION_REQUIRED',
          motorMetadata: {
            ...((inspection.quotation?.motorMetadata as any) || {}),
            inspectionStatus: 'REJECTED',
            rejectionReason: reason.trim(),
          },
        },
      });

      this.logger.log(`Inspection ${inspectionId} rejected: ${reason}`);
      return updated;
    });
  }

  async waiveInspection(inspectionId: string, reason: string, actor: ActorContext) {
    if (!reason?.trim()) {
      throw new BadRequestException('A non-empty waiver reason is required for underwriting override');
    }
    this.assertBackOfficeOrAdmin(actor.role);

    const inspection = await this.prisma.motorInspection.findUnique({
      where: { id: inspectionId },
      include: { quotation: true },
    });
    if (!inspection) {
      throw new NotFoundException(`Inspection ${inspectionId} not found`);
    }

    if (inspection.companyId !== actor.companyId) {
      throw new ForbiddenException('Tenant isolation violation: Inspection belongs to another company');
    }

    const nextStatus = this.validateTransition(
      inspection.status,
      'WAIVE',
      actor.role,
    );

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.motorInspection.update({
        where: { id: inspectionId },
        data: {
          status: nextStatus,
          waivedById: actor.userId,
          waivedAt: new Date(),
          waiverReason: reason.trim(),
        },
      });

      await tx.motorInspectionHistory.create({
        data: {
          inspectionId,
          fromStatus: inspection.status,
          toStatus: nextStatus,
          action: 'WAIVE',
          actorId: actor.userId,
          actorRole: actor.role as string,
          reason: reason.trim(),
        },
      });

      await tx.quotation.update({
        where: { id: inspection.quotationId },
        data: {
          workflowState: 'INSPECTION_COMPLETED',
          motorMetadata: {
            ...((inspection.quotation?.motorMetadata as any) || {}),
            inspectionStatus: 'WAIVED',
            waiverReason: reason.trim(),
            workflowStatus: 'READY_FOR_PROPOSAL',
          },
        },
      });

      this.logger.log(
        `Inspection ${inspectionId} waived by ${actor.role} (${actor.userId}): ${reason}`,
      );
      return updated;
    });
  }

  async getInspection(quotationId: string, actor?: ActorContext) {
    const inspection = await this.prisma.motorInspection.findUnique({
      where: { quotationId },
      include: { history: { orderBy: { createdAt: 'desc' } } },
    });
    if (!inspection) return null;

    if (actor && inspection.companyId !== actor.companyId) {
      throw new ForbiddenException('Tenant isolation violation: Inspection belongs to another company');
    }

    const missingPhotos = this.getMissingPhotos(inspection);
    const canSubmit =
      missingPhotos.length === 0 &&
      (inspection.status === InspectionStatus.IN_PROGRESS ||
        inspection.status === InspectionStatus.REJECTED);

    return {
      ...inspection,
      missingPhotos,
      canSubmit,
    };
  }

  getMissingPhotos(inspection: any): InspectionPhotoType[] {
    return MANDATORY_PHOTO_FIELDS.filter(
      ({ key }) => !inspection[key],
    ).map(({ type }) => type);
  }
}
