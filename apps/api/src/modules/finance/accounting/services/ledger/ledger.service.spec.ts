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
});
