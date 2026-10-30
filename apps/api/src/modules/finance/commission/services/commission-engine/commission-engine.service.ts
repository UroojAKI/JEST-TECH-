import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Prisma, AuditAction } from '@prisma/client';
import type { RequestUser } from '../../../../auth/decorators/current-user.decorator';
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

    // IRDAI Statutory Regulatory Cap Validation
    // Statutory Motor Own-Damage cap: 15.0%, Statutory Total Combined cap: 20.0%
    const IRDAI_STATUTORY_MAX_AGENT_CAP = 15.0;
    const IRDAI_STATUTORY_MAX_TOTAL_CAP = 20.0;

    if (agentPercent > IRDAI_STATUTORY_MAX_AGENT_CAP) {
      throw new BadRequestException(
        `Agent commission percentage (${agentPercent}%) exceeds IRDAI statutory maximum ceiling cap of ${IRDAI_STATUTORY_MAX_AGENT_CAP}%`,
      );
    }

    let totalCommissionPercent = agentPercent;
    if (rules.overrides && Array.isArray(rules.overrides)) {
      for (const override of rules.overrides) {
        totalCommissionPercent += Number(override.percent || 0);
      }
    }

    if (totalCommissionPercent > IRDAI_STATUTORY_MAX_TOTAL_CAP) {
      throw new BadRequestException(
        `Total combined commission percentage (${totalCommissionPercent}%) exceeds IRDAI statutory maximum total ceiling of ${IRDAI_STATUTORY_MAX_TOTAL_CAP}%`,
      );
    }

    const agent = await this.prisma.user.findUnique({
      where: { id: agentId },
      select: { id: true, status: true },
    });

    if (!agent || agent.status !== 'ACTIVE') {
      throw new BadRequestException(
        'Commission recipient is not an active user',
      );
    }

    // Authoritative Server-side Net Commission Base (Excluding GST)
    // IRDAI Statutory Mandate: Commissions can only be calculated on net premium (base + addons - discounts), NEVER on GST
    let commissionableBase = premiumAmount;
    if (typeof this.prisma?.policy?.findUnique === 'function') {
      const policy = await this.prisma.policy.findUnique({
        where: { id: policyId },
        include: { quotation: true },
      });

      if (policy?.quotation) {
        const q = policy.quotation;
        const total = new Decimal(q.totalPremium || policy.premiumAmount);
        const gst = new Decimal(q.gstAmount || 0);
        const netWithoutGst = total.sub(gst);
        if (netWithoutGst.gt(0)) {
          commissionableBase = netWithoutGst;
        }
      }
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
          select: { id: true, status: true },
        });

        if (!recipient || recipient.status !== 'ACTIVE') {
          throw new BadRequestException(
            `Commission override recipient ${override.userId} is not an active user`,
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
        });
      }
    }

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

      await tx.commission.createMany({ data: commissionsData });

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
   * Called when a policy is fully paid. Only approved commissions can become realized.
   */
  async realizeCommissions(policyId: string, companyId?: string) {
    let effectiveCompanyId = companyId;
    if (!effectiveCompanyId && typeof this.prisma?.policy?.findUnique === 'function') {
      const policy = await this.prisma.policy.findUnique({
        where: { id: policyId },
        select: { companyId: true },
      });
      effectiveCompanyId = policy?.companyId;
    }

    const result = await this.prisma.commission.updateMany({
      where: {
        policyId,
        status: 'APPROVED',
        ...(effectiveCompanyId ? { companyId: effectiveCompanyId } : {}),
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

  /**
   * Approves an accrued commission atomically with company context and audit logging.
   */
  async approveCommission(id: string, actor: RequestUser) {
    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Company context is required for commission approval');
    }

    return this.prisma.$transaction(async (tx) => {
      const commission = await tx.commission.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!commission) {
        throw new NotFoundException('Commission record not found');
      }

      const recordCompanyId = commission.companyId || commission.user?.companyId;
      if (recordCompanyId && recordCompanyId !== companyId) {
        throw new ForbiddenException('Commission belongs to another organization');
      }

      if (commission.status === 'APPROVED') {
        throw new ConflictException('Commission is already approved');
      }
      if (commission.status === 'PAID') {
        throw new ConflictException('Commission has already been paid');
      }
      if (commission.status === 'REALIZED') {
        throw new ConflictException('Commission is already realized');
      }
      if (commission.status === 'CANCELLED') {
        throw new BadRequestException('Cannot approve a cancelled commission');
      }
      if (commission.status !== 'ACCRUED') {
        throw new BadRequestException(
          `Commission with status "${commission.status}" cannot be approved`,
        );
      }

      const updated = await tx.commission.update({
        where: { id },
        data: {
          status: 'APPROVED',
          companyId: commission.companyId || companyId,
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.APPROVE,
          entity: 'Commission',
          entityId: id,
          module: 'FINANCE',
          userId: actor.id || actor.userId || null,
          oldValue: { status: commission.status },
          newValue: { status: 'APPROVED' },
          metadata: {
            policyId: commission.policyId,
            recipientId: commission.userId,
            amount: commission.amount.toString(),
            roleTier: commission.roleTier,
            approvedAt: new Date().toISOString(),
            companyId,
          },
        },
      });

      this.logger.log(`Approved commission ${id} by user ${actor.id || actor.userId}`);
      return updated;
    });
  }

  /**
   * Bulk approves commissions with explicit per-record outcome semantics.
   */
  async bulkApproveCommissions(ids: string[], actor: RequestUser) {
    const companyId = actor.companyId || (actor as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException('Company context is required for bulk commission approval');
    }

    if (!Array.isArray(ids) || ids.length === 0) {
      throw new BadRequestException('At least one commission ID must be provided');
    }

    const results: Array<{
      id: string;
      status: 'SUCCESS' | 'ALREADY_PROCESSED' | 'STATE_MISMATCH' | 'NOT_FOUND' | 'FORBIDDEN' | 'FAILED';
      message: string;
    }> = [];

    let successfulCount = 0;
    let alreadyProcessedCount = 0;
    let stateMismatchCount = 0;
    let failedCount = 0;

    for (const id of ids) {
      try {
        await this.approveCommission(id, actor);
        successfulCount++;
        results.push({
          id,
          status: 'SUCCESS',
          message: 'Commission successfully approved',
        });
      } catch (err: any) {
        if (err instanceof ConflictException) {
          alreadyProcessedCount++;
          results.push({
            id,
            status: 'ALREADY_PROCESSED',
            message: err.message || 'Commission already processed',
          });
        } else if (err instanceof NotFoundException) {
          failedCount++;
          results.push({
            id,
            status: 'NOT_FOUND',
            message: err.message || 'Commission record not found',
          });
        } else if (err instanceof ForbiddenException) {
          failedCount++;
          results.push({
            id,
            status: 'FORBIDDEN',
            message: err.message || 'Cross-tenant access forbidden',
          });
        } else if (err instanceof BadRequestException) {
          stateMismatchCount++;
          results.push({
            id,
            status: 'STATE_MISMATCH',
            message: err.message || 'Invalid state transition',
          });
        } else {
          failedCount++;
          results.push({
            id,
            status: 'FAILED',
            message: err?.message || 'Failed to approve commission',
          });
        }
      }
    }

    return {
      totalSelected: ids.length,
      successfulCount,
      alreadyProcessedCount,
      stateMismatchCount,
      failedCount,
      results,
    };
  }
}
