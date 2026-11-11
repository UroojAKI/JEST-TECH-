import { Injectable, Logger, BadRequestException, NotFoundException, ForbiddenException, ConflictException } from '@nestjs/common';
import { Prisma, AuditAction } from '@prisma/client';
import type { RequestUser } from '../../../../auth/decorators/current-user.decorator';
import { PrismaService } from '../../../../../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class CommissionEngineService {
  private readonly logger = new Logger(CommissionEngineService.name);

  constructor(private readonly prisma: PrismaService) {}

  private validatePlanRules(rules: any) {
    const agentPercent = Number(rules?.agentPercent);
    if (!Number.isFinite(agentPercent) || agentPercent < 0 || agentPercent > 15) {
      throw new BadRequestException('Agent commission percentage must be between 0 and 15');
    }
    const overrides = Array.isArray(rules?.overrides) ? rules.overrides : [];
    let total = agentPercent;
    for (const override of overrides) {
      const percent = Number(override?.percent);
      if (!override?.userId || !override?.roleTier || !Number.isFinite(percent) || percent < 0 || percent > 100) {
        throw new BadRequestException('Each commission override requires a userId, roleTier and a valid percentage');
      }
      total += percent;
    }
    if (total > 20) {
      throw new BadRequestException('Combined commission percentage cannot exceed 20');
    }
    const expenseAccountId = rules?.accounting?.expenseAccountId;
    const payableAccountId = rules?.accounting?.payableAccountId;
    if (!expenseAccountId || !payableAccountId || expenseAccountId === payableAccountId) {
      throw new BadRequestException('Commission plan requires distinct commission expense and commission payable ledger accounts');
    }
    return { agentPercent, overrides, accounting: { expenseAccountId, payableAccountId } };
  }

  private async assertPlanRecipients(companyId: string, rules: any, tx: any = this.prisma) {
    const ids = [...new Set((rules.overrides || []).map((entry: any) => entry.userId))];
    if (!ids.length) return;
    const recipients = await tx.user.findMany({
      where: { id: { in: ids }, companyId, status: 'ACTIVE' },
      select: { id: true },
    });
    if (recipients.length !== ids.length) {
      throw new BadRequestException('Every commission override recipient must be an active user in this company');
    }
  }

  async listCommissionPlans(companyId: string) {
    if (!companyId) throw new ForbiddenException('Company context is required');
    const plans = await this.prisma.commissionPlan.findMany({
      where: { companyId },
      orderBy: [{ isActive: 'desc' }, { name: 'asc' }],
    });
    return plans.map((plan) => ({ ...plan, rules: JSON.parse(plan.rules) }));
  }

  async createCommissionPlan(companyId: string, input: { name: string; description?: string; rules: any }) {
    if (!companyId) throw new ForbiddenException('Company context is required');
    if (!input.name?.trim()) throw new BadRequestException('Commission plan name is required');
    const rules = this.validatePlanRules(input.rules);
    await this.assertPlanRecipients(companyId, rules);
    return this.prisma.commissionPlan.create({
      data: {
        companyId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        rules: JSON.stringify(rules),
        isActive: true,
      },
    });
  }

  async updateCommissionPlan(companyId: string, planId: string, input: { name?: string; description?: string; rules?: any; isActive?: boolean }) {
    if (!companyId) throw new ForbiddenException('Company context is required');
    const existing = await this.prisma.commissionPlan.findFirst({ where: { id: planId, companyId } });
    if (!existing) throw new NotFoundException('Commission plan not found');
    let serializedRules = existing.rules;
    if (input.rules !== undefined) {
      const rules = this.validatePlanRules(input.rules);
      await this.assertPlanRecipients(companyId, rules);
      serializedRules = JSON.stringify(rules);
    }
    return this.prisma.commissionPlan.update({
      where: { id: planId },
      data: {
        ...(input.name !== undefined ? { name: input.name.trim() } : {}),
        ...(input.description !== undefined ? { description: input.description.trim() || null } : {}),
        ...(input.rules !== undefined ? { rules: serializedRules } : {}),
        ...(input.isActive !== undefined ? { isActive: input.isActive } : {}),
      },
    });
  }

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
    const policy = await this.prisma.policy.findFirst({
      where: { id: policyId, deletedAt: null },
      select: { id: true, companyId: true, premiumAmount: true, quotation: { select: { totalPremium: true, gstAmount: true } } },
    });
    if (!policy?.companyId) {
      throw new NotFoundException('Policy not found or tenant ownership is unavailable');
    }
    if (actorCompanyId && policy.companyId !== actorCompanyId) {
      throw new ForbiddenException('Policy does not belong to the authenticated company');
    }

    const agent = await this.prisma.user.findFirst({
      where: { id: agentId, companyId: policy.companyId, status: 'ACTIVE' },
      select: { id: true, status: true },
    });
    if (!agent) {
      throw new ForbiddenException('Commission recipient must be an active user in the policy tenant');
    }

    const premiumAmount = new Decimal(premiumAmountStr);

    if (premiumAmount.lte(0)) {
      throw new BadRequestException('Premium amount must be greater than zero');
    }

    const plan = await this.prisma.commissionPlan.findFirst({
      where: { id: planId, companyId: policy.companyId, isActive: true },
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

    // The policy's stored premium/quotation snapshot is authoritative; caller input
    // is retained only as a consistency check, never as a cross-tenant lookup key.
    let commissionableBase = premiumAmount;
    if (policy.quotation) {
      const total = new Decimal(policy.quotation.totalPremium || policy.premiumAmount);
      const gst = new Decimal(policy.quotation.gstAmount || 0);
      const netWithoutGst = total.sub(gst);
      if (netWithoutGst.gt(0)) {
        commissionableBase = netWithoutGst;
      }
    }

    const commissionsData: Prisma.CommissionCreateManyInput[] = [];
    const agentCommissionAmt = commissionableBase
      .mul(new Decimal(agentPercent))
      .div(100);

    commissionsData.push({
      policyId,
      companyId: policy.companyId,
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

        const recipient = await this.prisma.user.findFirst({
          where: { id: override.userId, companyId: policy.companyId, status: 'ACTIVE' },
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
          companyId: policy.companyId,
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
        where: { policyId, companyId: policy.companyId },
        orderBy: { createdAt: 'asc' },
      });

      if (existing.length === 0) {
        await tx.commission.createMany({ data: commissionsData });
      }

      const ledgerReference = await tx.journalEntry.findFirst({
        where: {
          companyId: policy.companyId,
          referenceId: policyId,
          referenceType: 'COMMISSION_ACCRUAL',
        },
        select: { id: true },
      });
      if (!ledgerReference) {
        const accounts = await tx.chartOfAccount.findMany({
          where: {
            id: { in: [rules.accounting.expenseAccountId, rules.accounting.payableAccountId] },
            isActive: true,
          },
          select: { id: true, type: true },
        });
        const expenseAccount = accounts.find((account: any) => account.id === rules.accounting.expenseAccountId);
        const payableAccount = accounts.find((account: any) => account.id === rules.accounting.payableAccountId);
        if (!expenseAccount || expenseAccount.type !== 'EXPENSE' || !payableAccount || payableAccount.type !== 'LIABILITY') {
          throw new BadRequestException('Commission plan ledger mappings must reference active EXPENSE and LIABILITY accounts');
        }

        const totalCommission = commissionsData.reduce(
          (sum, commission) => sum.add(new Decimal(commission.amount as any)),
          new Decimal(0),
        );
        if (totalCommission.gt(0)) {
          const sequenceRows = await tx.$queryRaw<Array<{ nextval: bigint }>>`
            SELECT nextval('journal_entry_number_seq')
          `;
          const sequenceNumber = sequenceRows[0]?.nextval;
          if (sequenceNumber === undefined) throw new BadRequestException('Unable to allocate commission journal number');
          await tx.journalEntry.create({
            data: {
              entryNumber: `JE-${sequenceNumber.toString().padStart(8, '0')}`,
              date: new Date(),
              description: `Commission accrual for policy ${policyId}`,
              referenceId: policyId,
              referenceType: 'COMMISSION_ACCRUAL',
              companyId: policy.companyId,
              status: 'POSTED',
              lines: {
                create: [
                  { accountId: expenseAccount.id, debit: totalCommission, credit: 0, description: 'Commission expense accrued' },
                  { accountId: payableAccount.id, debit: 0, credit: totalCommission, description: 'Commission payable accrued' },
                ],
              },
            },
          });
        }
      }

      return tx.commission.findMany({
        where: { policyId, companyId: policy.companyId },
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
    if (!companyId) {
      throw new ForbiddenException('Company context is required to realize commissions');
    }

    return this.prisma.$transaction(async (tx) => {
      const policy = await tx.policy.findFirst({
        where: { id: policyId, companyId, deletedAt: null },
        select: { id: true },
      });
      if (!policy) {
        throw new NotFoundException('Policy not found in the current company workspace');
      }

      const result = await tx.commission.updateMany({
        where: { policyId, companyId, status: 'APPROVED' },
        data: { status: 'REALIZED' },
      });

      this.logger.log(
        `Realized ${result.count} approved commissions for policy ${policyId} in company ${companyId}`,
      );
      return result.count;
    });
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
        include: { user: true, policy: { select: { companyId: true } } },
      });

      if (!commission) {
        throw new NotFoundException('Commission record not found');
      }

      const recordCompanyId =
        commission.companyId || commission.user?.companyId || commission.policy?.companyId;
      if (!recordCompanyId || recordCompanyId !== companyId) {
        throw new ForbiddenException(
          'Commission tenant could not be verified for this organization',
        );
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
