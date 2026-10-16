import { Test, TestingModule } from '@nestjs/testing';
import { SettlementService, CreateSettlementBatchDto } from './settlement.service';
import { PrismaService } from '../../../database/prisma.service';
import { BadRequestException, ConflictException } from '@nestjs/common';
import { Decimal } from '@prisma/client/runtime/library';

describe('SettlementService', () => {
  let service: SettlementService;
  let prisma: PrismaService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        {
          provide: PrismaService,
          useValue: {
            policy: {
              findMany: jest.fn(),
            },
            invoice: {
              findMany: jest.fn(),
            },
            settlement: {
              create: jest.fn(),
              count: jest.fn().mockResolvedValue(0),
              findFirst: jest.fn().mockResolvedValue(null),
            },
            commission: {
              findMany: jest.fn(),
              updateMany: jest.fn(),
            },
            auditLog: {
              create: jest.fn(),
            },
            $queryRaw: jest.fn().mockResolvedValue([{ nextval: 12n }]),
            $transaction: jest.fn(async (cb) => cb(prisma)),
          },
        },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  it('should throw if companyId is missing', async () => {
    const dto: CreateSettlementBatchDto = {
      insurerName: 'HDFC ERGO',
      period: '2026-10',
    };

    await expect(service.createBatch(dto, '')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should throw if insurerName is empty', async () => {
    const dto: CreateSettlementBatchDto = {
      insurerName: '   ',
      period: '2026-10',
    };

    await expect(service.createBatch(dto, 'company-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should compute gross premium, retained commission and net payable from authoritative DB records', async () => {
    const dto: CreateSettlementBatchDto = {
      insurerName: 'HDFC ERGO',
      period: '2026-10',
      description: 'October carrier reconciliation',
    };

    // Policies found for this insurer & period
    jest.spyOn(prisma.policy, 'findMany').mockResolvedValue([
      { id: 'pol-1' },
      { id: 'pol-2' },
    ] as any);

    // Invoices with allocations for pol-1 and pol-2
    jest.spyOn(prisma.invoice, 'findMany').mockResolvedValue([
      {
        id: 'inv-1',
        allocations: [{ amount: new Decimal(10000) }],
      },
      {
        id: 'inv-2',
        allocations: [{ amount: new Decimal(15000) }],
      },
    ] as any);

    // Retained broker commissions (e.g. 15% brokerage = 1,500 and 2,250 = 3,750)
    jest.spyOn(prisma.commission, 'findMany').mockResolvedValue([
      { amount: new Decimal(1500) },
      { amount: new Decimal(2250) },
    ] as any);

    jest.spyOn(prisma.settlement, 'create').mockResolvedValue({
      id: 'stl-uuid-1',
      batchNumber: 'STL-00000012',
      status: 'PENDING',
      createdAt: new Date('2026-10-13T10:00:00Z'),
      insurerName: 'HDFC ERGO',
    } as any);

    const result = await service.createBatch(dto, 'company-1', 'actor-1');

    // Gross: 10,000 + 15,000 = 25,000
    // Retained commission: 1,500 + 2,250 = 3,750
    // Net payable: 25,000 - 3,750 = 21,250
    expect(result.grossPremiumCollected).toBe(25000);
    expect(result.commissionRetained).toBe(3750);
    expect(result.netPayable).toBe(21250);
    expect(result.batchNumber).toBe('STL-00000012');
    expect(result.insurerName).toBe('HDFC ERGO');
    expect(result.policyCount).toBe(2);

    expect(prisma.settlement.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        batchNumber: 'STL-00000012',
        companyId: 'company-1',
        insurerName: 'HDFC ERGO',
        totalAmount: new Decimal(25000),
        retainedCommission: new Decimal(3750),
        netPayable: new Decimal(21250),
        period: '2026-10',
        status: 'PENDING',
      }),
    });

    expect(prisma.auditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        action: 'CREATE',
        entity: 'Settlement',
        module: 'FINANCE',
        userId: 'actor-1',
      }),
    });
  });

  it('handles empty policy periods gracefully without negative or undefined values', async () => {
    const dto: CreateSettlementBatchDto = {
      insurerName: 'New Insurer Ltd',
      period: '2026-10',
    };

    jest.spyOn(prisma.policy, 'findMany').mockResolvedValue([]);
    jest.spyOn(prisma.settlement, 'create').mockResolvedValue({
      id: 'stl-uuid-2',
      batchNumber: 'STL-00000012',
      status: 'PENDING',
      createdAt: new Date('2026-10-13T10:00:00Z'),
      insurerName: 'New Insurer Ltd',
    } as any);

    const result = await service.createBatch(dto, 'company-1', 'actor-1');

    expect(result.grossPremiumCollected).toBe(0);
    expect(result.commissionRetained).toBe(0);
    expect(result.netPayable).toBe(0);
    expect(result.policyCount).toBe(0);
  });
  it('should throw ConflictException if batch already exists for insurer and period', async () => {
    const dto: CreateSettlementBatchDto = {
      insurerName: 'HDFC ERGO',
      period: '2026-10',
    };

    jest.spyOn(prisma.settlement, 'findFirst').mockResolvedValue({
      id: 'existing-batch',
      batchNumber: 'STL-00000001',
    } as any);

    await expect(service.createBatch(dto, 'company-1')).rejects.toThrow(
      ConflictException,
    );
  });
});
