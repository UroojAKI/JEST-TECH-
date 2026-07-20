import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../../../../database/prisma.service';
import { JournalEntry, JournalLine } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

export interface CreateJournalEntryDto {
  date: Date;
  description: string;
  referenceId?: string;
  referenceType?: string;
  lines: {
    accountId: string;
    debit: number;
    credit: number;
    description?: string;
  }[];
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
}
