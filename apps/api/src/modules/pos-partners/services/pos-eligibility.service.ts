import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PosPartnerStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PosPartnerRepository } from '../repositories/pos-partner.repository';

@Injectable()
export class PosEligibilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly repository: PosPartnerRepository,
  ) {}

  /**
   * Retrieves all active POS partners mapped to the requested insurer within the company scope.
   */
  async getEligiblePartners(params: {
    companyId: string;
    insurerId?: string;
    insurerName?: string;
    productType?: string;
  }) {
    return this.repository.findEligible(params);
  }

  /**
   * Authoritative backend validation of a POS partner's eligibility for policy issuance.
   * Throws domain-specific BadRequestException if partner or mapping fails any rule.
   */
  async assertEligibleForIssuance(params: {
    posPartnerId: string;
    companyId: string;
    policyInsurerId?: string;
    policyInsurerName?: string;
    productType?: string;
  }): Promise<{
    partner: any;
    mapping: any;
    insurer: any;
  }> {
    const partner = await this.prisma.posPartner.findUnique({
      where: { id: params.posPartnerId },
      include: {
        insurerMappings: {
          include: { insurer: true },
        },
      },
    });

    if (!partner || partner.deletedAt) {
      throw new NotFoundException({
        code: 'POS_PARTNER_NOT_FOUND',
        message: `POS Partner '${params.posPartnerId}' not found`,
      });
    }

    // 1. Tenant Scoping
    if (partner.companyId !== params.companyId) {
      throw new ForbiddenException({
        code: 'POS_PARTNER_CROSS_TENANT',
        message: 'POS Partner does not belong to your company tenant',
      });
    }

    // 2. Partner Active Status (DEC-04)
    if (partner.status !== PosPartnerStatus.ACTIVE) {
      throw new BadRequestException({
        code: 'POS_PARTNER_INACTIVE',
        message: `POS Partner '${partner.name}' (${partner.posCode}) is ${partner.status} and cannot be attributed to new policies`,
      });
    }

    // 3. Partner Effective Dates
    const now = new Date();
    if (partner.effectiveFrom && partner.effectiveFrom > now) {
      throw new BadRequestException({
        code: 'POS_PARTNER_NOT_EFFECTIVE',
        message: `POS Partner registration is not effective yet (starts ${partner.effectiveFrom.toISOString().slice(0, 10)})`,
      });
    }
    if (partner.effectiveUntil && partner.effectiveUntil < now) {
      throw new BadRequestException({
        code: 'POS_PARTNER_EXPIRED',
        message: `POS Partner registration expired on ${partner.effectiveUntil.toISOString().slice(0, 10)}`,
      });
    }

    // 4. Insurer Mapping Check (DEC-03)
    const mappings = (partner as any).insurerMappings || [];
    const mapping = mappings.find((candidate: any) =>
      candidate.isActive &&
      candidate.insurer?.isActive &&
      (!params.policyInsurerId ||
        candidate.insurerId === params.policyInsurerId ||
        candidate.insurer?.code?.toLowerCase() === params.policyInsurerId.toLowerCase()) &&
      (!params.policyInsurerName ||
        candidate.insurer?.name?.trim().toLowerCase() === params.policyInsurerName.trim().toLowerCase() ||
        candidate.insurer?.code?.trim().toLowerCase() === params.policyInsurerName.trim().toLowerCase()),
    );

    // A POS partner may be attributed without an insurer mapping. If a matching
    // mapping exists, validate and snapshot it; otherwise retain the POS identity
    // and leave insurer-side identifiers empty instead of blocking issuance.
    if (!mapping) {
      return { partner, mapping: null, insurer: null };
    }

    if (mapping.effectiveFrom && mapping.effectiveFrom > now) {
      throw new BadRequestException({
        code: 'POS_MAPPING_NOT_EFFECTIVE',
        message: 'The Agent POS insurer registration is not effective yet',
      });
    }
    if (mapping.effectiveUntil && mapping.effectiveUntil < now) {
      throw new BadRequestException({
        code: 'POS_MAPPING_EXPIRED',
        message: 'The Agent POS insurer registration has expired',
      });
    }

    // A matching insurer mapping is optional. When present, it is validated
    // against the selected quotation insurer before its identifiers are snapshotted.
    const mappedInsurer = mapping.insurer;
    if (!mappedInsurer || !mappedInsurer.isActive) {
      throw new BadRequestException({
        code: 'POS_INSURER_INACTIVE',
        message: 'The insurer mapped to this POS partner is inactive',
      });
    }

    return {
      partner,
      mapping,
      insurer: mappedInsurer,
    };
  }
}
