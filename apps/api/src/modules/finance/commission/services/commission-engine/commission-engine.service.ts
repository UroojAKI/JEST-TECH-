import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CommissionEngineService {
  private readonly logger = new Logger(CommissionEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates and accrues commissions for a policy based on the agent's commission plan.
   * The operation is idempotent per policy: a retry cannot create a second commission set.
   */
  async accrueCommissions(
    policyId: string,
    agentId: string,
    premiumAmountStr: string,
    planId: string,
    actorCompanyId?: string,
  ) {
    const premiumAmount = new Decimal(premiumAmountStr);

    if (premiumAmount.lte(0)) {
      throw new BadRequestException('Premium amount must be greater than zero');
    }

    const plan = await this.prisma.commissionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'COMMISSION_CONFIG_PENDING',
        missingEntity: 'COMMISSION_CONFIG',
        planId,
        message: `No active commission plan found for planId=${planId}. Commission posting is blocked until an approved commission agreement is configured (Decision D-02, Scenario T-05).`,
      });
    }

    let rules: {
      agentPercent?: number;
      maxAgentPercent?: number;
      maxTotalPercent?: number;
      overrides?: Array<{
        roleTier?: string;
        percent?: number;
        userId?: string;
      }>;
    };

    try {
      rules = JSON.parse(plan.rules);
    } catch {
      throw new BadRequestException('Invalid Commission Plan rules format');
    }

    const agentPercent = Number(rules.agentPercent);
    if (
      !Number.isFinite(agentPercent) ||
      agentPercent < 0 ||
      agentPercent > 100
    ) {
      throw new BadRequestException(
        'Commission Plan agentPercent must be between 0 and 100',
      );
    }

    // Commission caps are plan-specific configuration, not universal hardcoded rates.
    // Missing caps must be approved in the active plan before posting money.
    const maxAgentPercent = Number(rules.maxAgentPercent);
    const maxTotalPercent = Number(rules.maxTotalPercent);
    if (
      !Number.isFinite(maxAgentPercent) ||
      maxAgentPercent < 0 ||
      maxAgentPercent > 100 ||
      !Number.isFinite(maxTotalPercent) ||
      maxTotalPercent < 0 ||
      maxTotalPercent > 100
    ) {
      throw new BadRequestException({
        statusCode: 400,
        error: 'Bad Request',
        errorCode: 'COMMISSION_CONFIG_PENDING',
        missingEntity: 'COMMISSION_CAPS',
        planId,
        message: 'The active commission plan must contain approved maxAgentPercent and maxTotalPercent limits before commission accrual.',
      });
    }
    if (agentPercent > maxAgentPercent) {
      throw new BadRequestException(
        `Agent commission percentage (${agentPercent}%) exceeds the active plan limit of ${maxAgentPercent}%`,
      );
    }

    let totalCommissionPercent = agentPercent;
    if (rules.overrides && Array.isArray(rules.overrides)) {
      for (const override of rules.overrides) {
        const percent = Number(override.percent);
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
          throw new BadRequestException(`Invalid commission override percentage for ${override.userId || 'unknown recipient'}`);
        }
        totalCommissionPercent += percent;
      }
    }

    if (totalCommissionPercent > maxTotalPercent) {
      throw new BadRequestException(
        `Total commission percentage (${totalCommissionPercent}%) exceeds the active plan limit of ${maxTotalPercent}%`,
      );
    }

    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      include: { quotation: true },
    });
    if (!policy || !policy.companyId) {
      throw new BadRequestException(
        'Commission accrual requires an existing policy with a company/tenant assignment.',
      );
    }
    if (actorCompanyId && policy.companyId !== actorCompanyId) {
      throw new BadRequestException('Commission accrual is restricted to the current organization.');
    }
    const policyCompanyId = policy.companyId;
    const quotation = policy.quotation;
    if (!quotation) {
      throw new BadRequestException(
        'Commission accrual requires the policy-linked quotation for an authoritative commissionable base.',
      );
    }
    const totalPremium = new Decimal(quotation.totalPremium);
    const taxAmount = new Decimal(quotation.gstAmount || 0);
    const commissionableBase = totalPremium.sub(taxAmount);
    if (commissionableBase.lte(0)) {
      throw new BadRequestException(
        'The policy-linked quotation has no positive premium base after tax is removed.',
      );
    }

    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, status: true, companyId: true },
    });
    if (!agent || agent.status !== 'ACTIVE') {
      throw new BadRequestException('Commission recipient is not an active user');
    }
    if (agent.companyId !== policyCompanyId) {
      throw new BadRequestException('Commission recipient and policy must belong to the same organization');
    }

    const commissionsData: Prisma.CommissionCreateManyInput[] = [];
    const agentCommissionAmt = commissionableBase
      .mul(new Decimal(agentPercent))
      .div(100);

    commissionsData.push({
      policyId,
      userId: agentId,
      roleTier: 'AGENT',
      amount: agentCommissionAmt,
      status: 'ACCRUED',
      planId,
      companyId: policyCompanyId,
    });

    if (rules.overrides && Array.isArray(rules.overrides)) {
      for (const override of rules.overrides) {
        const percent = Number(override.percent);
        if (!override.userId || !override.roleTier) {
          throw new BadRequestException(
            'Every commission override requires roleTier and userId',
          );
        }
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
          throw new BadRequestException(
            `Invalid commission override percentage for ${override.userId}`,
          );
        }

        const recipient = await this.prisma.user.findUnique({
          where: { id: override.userId },
          select: { id: true, status: true, companyId: true },
        });

        if (!recipient || recipient.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Commission override recipient ${override.userId} is not an active user`,
          );
        }
        if (recipient.companyId !== policyCompanyId) {
          throw new BadRequestException(
            `Commission override recipient ${override.userId} belongs to a different organization`,
          );
        }

        const overrideAmt = commissionableBase.mul(new Decimal(percent)).div(100);

        commissionsData.push({
          policyId,
          userId: override.userId,
          roleTier: override.roleTier,
          amount: overrideAmt,
          status: 'ACCRUED',
          planId,
          companyId: policyCompanyId,
        });
      }
    }

    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${policyId}))`;

      const existing = await tx.commission.findMany({
        where: { policyId, companyId: policyCompanyId },
        orderBy: { createdAt: 'asc' },
      });

      if (existing.length > 0) {
        this.logger.warn(
          `Commission accrual skipped for policy ${policyId}: commissions already exist`,
        );
        return existing;
      }

      await tx.commission.createMany({ data: commissionsData });

      return tx.commission.findMany({
        where: { policyId, companyId: policyCompanyId },
        orderBy: { createdAt: 'asc' },
      });
    });

    this.logger.log(
      `Accrued ${result.length} commissions for policy ${policyId}`,
    );
    return result;
  }

  /**
   * Called when a policy is fully paid. Only approved commissions can become realized.
   */
  async realizeCommissions(policyId: string, companyId?: string) {
    const policy = await this.prisma.policy.findUnique({
      where: { id: policyId },
      select: { companyId: true, paymentStatus: true, deletedAt: true },
    });
    if (!policy || policy.deletedAt || !policy.companyId) {
      throw new BadRequestException('Commission realization requires an existing active policy.');
    }
    const effectiveCompanyId = companyId || policy.companyId;
    if (policy.companyId !== effectiveCompanyId) {
      throw new BadRequestException('Commission realization is restricted to the current organization.');
    }
    if (policy.paymentStatus !== 'PAID') {
      throw new BadRequestException('Commissions cannot be realized until the linked policy payment status is PAID.');
    }

    const result = await this.prisma.commission.updateMany({
      where: {
        policyId,
        companyId: effectiveCompanyId,
        status: 'APPROVED',
      },
      data: {
        status: 'REALIZED',
      },
    });

    this.logger.log(
      `Realized ${result.count} approved commissions for policy ${policyId}`,
    );
    return result.count;
  }
}
