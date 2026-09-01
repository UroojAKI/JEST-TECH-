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
  ) {
    const premiumAmount = new Decimal(premiumAmountStr);

    if (premiumAmount.lte(0)) {
      throw new BadRequestException('Premium amount must be greater than zero');
    }

    const plan = await this.prisma.commissionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestException('Active Commission Plan not found');
    }

    let rules: {
      agentPercent?: number;
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
    if (!Number.isFinite(agentPercent) || agentPercent < 0 || agentPercent > 100) {
      throw new BadRequestException('Commission Plan agentPercent must be between 0 and 100');
    }

    // Validate the earning recipient before calculating or writing money records.
    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, status: true },
    });

    if (!agent || agent.status !== 'ACTIVE') {
      throw new BadRequestException('Commission recipient is not an active user');
    }

    const commissionsData: Prisma.CommissionCreateManyInput[] = [];
    const agentCommissionAmt = premiumAmount
      .mul(new Decimal(agentPercent))
      .div(100);

    commissionsData.push({
      policyId,
      userId: agentId,
      roleTier: 'AGENT',
      amount: agentCommissionAmt,
      status: 'ACCRUED',
      planId,
    });

    if (rules.overrides && Array.isArray(rules.overrides)) {
      for (const override of rules.overrides) {
        const percent = Number(override.percent);
        if (!override.userId || !override.roleTier) {
          throw new BadRequestException('Every commission override requires roleTier and userId');
        }
        if (!Number.isFinite(percent) || percent < 0 || percent > 100) {
          throw new BadRequestException(
            `Invalid commission override percentage for ${override.userId}`,
          );
        }

        const recipient = await this.prisma.user.findUnique({
          where: { id: override.userId },
          select: { id: true, status: true },
        });

        if (!recipient || recipient.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Commission override recipient ${override.userId} is not an active user`,
          );
        }

        const overrideAmt = premiumAmount
          .mul(new Decimal(percent))
          .div(100);

        commissionsData.push({
          policyId,
          userId: override.userId,
          roleTier: override.roleTier,
          amount: overrideAmt,
          status: 'ACCRUED',
          planId,
        });
      }
    }

    // PostgreSQL advisory transaction lock makes the read/check/write sequence
    // safe when policy issuance is retried concurrently.
    const result = await this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${policyId}))`;

      const existing = await tx.commission.findMany({
        where: { policyId },
        orderBy: { createdAt: 'asc' },
      });

      if (existing.length > 0) {
        this.logger.warn(
          `Commission accrual skipped for policy ${policyId}: commissions already exist`,
        );
        return existing;
      }

      await tx.commission.createMany({
        data: commissionsData,
      });

      return tx.commission.findMany({
        where: { policyId },
        orderBy: { createdAt: 'asc' },
      });
    });

    this.logger.log(
      `Accrued ${result.length} commissions for policy ${policyId}`,
    );
    return result;
  }

  /**
   * Called when a policy is fully paid. Moves ACCRUED commissions to REALIZED.
   */
  async realizeCommissions(policyId: string) {
    const result = await this.prisma.commission.updateMany({
      where: {
        policyId,
        status: 'ACCRUED',
      },
      data: {
        status: 'REALIZED',
      },
    });

    this.logger.log(
      `Realized ${result.count} commissions for policy ${policyId}`,
    );
    return result.count;
  }
}
