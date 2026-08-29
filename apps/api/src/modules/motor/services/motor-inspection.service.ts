import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { InspectionStatus, InspectionConductedBy } from '@prisma/client';

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
  'front' | 'back' | 'left' | 'right' | 'windshield' | 'chassis' | 'odometer';

@Injectable()
export class MotorInspectionService {
  private readonly logger = new Logger(MotorInspectionService.name);

  constructor(private readonly prisma: PrismaService) {}

  private generateCode(): string {
    const ts = Date.now().toString(36).toUpperCase();
    const rand = Math.random().toString(36).slice(2, 5).toUpperCase();
    return `INS-${ts}-${rand}`;
  }

  async createInspection(dto: CreateInspectionDto) {
    const quotation = await this.prisma.quotation.findUnique({
      where: { id: dto.quotationId },
    });
    if (!quotation)
      throw new NotFoundException(`Quotation ${dto.quotationId} not found`);

    const existing = await this.prisma.motorInspection.findUnique({
      where: { quotationId: dto.quotationId },
    });
    if (existing) return existing;

    const inspection = await this.prisma.motorInspection.create({
      data: {
        inspectionCode: this.generateCode(),
        quotationId: dto.quotationId,
        status: InspectionStatus.PENDING,
        conductedByType: dto.conductedByType,
        inspectorName: dto.inspectorName,
        inspectorPhone: dto.inspectorPhone,
        inspectorEmail: dto.inspectorEmail,
        inspectorCompany: dto.inspectorCompany,
        inspectorEmployeeId: dto.inspectorEmployeeId,
        inspectorUserId: dto.inspectorUserId,
        inspectionDate: dto.inspectionDate
          ? new Date(dto.inspectionDate)
          : null,
        inspectionTime: dto.inspectionTime,
        createdById: dto.createdById,
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
  ) {
    if (!storageKey?.trim())
      throw new BadRequestException(
        'A real storage key is required for an inspection photo',
      );

    const fieldMap: Record<InspectionPhotoType, string> = {
      front: 'frontImageKey',
      back: 'backImageKey',
      left: 'leftImageKey',
      right: 'rightImageKey',
      windshield: 'windshieldImageKey',
      chassis: 'chassisImageKey',
      odometer: 'odometerImageKey',
    };

    if (!fieldMap[photoType])
      throw new BadRequestException(
        `Unsupported inspection photo type: ${photoType}`,
      );

    const inspection = await this.prisma.motorInspection.update({
      where: { id: inspectionId },
      data: {
        [fieldMap[photoType]]: storageKey,
        status: InspectionStatus.IN_PROGRESS,
      },
    });

    this.logger.log(
      `Photo [${photoType}] recorded for inspection ${inspectionId}`,
    );
    return inspection;
  }

  async completeInspection(
    inspectionId: string,
    approverId: string,
    pdfKey?: string,
    pdfUrl?: string,
  ) {
    if (!approverId) {
      throw new ForbiddenException(
        'Approver identity is required to complete or sign off on an inspection.',
      );
    }

    const inspection = await this.prisma.motorInspection.findUnique({
      where: { id: inspectionId },
    });
    if (!inspection)
      throw new NotFoundException(`Inspection ${inspectionId} not found`);

    const quotation = await this.prisma.quotation.findUnique({
      where: { id: inspection.quotationId },
    });

    if (quotation && quotation.createdById === approverId) {
      throw new ForbiddenException(
        'Segregation of duties violation: The user who created the quotation cannot approve its inspection. An underwriter or operations officer must sign off.',
      );
    }

    const requiredPhotos = [
      'frontImageKey',
      'backImageKey',
      'leftImageKey',
      'rightImageKey',
      'windshieldImageKey',
      'chassisImageKey',
      'odometerImageKey',
    ];

    const missing = requiredPhotos.filter(
      (photoField) => !(inspection as any)[photoField],
    );

    if (missing.length > 0) {
      throw new BadRequestException(
        `Cannot complete inspection. Missing photos: ${missing.map((p) => p.replace('ImageKey', '')).join(', ')}`,
      );
    }

    const meta = (quotation?.motorMetadata as Record<string, any>) || {};

    const completed = await this.prisma.$transaction(async (tx) => {
      const updatedInspection = await tx.motorInspection.update({
        where: { id: inspectionId },
        data: {
          status: InspectionStatus.COMPLETED,
          completedAt: new Date(),
          reportPdfKey: pdfKey,
          reportPdfUrl: pdfUrl,
        },
      });

      await tx.quotation.update({
        where: { id: inspection.quotationId },
        data: {
          workflowState: 'INSPECTION_COMPLETED',
          motorMetadata: {
            ...meta,
            workflowStatus: 'READY_FOR_PROPOSAL',
          },
        },
      });

      return updatedInspection;
    });

    this.logger.log(
      `Inspection ${inspectionId} completed atomically with approver ${approverId}`,
    );
    return completed;
  }

  async rejectInspection(inspectionId: string, reason: string) {
    return this.prisma.motorInspection.update({
      where: { id: inspectionId },
      data: {
        status: InspectionStatus.REJECTED,
        rejectedAt: new Date(),
        rejectionReason: reason,
      },
    });
  }

  async getInspection(quotationId: string) {
    return this.prisma.motorInspection.findUnique({ where: { quotationId } });
  }

  getMissingPhotos(inspection: any): InspectionPhotoType[] {
    const photoKeys: Array<[string, InspectionPhotoType]> = [
      ['frontImageKey', 'front'],
      ['backImageKey', 'back'],
      ['leftImageKey', 'left'],
      ['rightImageKey', 'right'],
      ['windshieldImageKey', 'windshield'],
      ['chassisImageKey', 'chassis'],
      ['odometerImageKey', 'odometer'],
    ];
    return photoKeys
      .filter(([key]) => !inspection[key])
      .map(([, type]) => type);
  }
}
