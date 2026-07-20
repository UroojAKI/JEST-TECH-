import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CommissionEngineService {
  private readonly logger = new Logger(CommissionEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Calculates and accrues commissions for a policy based on the agent's commission plan.
   * Also calculates hierarchical manager overrides.
   */
  async accrueCommissions(
    policyId: string,
    agentId: string,
    premiumAmountStr: string,
    planId: string,
  ) {
    const premiumAmount = new Decimal(premiumAmountStr);

    const plan = await this.prisma.commissionPlan.findUnique({
      where: { id: planId },
    });

    if (!plan || !plan.isActive) {
      throw new BadRequestException('Active Commission Plan not found');
    }

    let rules;
    try {
      rules = JSON.parse(plan.rules);
    } catch (e) {
      throw new Error('Invalid Commission Plan rules format');
    }

    // Expected JSON structure:
    // {
    //   "agentPercent": 10,
    //   "overrides": [
    //     { "roleTier": "BRANCH_MANAGER", "percent": 2, "userId": "user-2" },
    //     { "roleTier": "ZONAL_MANAGER", "percent": 0.5, "userId": "user-3" }
    //   ]
    // }

    const agentCommissionAmt = premiumAmount
      .mul(new Decimal(rules.agentPercent))
      .div(100);

    const commissionsData = [];

    // Agent Commission
    commissionsData.push({
      policyId,
      userId: agentId,
      roleTier: 'AGENT',
      amount: agentCommissionAmt,
      status: 'ACCRUED',
      planId,
    });

    // Manager Overrides
    if (rules.overrides && Array.isArray(rules.overrides)) {
      for (const override of rules.overrides) {
        const overrideAmt = premiumAmount
          .mul(new Decimal(override.percent))
          .div(100);
        commissionsData.push({
          policyId,
          userId: override.userId, // The specific manager
          roleTier: override.roleTier,
          amount: overrideAmt,
          status: 'ACCRUED',
          planId,
        });
      }
    }

    // Save Accruals
    await this.prisma.commission.createMany({
      data: commissionsData,
    });

    this.logger.log(
      `Accrued ${commissionsData.length} commissions for policy ${policyId}`,
    );
    return commissionsData;
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
