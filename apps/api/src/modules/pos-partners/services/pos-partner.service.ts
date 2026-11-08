import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  AuditAction,
  PosPartnerStatus,
  PosPartnerType,
  PosVerificationStatus,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PosPartnerRepository } from '../repositories/pos-partner.repository';
import { CreatePosPartnerDto } from '../dto/create-pos-partner.dto';
import { UpdatePosPartnerDto } from '../dto/update-pos-partner.dto';
import { PosPartnerQueryDto } from '../dto/pos-partner-query.dto';
import { UpdatePosStatusDto } from '../dto/pos-status-update.dto';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class PosPartnerService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PosPartnerRepository,
  ) {}

  /**
   * Registers a new POS Partner (DEC-01 to DEC-04).
   * - Validates partner type (INDIVIDUAL | CORPORATE)
   * - Enforces unique POS Code per agency tenant
   * - Transactionally associates with exactly ONE insurer
   * - Automatically activates the master record (status: ACTIVE)
   * - Records audit history
   */
  async register(dto: CreatePosPartnerDto, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;

    // 1. Resolve & validate POS Code
    let posCode = dto.posCode?.trim().toUpperCase();
    if (!posCode) {
      const yearMonth = new Date().toISOString().slice(0, 7).replace('-', '');
      const count = await this.prisma.posPartner.count({
        where: { companyId },
      });
      posCode = `POS-${yearMonth}-${String(count + 1).padStart(4, '0')}`;
    }

    const existingCode = await this.repository.findByCode(posCode, companyId);
    if (existingCode) {
      throw new ConflictException({
        code: 'POS_CODE_EXISTS',
        message: `POS Partner with code '${posCode}' already exists in your company`,
      });
    }

    // 2. Validate Insurer existence and active status
    const insurer = await this.prisma.insurer.findUnique({
      where: { id: dto.insurerId },
    });
    if (!insurer) {
      throw new NotFoundException(`Insurer with ID '${dto.insurerId}' not found`);
    }
    if (!insurer.isActive) {
      throw new BadRequestException({
        code: 'POS_INSURER_INACTIVE',
        message: `Insurer '${insurer.name}' is inactive and cannot be mapped to a POS partner`,
      });
    }

    // Validate commercial agreement insurer if explicitly provided
    if (dto.initialAgreement?.insurerId && dto.initialAgreement.insurerId !== insurer.id) {
      throw new BadRequestException({
        code: 'POS_AGREEMENT_INSURER_MISMATCH',
        message: `Commercial agreement insurer must match the POS partner's associated insurer`,
      });
    }

    // 3. Transactional registration of PosPartner + PosInsurerMapping + Optional PosCommissionAgreement
    const partner = await this.prisma.$transaction(async (tx) => {
      const rawMobile = dto.mobile || dto.phone || '';
      const created = await tx.posPartner.create({
        data: {
          companyId,
          posCode,
          partnerType: dto.partnerType,
          name: dto.name.trim(),
          displayName: dto.displayName?.trim() || dto.name.trim(),
          mobile: rawMobile.trim(),
          email: dto.email?.trim().toLowerCase() || null,
          registrationNumber: dto.registrationNumber?.trim() || null,
          panNumberEncrypted: dto.panNumber?.trim().toUpperCase() || null,
          status: PosPartnerStatus.ACTIVE, // Automatic activation (DEC-04)
          verificationStatus: PosVerificationStatus.PENDING,
          effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
          effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
          address: dto.address ? (dto.address as any) : undefined,
          createdById: user.id,
          insurerMapping: {
            create: {
              companyId,
              insurerId: insurer.id,
              insurerPartnerCode: dto.insurerPartnerCode?.trim() || null,
              insurerPospId: dto.insurerPospId?.trim() || null,
              effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
              effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
              isActive: true,
            },
          },
        },
        include: {
          insurerMapping: {
            include: { insurer: true },
          },
        },
      });

      if (dto.initialAgreement) {
        const agreement = await tx.posCommissionAgreement.create({
          data: {
            companyId,
            posPartnerId: created.id,
            insurerId: insurer.id,
            productType: dto.initialAgreement.productType.toUpperCase(),
            insuranceProductId: dto.initialAgreement.insuranceProductId || null,
            commissionType: dto.initialAgreement.commissionType,
            commissionRate:
              dto.initialAgreement.commissionRate !== undefined
                ? new Prisma.Decimal(dto.initialAgreement.commissionRate)
                : null,
            fixedAmount:
              dto.initialAgreement.fixedAmount !== undefined
                ? new Prisma.Decimal(dto.initialAgreement.fixedAmount)
                : null,
            effectiveFrom: dto.initialAgreement.effectiveFrom
              ? new Date(dto.initialAgreement.effectiveFrom)
              : new Date(),
            effectiveUntil: dto.initialAgreement.effectiveUntil
              ? new Date(dto.initialAgreement.effectiveUntil)
              : null,
            approvalStatus: 'APPROVED',
            approvedById: user.id,
          },
          include: { insurer: true },
        });
        (created as any).commissionAgreements = [agreement];
      }

      return created;
    });

    // 4. Record Audit Event
    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.CREATE,
        entity: 'POS_PARTNER',
        entityType: 'PosPartner',
        entityId: partner.id,
        userId: user.id,
        performedById: user.id,
        module: 'POS_PARTNER',
        metadata: {
          companyId,
          event: 'POS_PARTNER_CREATED',
          posCode: partner.posCode,
          partnerType: partner.partnerType,
          name: partner.name,
          insurerId: insurer.id,
          insurerName: insurer.name,
        },
      },
    }).catch(() => null);

    if (dto.initialAgreement && (partner as any).commissionAgreements?.[0]) {
      const agreement = (partner as any).commissionAgreements[0];
      await this.prisma.auditLog.create({
        data: {
          action: AuditAction.CREATE,
          entity: 'POS_COMMISSION_AGREEMENT',
          entityType: 'PosCommissionAgreement',
          entityId: agreement.id,
          userId: user.id,
          performedById: user.id,
          module: 'POS_PARTNER',
          metadata: {
            companyId,
            event: 'POS_COMMISSION_AGREEMENT_CREATED',
            posPartnerId: partner.id,
            productType: dto.initialAgreement.productType,
            commissionType: dto.initialAgreement.commissionType,
            commissionRate: dto.initialAgreement.commissionRate,
            fixedAmount: dto.initialAgreement.fixedAmount,
          },
        },
      }).catch(() => null);
    }

    return partner;
  }

  async findAll(user: RequestUser, query: PosPartnerQueryDto) {
    const companyId = user.companyId || (user as any).organizationId;
    return this.repository.findMany(companyId, query);
  }

  async findOne(id: string, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const partner = await this.repository.findById(id, companyId);
    if (!partner) {
      throw new NotFoundException(`POS Partner with ID '${id}' not found`);
    }
    return partner;
  }

  async update(id: string, dto: UpdatePosPartnerDto, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const existing = await this.repository.findById(id, companyId);
    if (!existing) {
      throw new NotFoundException(`POS Partner with ID '${id}' not found`);
    }

    const data: any = {};
    if (dto.name !== undefined) data.name = dto.name.trim();
    if (dto.displayName !== undefined) data.displayName = dto.displayName?.trim() || null;
    if (dto.mobile !== undefined) data.mobile = dto.mobile.trim();
    if (dto.email !== undefined) data.email = dto.email?.trim().toLowerCase() || null;
    if (dto.registrationNumber !== undefined) data.registrationNumber = dto.registrationNumber?.trim() || null;
    if (dto.panNumber !== undefined) data.panNumberEncrypted = dto.panNumber?.trim().toUpperCase() || null;
    if (dto.address !== undefined) data.address = dto.address as any;
    if (dto.effectiveFrom !== undefined) data.effectiveFrom = dto.effectiveFrom ? new Date(dto.effectiveFrom) : null;
    if (dto.effectiveUntil !== undefined) data.effectiveUntil = dto.effectiveUntil ? new Date(dto.effectiveUntil) : null;
    data.updatedById = user.id;

    const updated = await this.repository.update(id, data);

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entity: 'POS_PARTNER',
        entityType: 'PosPartner',
        entityId: id,
        userId: user.id,
        performedById: user.id,
        module: 'POS_PARTNER',
        metadata: {
          companyId,
          event: 'POS_PARTNER_UPDATED',
          posCode: updated.posCode,
          updatedFields: Object.keys(data),
        },
      },
    }).catch(() => null);

    return updated;
  }

  async updateStatus(id: string, dto: UpdatePosStatusDto, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const existing = await this.repository.findById(id, companyId);
    if (!existing) {
      throw new NotFoundException(`POS Partner with ID '${id}' not found`);
    }

    const data: any = { updatedById: user.id };
    let eventName = 'POS_PARTNER_UPDATED';

    if (dto.status) {
      data.status = dto.status;
      if (dto.status === PosPartnerStatus.SUSPENDED) {
        eventName = 'POS_PARTNER_SUSPENDED';
      } else if (dto.status === PosPartnerStatus.ACTIVE) {
        eventName = 'POS_PARTNER_REACTIVATED';
      }
    }

    if (dto.verificationStatus) {
      data.verificationStatus = dto.verificationStatus;
    }

    const updated = await this.repository.update(id, data);

    await this.prisma.auditLog.create({
      data: {
        action: AuditAction.UPDATE,
        entity: 'POS_PARTNER',
        entityType: 'PosPartner',
        entityId: id,
        userId: user.id,
        performedById: user.id,
        module: 'POS_PARTNER',
        metadata: {
          companyId,
          event: eventName,
          posCode: updated.posCode,
          oldStatus: existing.status,
          newStatus: updated.status,
          oldVerificationStatus: existing.verificationStatus,
          newVerificationStatus: updated.verificationStatus,
          reason: dto.reason || 'Status updated by administrator',
        },
      },
    }).catch(() => null);

    return updated;
  }

  async getKpis(user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    return this.repository.countKpis(companyId);
  }

  async getHistory(id: string, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    const partner = await this.repository.findById(id, companyId);
    if (!partner) {
      throw new NotFoundException(`POS Partner with ID '${id}' not found`);
    }

    return this.prisma.auditLog.findMany({
      where: {
        entityType: { in: ['PosPartner', 'PosInsurerMapping', 'PosCommissionAgreement', 'PosPartnerDocument'] },
        OR: [
          { entityId: id },
          {
            metadata: {
              path: ['posPartnerId'],
              equals: id,
            },
          },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  /**
   * Ensures an approved Internal / House POS partner exists for direct agency business (DEC-02).
   */
  async ensureHousePosPartner(companyId: string, createdById: string, targetInsurerId?: string) {
    const houseCode = 'POS-HOUSE-DIRECT';
    let house = await this.repository.findByCode(houseCode, companyId);
    if (!house) {
      // Find first active insurer if target not specified
      let insurerId = targetInsurerId;
      if (!insurerId) {
        const firstInsurer = await this.prisma.insurer.findFirst({
          where: { isActive: true },
          orderBy: { createdAt: 'asc' },
        });
        insurerId = firstInsurer?.id;
      }

      if (!insurerId) return null;

      house = await this.prisma.posPartner.create({
        data: {
          companyId,
          posCode: houseCode,
          partnerType: PosPartnerType.CORPORATE,
          name: 'Direct Agency House POS',
          displayName: 'House POS (Direct Sales)',
          mobile: '9800000000',
          email: 'direct@agency.internal',
          status: PosPartnerStatus.ACTIVE,
          verificationStatus: PosVerificationStatus.VERIFIED,
          createdById,
          insurerMapping: {
            create: {
              companyId,
              insurerId,
              isActive: true,
            },
          },
        },
        include: { insurerMapping: { include: { insurer: true } } },
      });
    }
    return house;
  }
}
