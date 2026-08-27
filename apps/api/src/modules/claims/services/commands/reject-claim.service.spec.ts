import { Test, TestingModule } from '@nestjs/testing';
import { RejectClaimService } from './reject-claim.service';
import { PrismaService } from '../../../../database/prisma.service';
import { ClaimStatus, Prisma } from '@prisma/client';
import { BadRequestException, ForbiddenException } from '@nestjs/common';

describe('RejectClaimService (Claims Rejection & Auditing)', () => {
  let service: RejectClaimService;
  let prisma: PrismaService;

  const mockPrisma = {
    claim: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    claimHistory: {
      create: jest.fn(),
    },
    $transaction: jest.fn((cb) => cb(mockPrisma)),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RejectClaimService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<RejectClaimService>(RejectClaimService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  const activeClaim = {
    id: 'claim-3',
    claimNumber: 'CLM-2026-003',
    status: ClaimStatus.UNDER_ASSESSMENT,
    createdById: 'agent-1',
  };

  it('rejects if reason is empty', async () => {
    mockPrisma.claim.findUnique.mockResolvedValue(activeClaim);

    await expect(
      service.execute('claim-3', { reason: '' }, 'claims-officer-1'),
    ).rejects.toThrow(BadRequestException);
  });

  it('rejects if actor is the claim creator (segregation of duties)', async () => {
    mockPrisma.claim.findUnique.mockResolvedValue(activeClaim);

    await expect(
      service.execute('claim-3', { reason: 'Fraud' }, 'agent-1'),
    ).rejects.toThrow(ForbiddenException);
  });

  it('successfully rejects claim and transitions status to REJECTED', async () => {
    mockPrisma.claim.findUnique.mockResolvedValue(activeClaim);
    mockPrisma.claim.update.mockResolvedValue({
      ...activeClaim,
      status: ClaimStatus.REJECTED,
    });

    const result = await service.execute(
      'claim-3',
      { reason: 'Incident occurred outside policy coverage period' },
      'claims-officer-1',
    );

    expect(result.status).toBe(ClaimStatus.REJECTED);
    expect(mockPrisma.claimHistory.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          claimId: 'claim-3',
          status: ClaimStatus.REJECTED,
          createdById: 'claims-officer-1',
        }),
      }),
    );
  });
});
