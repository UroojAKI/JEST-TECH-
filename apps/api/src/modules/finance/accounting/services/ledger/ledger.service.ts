import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { JournalEntry } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export class CreateJournalEntryLineDto {
  accountId: string;
  debit: number;
  credit: number;
  description?: string;
}

export class CreateJournalEntryDto {
  date: Date;
  description: string;
  referenceId?: string;
  referenceType?: string;
  lines: CreateJournalEntryLineDto[];
}

@Injectable()
export class LedgerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Posts a strict double-entry journal to the ledger.
   * Enforces that Total Debits == Total Credits.
   */
  async postEntry(data: CreateJournalEntryDto): Promise<JournalEntry> {
    if (!data.lines || data.lines.length < 2) {
      throw new BadRequestException(
        'A journal entry must have at least two lines.',
      );
    }

    let totalDebit = new Decimal(0);
    let totalCredit = new Decimal(0);

    for (const line of data.lines) {
      if (line.debit < 0 || line.credit < 0) {
        throw new BadRequestException(
          'Debits and Credits must be positive values.',
        );
      }
      if (line.debit > 0 && line.credit > 0) {
        throw new BadRequestException(
          'A single line cannot have both a debit and a credit.',
        );
      }

      totalDebit = totalDebit.add(line.debit);
      totalCredit = totalCredit.add(line.credit);
    }

    if (!totalDebit.equals(totalCredit)) {
      throw new BadRequestException(
        `Journal entry is unbalanced. Debits: ${totalDebit}, Credits: ${totalCredit}`,
      );
    }

    // Generate unique entry number
    const entryNumber = `JE-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    return this.prisma.journalEntry.create({
      data: {
        entryNumber,
        date: data.date,
        description: data.description,
        referenceId: data.referenceId,
        referenceType: data.referenceType,
        status: 'POSTED',
        lines: {
          create: data.lines.map((line) => ({
            accountId: line.accountId,
            debit: line.debit,
            credit: line.credit,
            description: line.description,
          })),
        },
      },
      include: {
        lines: true,
      },
    });
  }

  /**
   * Calculates the current balance of an account.
   * Normal balances:
   * ASSET / EXPENSE: Balance = Debit - Credit
   * LIABILITY / EQUITY / REVENUE: Balance = Credit - Debit
   */
  async getAccountBalance(accountId: string): Promise<Decimal> {
    const account = await this.prisma.chartOfAccount.findUnique({
      where: { id: accountId },
    });

    if (!account) throw new BadRequestException('Account not found');

    const result = await this.prisma.journalLine.aggregate({
      where: {
        accountId,
        journalEntry: { status: 'POSTED' },
      },
      _sum: {
        debit: true,
        credit: true,
      },
    });

    const totalDebit = result._sum.debit || new Decimal(0);
    const totalCredit = result._sum.credit || new Decimal(0);

    if (account.type === 'ASSET' || account.type === 'EXPENSE') {
      return totalDebit.sub(totalCredit);
    } else {
      return totalCredit.sub(totalDebit);
    }
  }

  /**
   * Retrieves paginated double-entry ledger journal entries with balanced validation.
   */
  async getLedgerEntries(params?: {
    search?: string;
    accountId?: string;
    referenceType?: string;
    page?: number;
    limit?: number;
  }) {
    const page = Math.max(1, Number(params?.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(params?.limit) || 20));
    const skip = (page - 1) * limit;

    const where: any = {};
    if (params?.referenceType && params.referenceType !== 'ALL') {
      where.referenceType = params.referenceType;
    }
    if (params?.search && params.search.trim()) {
      const q = params.search.trim();
      where.OR = [
        { entryNumber: { contains: q, mode: 'insensitive' } },
        { description: { contains: q, mode: 'insensitive' } },
        { referenceId: { contains: q, mode: 'insensitive' } },
      ];
    }
    if (params?.accountId) {
      where.lines = {
        some: { accountId: params.accountId },
      };
    }

    const [total, entries] = await Promise.all([
      this.prisma.journalEntry.count({ where }),
      this.prisma.journalEntry.findMany({
        where,
        include: {
          lines: {
            include: {
              account: {
                select: { id: true, code: true, name: true, type: true },
              },
            },
          },
        },
        orderBy: { date: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    const formatted = entries.map((entry) => {
      let debitSum = 0;
      let creditSum = 0;

      const lines = entry.lines.map((l) => {
        const d = Number(l.debit || 0);
        const c = Number(l.credit || 0);
        debitSum += d;
        creditSum += c;
        return {
          id: l.id,
          accountId: l.accountId,
          accountCode: l.account?.code || 'N/A',
          accountName: l.account?.name || 'Unknown Account',
          accountType: l.account?.type || 'ASSET',
          debit: d,
          credit: c,
          description: l.description,
        };
      });

      return {
        id: entry.id,
        entryNumber: entry.entryNumber,
        date: entry.date.toISOString(),
        description: entry.description,
        referenceId: entry.referenceId,
        referenceType: entry.referenceType,
        status: entry.status,
        totalDebit: debitSum,
        totalCredit: creditSum,
        isBalanced: Math.abs(debitSum - creditSum) < 0.01,
        lines,
      };
    });

    return {
      data: formatted,
      meta: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }
}
