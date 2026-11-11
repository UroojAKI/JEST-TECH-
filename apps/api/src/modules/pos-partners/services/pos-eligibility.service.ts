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
    if (!mapping) {
      throw new BadRequestException({
        code: 'POS_INSURER_MAPPING_MISSING',
        message: `POS Partner '${partner.name}' has no active mapping for the policy insurer`,
      });
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

    // The selected mapping already matches the policy insurer and is effective.
    const mappedInsurer = mapping.insurer;
    if (!mappedInsurer || !mappedInsurer.isActive) {
      throw new BadRequestException({
        code: 'POS_INSURER_INACTIVE',
        message: 'The insurer mapped to this POS partner is inactive',
      });
    }

    if (params.policyInsurerId) {
      const match =
        mappedInsurer.id === params.policyInsurerId ||
        mappedInsurer.code.toLowerCase() === params.policyInsurerId.toLowerCase();
      if (!match) {
        throw new BadRequestException({
          code: 'POS_INSURER_MAPPING_MISMATCH',
          message: `POS Partner '${partner.name}' is associated with insurer '${mappedInsurer.name}', not the policy insurer '${params.policyInsurerName || params.policyInsurerId}'`,
        });
      }
    } else if (params.policyInsurerName) {
      const match =
        mappedInsurer.name.trim().toLowerCase() === params.policyInsurerName.trim().toLowerCase() ||
        mappedInsurer.code.trim().toLowerCase() === params.policyInsurerName.trim().toLowerCase();
      if (!match) {
        throw new BadRequestException({
          code: 'POS_INSURER_MAPPING_MISMATCH',
          message: `POS Partner '${partner.name}' is associated with insurer '${mappedInsurer.name}', not the policy insurer '${params.policyInsurerName}'`,
        });
      }
    }

    return {
      partner,
      mapping,
      insurer: mappedInsurer,
    };
  }
}
