import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { Decimal } from '@prisma/client/runtime/library';
import { IsString, IsOptional, Matches } from 'class-validator';

export class CreateSettlementBatchDto {
  @IsString()
  insurerName: string;

  /**
   * Period in YYYY-MM format, e.g. '2026-10'
   */
  @IsString()
  @Matches(/^\d{4}-(?:0[1-9]|1[0-2])$/, {
    message: 'period must be in YYYY-MM format (e.g. 2026-10)',
  })
  period: string;

  @IsOptional()
  @IsString()
  description?: string;
}

@Injectable()
export class SettlementService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new settlement batch for an insurer for a given period.
   *
   * Gross premium collected = sum of allocations on invoices linked to policies
   *   for this insurer and period.
   * Commission retained = sum of Commission records in APPROVED, REALIZED, or PAID
   *   status for those policies.
   * Net payable = grossPremium - retainedCommission.
   *
   * The browser-submitted amount is NEVER trusted. All financial values are
   * computed server-side from authoritative database records.
   */
  async createBatch(
    dto: CreateSettlementBatchDto,
    companyId: string,
    actorId?: string,
  ) {
    if (!companyId) {
      throw new BadRequestException('Company context is required for settlement batch');
    }

    const trimmedInsurer = dto.insurerName.trim();
    if (!trimmedInsurer) {
      throw new BadRequestException('Insurer name is required');
    }

    const [yearStr, monthStr] = dto.period.split('-');
    const year = parseInt(yearStr, 10);
    const month = parseInt(monthStr, 10);
    const periodStart = new Date(Date.UTC(year, month - 1, 1));
    const periodEnd = new Date(Date.UTC(year, month, 1));

    // 1. Locate company policies for the requested insurer created in the target period
    const policies = await this.prisma.policy.findMany({
      where: {
        companyId,
        deletedAt: null,
        quotation: {
          insurerName: {
            contains: trimmedInsurer,
            mode: 'insensitive',
          },
        },
        createdAt: { gte: periodStart, lt: periodEnd },
      },
      select: { id: true },
    });

    const policyIds = policies.map((p) => p.id);

    // 2. Sum gross allocations for invoices linked to these policies
    let grossPremium = new Decimal(0);
    if (policyIds.length > 0) {
      const invoices = await this.prisma.invoice.findMany({
        where: {
          entityType: 'POLICY',
          entityId: { in: policyIds },
        },
        include: {
          allocations: { select: { amount: true } },
        },
      });

      for (const inv of invoices) {
        for (const alloc of inv.allocations) {
          grossPremium = grossPremium.add(alloc.amount);
        }
      }
    }

    // 3. Sum retained broker commissions for these policies (APPROVED, REALIZED, or PAID)
    let retainedCommission = new Decimal(0);
    if (policyIds.length > 0) {
      const commissions = await this.prisma.commission.findMany({
        where: {
          policyId: { in: policyIds },
          status: { in: ['APPROVED', 'REALIZED', 'PAID'] },
        },
        select: { amount: true },
      });

      for (const comm of commissions) {
        retainedCommission = retainedCommission.add(comm.amount);
      }
    }

    const netPayable = grossPremium.sub(retainedCommission);

    // 4. Allocate batch number safely
    let batchNumber: string;
    try {
      const seqRows = await this.prisma.$queryRaw<Array<{ nextval: bigint }>>`
        SELECT nextval('settlement_batch_seq')
      `;
      const seq = seqRows[0]?.nextval;
      if (seq !== undefined) {
        batchNumber = `STL-${seq.toString().padStart(8, '0')}`;
      } else {
        batchNumber = `STL-${Date.now().toString().slice(-8)}`;
      }
    } catch {
      // Fallback if sequence is not yet executed in current test database
      const count = await this.prisma.settlement.count();
      batchNumber = `STL-${(count + 1).toString().padStart(8, '0')}`;
    }

    // 5. Persist inside atomic transaction with audit log
    const settlement = await this.prisma.$transaction(async (tx) => {
      const created = await tx.settlement.create({
        data: {
          batchNumber,
          date: periodStart,
          totalAmount: grossPremium,
          status: 'PENDING',
          companyId,
          insurerName: trimmedInsurer,
          retainedCommission,
          netPayable,
          period: dto.period,
        },
      });

      await tx.auditLog.create({
        data: {
          action: 'CREATE',
          entity: 'Settlement',
          entityId: created.id,
          module: 'FINANCE',
          userId: actorId || null,
          metadata: {
            insurerName: trimmedInsurer,
            period: dto.period,
            grossPremium: grossPremium.toString(),
            retainedCommission: retainedCommission.toString(),
            netPayable: netPayable.toString(),
            policyCount: policyIds.length,
            description: dto.description || null,
          },
          newValue: {
            batchNumber,
            status: 'PENDING',
          },
        },
      });

      return created;
    });

    return {
      id: settlement.id,
      batchNumber: settlement.batchNumber,
      insurerName: settlement.insurerName || trimmedInsurer,
      period: dto.period,
      status: settlement.status,
      grossPremiumCollected: Number(grossPremium),
      commissionRetained: Number(retainedCommission),
      netPayable: Number(netPayable),
      policyCount: policyIds.length,
      createdAt: settlement.createdAt.toISOString(),
    };
  }
}
