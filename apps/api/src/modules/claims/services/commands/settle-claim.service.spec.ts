import { Test, TestingModule } from '@nestjs/testing';
import { SettleClaimService } from './settle-claim.service';
import { PrismaService } from '../../../../database/prisma.service';
import { ClaimStatus, Prisma } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

describe('SettleClaimService (Claims Settlement & Payment Confirmation)', () => {
  let service: SettleClaimService;
  let prisma: PrismaService;

  const mockPrisma = {
    claim: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    claimHistory: {
      create: jest.fn(),
    },
    settlement: {
      upsert: jest.fn().mockResolvedValue({ id: 'set-1' }),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettleClaimService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<SettleClaimService>(SettleClaimService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const approvedClaim = {
    id: 'claim-2',
    claimNumber: 'CLM-2026-002',
    status: ClaimStatus.APPROVED,
    claimAmount: new Prisma.Decimal(50000),
    approvedAmount: new Prisma.Decimal(45000),
  };

  it('rejects settlement if paymentReference is missing or empty', async () => {
    mockPrisma.claim.findUnique.mockResolvedValue(approvedClaim);

    await expect(
      service.execute(
        'claim-2',
        {
          settlementAmount: 45000,
          paymentReference: '',
          paymentMethod: 'NEFT',
        },
        'finance-officer-1',
      ),
    ).rejects.toThrow(BadRequestException);
  });

  it('successfully requests settlement and transitions status to PAYMENT_PENDING', async () => {
    mockPrisma.claim.findUnique.mockResolvedValue(approvedClaim);
    mockPrisma.claim.update.mockResolvedValue({
      ...approvedClaim,
      status: ClaimStatus.PAYMENT_PENDING,
    });

    const result = await service.execute(
      'claim-2',
      {
        settlementAmount: 45000,
        paymentReference: 'NEFT-AXIS-99120',
        paymentMethod: 'NEFT',
        bankName: 'Axis Bank',
      },
      'finance-officer-1',
    );

    expect(result.status).toBe(ClaimStatus.PAYMENT_PENDING);
    expect(mockPrisma.claimHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          claimId: 'claim-2',
          status: ClaimStatus.PAYMENT_PENDING,
          createdById: 'finance-officer-1',
        }),
      }),
    );
  });

  it('rejects settlement if actor is the same user who reported the claim (SoD)', async () => {
    mockPrisma.claim.findUnique.mockResolvedValue({
      ...approvedClaim,
      createdById: 'agent-1',
    });

    await expect(
      service.execute(
        'claim-2',
        {
          settlementAmount: 45000,
          paymentReference: 'NEFT-12345',
          paymentMethod: 'NEFT',
        },
        'agent-1',
      ),
    ).rejects.toThrow('Segregation of duties violation');
  });
});
