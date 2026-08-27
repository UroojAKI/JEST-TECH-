// @ts-nocheck
import { Test, TestingModule } from '@nestjs/testing';
import { LedgerService, CreateJournalEntryDto } from './ledger.service';
import { PrismaService } from '../../../../../database/prisma.service';
import { BadRequestException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('LedgerService', () => {
  let service: LedgerService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LedgerService,
        {
          provide: PrismaService,
          useValue: {
            journalEntry: {
              create: jest.fn(),
            },
            chartOfAccount: {
              findUnique: jest.fn(),
            },
            journalLine: {
              aggregate: jest.fn(),
            },
          },
        },
      ],
    }).compile();

    service = module.get<LedgerService>(LedgerService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('postEntry', () => {
    it('should throw if debits and credits do not balance', async () => {
      const data: CreateJournalEntryDto = {
        date: new Date(),
        description: 'Unbalanced Entry',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 90 }, // Unbalanced!
        ],
      };

      await expect(service.postEntry(data)).rejects.toThrow(
        BadRequestException,
      );
      await expect(service.postEntry(data)).rejects.toThrow(
        'Journal entry is unbalanced',
      );
    });

    it('should throw if less than 2 lines provided', async () => {
      const data: CreateJournalEntryDto = {
        date: new Date(),
        description: 'Single Line',
        lines: [{ accountId: 'acc-1', debit: 100, credit: 0 }],
      };

      await expect(service.postEntry(data)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should throw if a line has both debit and credit', async () => {
      const data: CreateJournalEntryDto = {
        date: new Date(),
        description: 'Bad Line',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 100 },
          { accountId: 'acc-2', debit: 0, credit: 0 },
        ],
      };

      await expect(service.postEntry(data)).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should create journal entry if balanced', async () => {
      const data: CreateJournalEntryDto = {
        date: new Date(),
        description: 'Balanced Entry',
        lines: [
          { accountId: 'acc-1', debit: 100, credit: 0 },
          { accountId: 'acc-2', debit: 0, credit: 100 },
        ],
      };

      jest
        .spyOn(prisma.journalEntry, 'create')
        .mockResolvedValue({ id: 'je-1' } as any);

      const result = await service.postEntry(data);

      expect(result.id).toBe('je-1');
      expect(prisma.journalEntry.create).toHaveBeenCalled();
    });
  });

  describe('getAccountBalance', () => {
    it('should calculate ASSET balance as Debit - Credit', async () => {
      jest
        .spyOn(prisma.chartOfAccount, 'findUnique')
        .mockResolvedValue({ type: 'ASSET' } as any);
      jest.spyOn(prisma.journalLine, 'aggregate').mockResolvedValue({
        _sum: { debit: new Decimal(500), credit: new Decimal(100) },
      } as any);

      const balance = await service.getAccountBalance('acc-asset');
      expect(balance.toNumber()).toBe(400); // 500 - 100
    });

    it('should calculate LIABILITY balance as Credit - Debit', async () => {
      jest
        .spyOn(prisma.chartOfAccount, 'findUnique')
        .mockResolvedValue({ type: 'LIABILITY' } as any);
      jest.spyOn(prisma.journalLine, 'aggregate').mockResolvedValue({
        _sum: { debit: new Decimal(100), credit: new Decimal(500) },
      } as any);

      const balance = await service.getAccountBalance('acc-liability');
      expect(balance.toNumber()).toBe(400); // 500 - 100
    });
  });

  describe('getLedgerEntries', () => {
    it('should return paginated journal entries with balanced flag', async () => {
      (prisma.journalEntry as any).count = jest.fn().mockResolvedValue(1);
      (prisma.journalEntry as any).findMany = jest.fn().mockResolvedValue([
        {
          id: 'je-1',
          entryNumber: 'JE-1001',
          date: new Date('2026-08-27'),
          description: 'Policy Issuance AR/Payable Split',
          referenceId: 'POL-1',
          referenceType: 'POLICY',
          status: 'POSTED',
          lines: [
            {
              id: 'jl-1',
              accountId: 'acc-ar',
              debit: new Decimal(25000),
              credit: new Decimal(0),
              description: 'Customer Receivable',
              account: { id: 'acc-ar', code: '1001', name: 'Accounts Receivable', type: 'ASSET' },
            },
            {
              id: 'jl-2',
              accountId: 'acc-ap',
              debit: new Decimal(0),
              credit: new Decimal(21250),
              description: 'Insurer Premium Payable',
              account: { id: 'acc-ap', code: '2001', name: 'Insurer Payable', type: 'LIABILITY' },
            },
            {
              id: 'jl-3',
              accountId: 'acc-rev',
              debit: new Decimal(0),
              credit: new Decimal(3750),
              description: 'Brokerage Commission Income',
              account: { id: 'acc-rev', code: '4001', name: 'Commission Revenue', type: 'REVENUE' },
            },
          ],
        },
      ]);

      const result = await service.getLedgerEntries();

      expect(result.data).toHaveLength(1);
      const entry = result.data[0];
      expect(entry.totalDebit).toBe(25000);
      expect(entry.totalCredit).toBe(25000);
      expect(entry.isBalanced).toBe(true);
      expect(entry.lines).toHaveLength(3);
      expect(result.meta.total).toBe(1);
    });
  });
});
