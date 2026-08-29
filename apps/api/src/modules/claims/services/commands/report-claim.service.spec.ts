import { Test, TestingModule } from '@nestjs/testing';
import { ReportClaimService } from './report-claim.service';
import { ClaimRepository } from '../../repositories/claim.repository';
import { PolicyRepository } from '../../../policies/repositories/policy.repository';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { PrismaService } from '../../../../database/prisma.service';
import { CACHE_PROVIDER_TOKEN } from '../../../platform/cache/cache.provider';
import { PolicyStatus, ClaimStatus } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('ReportClaimService (Iteration 14)', () => {
  let service: ReportClaimService;
  let claimRepo: any;
  let policyRepo: any;
  let eventEmitter: any;
  let prisma: any;
  let cache: any;

  beforeEach(async () => {
    claimRepo = {
      generateClaimNumber: jest.fn().mockResolvedValue('CLM-2026-0001'),
      create: jest
        .fn()
        .mockResolvedValue({ id: 'claim-1', claimNumber: 'CLM-2026-0001' }),
      addHistoryEntry: jest.fn(),
      update: jest.fn().mockResolvedValue({
        id: 'claim-1',
        claimNumber: 'CLM-2026-0001',
        status: ClaimStatus.REGISTERED,
      }),
      addCommunication: jest.fn(),
    };

    policyRepo = {
      findById: jest.fn(),
    };

    eventEmitter = {
      emitAsync: jest.fn().mockResolvedValue(true),
    };

    prisma = {
      claim: {
        findFirst: jest.fn(),
      },
      contact: {
        findUnique: jest
          .fn()
          .mockResolvedValue({ id: 'cont-1', email: 'user@jest.com' }),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    cache = {
      get: jest.fn(),
      set: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReportClaimService,
        { provide: ClaimRepository, useValue: claimRepo },
        { provide: PolicyRepository, useValue: policyRepo },
        { provide: EventEmitter2, useValue: eventEmitter },
        { provide: PrismaService, useValue: prisma },
        { provide: CACHE_PROVIDER_TOKEN, useValue: cache },
      ],
    }).compile();

    service = module.get<ReportClaimService>(ReportClaimService);
  });

  const mockPolicy = (status: PolicyStatus = PolicyStatus.ACTIVE) => ({
    id: 'pol-1',
    policyNumber: 'POL-MTR-001',
    status,
    contactId: 'cont-1',
    effectiveDate: new Date('2026-01-01T00:00:00Z'),
    expiryDate: new Date('2026-12-31T23:59:59Z'),
    deletedAt: null,
  });

  it('should successfully register claim when policy is ACTIVE and incident date is within coverage dates', async () => {
    policyRepo.findById.mockResolvedValue(mockPolicy(PolicyStatus.ACTIVE));
    prisma.claim.findFirst.mockResolvedValue(null); // No duplicate

    const dto = {
      policyId: 'pol-1',
      incidentDate: '2026-06-15T10:30:00Z', // Within 2026-01-01 to 2026-12-31
      description: 'Rear-ended at traffic signal in heavy rain',
      claimAmount: 35000,
    };

    const result = await service.execute(dto, 'usr-1');

    expect(result.claimNumber).toBe('CLM-2026-0001');
    expect(result.status).toBe(ClaimStatus.REGISTERED);
    expect(claimRepo.addCommunication).toHaveBeenCalled();
    expect(eventEmitter.emitAsync).toHaveBeenCalledWith(
      'claim.registered',
      expect.any(Object),
    );
  });

  it('should reject claim when policy status is LAPSED', async () => {
    policyRepo.findById.mockResolvedValue(mockPolicy(PolicyStatus.LAPSED));

    const dto = {
      policyId: 'pol-1',
      incidentDate: '2026-06-15T10:30:00Z',
      description: 'Accident while policy was lapsed',
      claimAmount: 20000,
    };

    await expect(service.execute(dto, 'usr-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject claim when policy status is CANCELLED', async () => {
    policyRepo.findById.mockResolvedValue(mockPolicy(PolicyStatus.CANCELLED));

    const dto = {
      policyId: 'pol-1',
      incidentDate: '2026-06-15T10:30:00Z',
      description: 'Incident after cancellation',
      claimAmount: 20000,
    };

    await expect(service.execute(dto, 'usr-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject claim when incident date is prior to policy effective date', async () => {
    policyRepo.findById.mockResolvedValue(mockPolicy(PolicyStatus.ACTIVE));

    const dto = {
      policyId: 'pol-1',
      incidentDate: '2025-12-25T10:00:00Z', // Prior to 2026-01-01!
      description: 'Pre-existing damage accident',
      claimAmount: 15000,
    };

    await expect(service.execute(dto, 'usr-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject claim when incident date is after policy expiry date', async () => {
    policyRepo.findById.mockResolvedValue(mockPolicy(PolicyStatus.ACTIVE));

    const dto = {
      policyId: 'pol-1',
      incidentDate: '2027-01-05T10:00:00Z', // After 2026-12-31!
      description: 'Post-expiry collision',
      claimAmount: 15000,
    };

    await expect(service.execute(dto, 'usr-1')).rejects.toThrow(
      BadRequestException,
    );
  });

  it('should reject duplicate active claim on same incident date', async () => {
    policyRepo.findById.mockResolvedValue(mockPolicy(PolicyStatus.ACTIVE));
    prisma.claim.findFirst.mockResolvedValue({ id: 'existing-claim-1' }); // Duplicate found!

    const dto = {
      policyId: 'pol-1',
      incidentDate: '2026-06-15T10:30:00Z',
      description: 'Duplicate claim attempt for same incident',
      claimAmount: 25000,
    };

    await expect(service.execute(dto, 'usr-1')).rejects.toThrow(
      BadRequestException,
    );
  });
});
