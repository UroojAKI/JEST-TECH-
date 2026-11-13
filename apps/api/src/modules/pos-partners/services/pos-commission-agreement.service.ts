import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { CreatePosCommissionAgreementDto } from '../dto/pos-commission-agreement.dto';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class PosCommissionAgreementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Records commercial terms agreed between the agency/insurer and POS partner (DEC-05).
   * Note: No automatic commission calculation or payout occurs in this release.
   */
  async createAgreement(
    posPartnerId: string,
    dto: CreatePosCommissionAgreementDto,
    user: RequestUser,
  ) {
    const companyId = user.companyId || (user as any).organizationId;
    const partner = await this.prisma.posPartner.findFirst({
      where: { id: posPartnerId, companyId, deletedAt: null },
      include: { insurerMappings: true },
    });
    if (!partner) {
      throw new NotFoundException(`POS Partner '${posPartnerId}' not found`);
    }

    // Verify insurer matches mapped insurer
    const mappedInsurerIds = (partner.insurerMappings || []).map((mapping: any) => mapping.insurerId);
    if (mappedInsurerIds.length && !mappedInsurerIds.includes(dto.insurerId)) {
      throw new BadRequestException(
        'Add an Agent POS mapping for this insurer before recording its commission agreement.',
      );
    }

    const insurer = await this.prisma.insurer.findUnique({
      where: { id: dto.insurerId },
    });
    if (!insurer) {
      throw new NotFoundException(`Insurer '${dto.insurerId}' not found`);
    }

    const agreement = await this.prisma.posCommissionAgreement.create({
      data: {
        companyId,
        posPartnerId,
        insurerId: dto.insurerId,
        productType: dto.productType.toUpperCase(),
        insuranceProductId: dto.insuranceProductId || null,
        commissionType: dto.commissionType,
        commissionRate: dto.commissionRate !== undefined ? new Prisma.Decimal(dto.commissionRate) : null,
        fixedAmount: dto.fixedAmount !== undefined ? new Prisma.Decimal(dto.fixedAmount) : null,
        effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
        effectiveUntil: dto.effectiveUntil ? new Date(dto.effectiveUntil) : null,
        approvalStatus: 'APPROVED',
        approvedById: user.id,
      },
      include: { insurer: true },
    });

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
          posPartnerId,
          productType: dto.productType,
          commissionType: dto.commissionType,
          commissionRate: dto.commissionRate,
          fixedAmount: dto.fixedAmount,
        },
      },
    }).catch(() => null);

    return agreement;
  }

  async listAgreements(posPartnerId: string, companyId: string) {
    const partner = await this.prisma.posPartner.findFirst({
      where: { id: posPartnerId, companyId, deletedAt: null },
    });
    if (!partner) {
      throw new NotFoundException(`POS Partner '${posPartnerId}' not found`);
    }

    return this.prisma.posCommissionAgreement.findMany({
      where: { posPartnerId },
      include: { insurer: { select: { id: true, name: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    });
  }
}
