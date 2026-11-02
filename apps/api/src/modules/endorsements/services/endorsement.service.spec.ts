import { Test, TestingModule } from '@nestjs/testing';
import { EndorsementService } from './endorsement.service';
import { PrismaService } from '../../../database/prisma.service';
import { EndorsementType, EndorsementStatus } from '@prisma/client';
import {
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('EndorsementService (Iteration 15 & Phase 2)', () => {
  let service: EndorsementService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      policy: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      contact: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      vehicle: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      endorsement: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      endorsementHistory: {
        create: jest.fn(),
      },
      policyHistory: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((cb) => cb(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EndorsementService,
        { provide: PrismaService, useValue: prisma },
        {
          provide:
            require('../../administration/services/numbering-engine/numbering-engine.service')
              .NumberingEngineService,
          useValue: { generateNext: jest.fn().mockResolvedValue('END-0001') },
        },
      ],
    }).compile();

    service = module.get<EndorsementService>(EndorsementService);
  });

  describe('calculateProRataPremium', () => {
    it('should compute exact pro-rata differential with 18% GST based on remaining days', async () => {
      const now = new Date();
      const effectiveDate = new Date(now.getTime() - 180 * 24 * 60 * 60 * 1000);
      const expiryDate = new Date(now.getTime() + 185 * 24 * 60 * 60 * 1000);

      prisma.policy.findUnique.mockResolvedValue({
        id: 'pol-1',
        premiumAmount: 10000,
        effectiveDate,
        expiryDate,
      });

      const result = await service.calculateProRataPremium('pol-1', 20000);

      expect(result.currentAnnualPremium).toBe(10000);
      expect(result.newAnnualPremium).toBe(20000);
      expect(result.annualDifferential).toBe(10000);
      expect(result.remainingDays).toBeGreaterThan(0);
      expect(result.totalDays).toBeGreaterThan(result.remainingDays);
      expect(result.proRataFactor).toBeGreaterThan(0.4);
      expect(result.proRataFactor).toBeLessThan(0.6);
      expect(result.gstAmount).toBe(
        Number((result.proRataNetDifferential * 0.18).toFixed(2)),
      );
      expect(result.totalPayable).toBe(
        Number((result.proRataNetDifferential + result.gstAmount).toFixed(2)),
      );
    });

    it('should throw NotFoundException if policy does not exist', async () => {
      prisma.policy.findUnique.mockResolvedValue(null);
      await expect(
        service.calculateProRataPremium('pol-999', 15000),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('createEndorsement (Phase 2)', () => {
    it('should create a GENERAL_CHANGE endorsement with beforeSnapshot, baseVersion, and mark policy pending', async () => {
      prisma.policy.findUnique.mockResolvedValue({
        id: 'pol-1',
        status: 'ACTIVE',
        version: 3,
        actualPolicyNumber: 'POL-OLD-123',
        premiumAmount: 12500,
        startDate: new Date('2026-01-01'),
        endDate: new Date('2027-01-01'),
      });

      prisma.endorsement.create.mockImplementation(({ data }: any) => ({
        id: 'end-gen-1',
        ...data,
      }));

      const result = await service.createEndorsement(
        'pol-1',
        EndorsementType.GENERAL_CHANGE,
        'Customer requested premium adjustment and correct policy number',
        'user-agent-1',
        {
          actualPolicyNumber: 'POL-NEW-456',
          premiumAmount: 14000,
        },
      );

      expect(result.id).toBe('end-gen-1');
      expect(result.baseVersion).toBe(3);
      expect(result.beforeSnapshot).toMatchObject({
        actualPolicyNumber: 'POL-OLD-123',
        premiumAmount: 12500,
      });
      expect(prisma.policy.update).toHaveBeenCalledWith({
        where: { id: 'pol-1' },
        data: { hasPendingApproval: true },
      });
      expect(prisma.endorsementHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            endorsementId: 'end-gen-1',
            status: EndorsementStatus.REQUESTED,
            performedById: 'user-agent-1',
          }),
        }),
      );
    });
  });

  describe('approveEndorsement', () => {
    it('should throw ForbiddenException if requester attempts to approve their own endorsement (Four-Eye Violation)', async () => {
      prisma.endorsement.findUnique.mockResolvedValue({
        id: 'end-1',
        requestedById: 'user-agent-1',
        status: EndorsementStatus.REQUESTED,
        type: EndorsementType.CONTACT_CHANGE,
        policy: { contactId: 'cont-1' },
      });

      await expect(
        service.approveEndorsement('end-1', 'Self approval', 'user-agent-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should throw ConflictException (POLICY_CHANGE_STALE_VERSION) if policy version does not match baseVersion', async () => {
      prisma.endorsement.findUnique.mockResolvedValue({
        id: 'end-stale-1',
        policyId: 'pol-1',
        requestedById: 'user-agent-1',
        status: EndorsementStatus.REQUESTED,
        type: EndorsementType.GENERAL_CHANGE,
        baseVersion: 2,
        requestedChanges: JSON.stringify({ premiumAmount: 20000 }),
        policy: {
          id: 'pol-1',
          version: 4, // Changed concurrently
          status: 'ACTIVE',
        },
      });

      await expect(
        service.approveEndorsement('end-stale-1', 'Approving stale change', 'user-manager-2'),
      ).rejects.toThrow(ConflictException);
    });

    it('should approve non-financial contact change, update contact details, and write transactional audit log', async () => {
      prisma.endorsement.findUnique.mockResolvedValue({
        id: 'end-1',
        endorsementNumber: 'END-101',
        policyId: 'pol-1',
        requestedById: 'user-agent-1',
        status: EndorsementStatus.REQUESTED,
        type: EndorsementType.CONTACT_CHANGE,
        baseVersion: 1,
        requestedChanges: JSON.stringify({
          phone: '+919876543210',
          firstName: 'Rohit',
        }),
        policy: { id: 'pol-1', version: 1, contactId: 'cont-1' },
      });

      prisma.contact.findUnique.mockResolvedValue({
        id: 'cont-1',
        firstName: 'Rahul',
        lastName: 'Sharma',
        phone: '+919999999999',
      });

      prisma.endorsement.update.mockResolvedValue({
        id: 'end-1',
        status: EndorsementStatus.COMPLETED,
      });

      const result = await service.approveEndorsement(
        'end-1',
        'Approved by underwriting',
        'user-underwriter-2',
      );

      expect(prisma.contact.update).toHaveBeenCalledWith({
        where: { id: 'cont-1' },
        data: { firstName: 'Rohit', phone: '+919876543210' },
      });
      expect(prisma.policy.update).toHaveBeenCalledWith({
        where: { id: 'pol-1' },
        data: {
          version: { increment: 1 },
          hasPendingApproval: false,
        },
      });
      expect(prisma.auditLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          action: 'APPROVE',
          entity: 'ENDORSEMENT',
          userId: 'user-underwriter-2',
        }),
      });
      expect(result.status).toBe('COMPLETED');
    });

    it('should approve GENERAL_CHANGE, apply updates, increment version, and sync pending flag', async () => {
      prisma.endorsement.findUnique.mockResolvedValue({
        id: 'end-gen-app',
        endorsementNumber: 'END-GEN-01',
        policyId: 'pol-1',
        requestedById: 'user-agent-1',
        status: EndorsementStatus.REQUESTED,
        type: EndorsementType.GENERAL_CHANGE,
        baseVersion: 2,
        requestedChanges: JSON.stringify({
          actualPolicyNumber: 'POL-NEW-789',
          premiumAmount: 18500,
        }),
        policy: {
          id: 'pol-1',
          version: 2,
          actualPolicyNumber: 'POL-OLD-111',
          premiumAmount: 15000,
          contactId: 'cont-1',
        },
      });

      prisma.endorsement.update.mockResolvedValue({
        id: 'end-gen-app',
        status: EndorsementStatus.COMPLETED,
      });

      const result = await service.approveEndorsement(
        'end-gen-app',
        'Approved general policy update',
        'user-underwriter-2',
      );

      expect(prisma.policy.update).toHaveBeenCalledWith({
        where: { id: 'pol-1' },
        data: {
          actualPolicyNumber: 'POL-NEW-789',
          premiumAmount: 18500,
        },
      });
      expect(prisma.policy.update).toHaveBeenCalledWith({
        where: { id: 'pol-1' },
        data: {
          version: { increment: 1 },
          hasPendingApproval: false,
        },
      });
      expect(result.status).toBe('COMPLETED');
    });

    it('should reset NCB to 0% on OWNER_TRANSFER when no retention certificate is provided', async () => {
      prisma.endorsement.findUnique.mockResolvedValue({
        id: 'end-2',
        endorsementNumber: 'END-102',
        policyId: 'pol-1',
        requestedById: 'user-agent-1',
        status: EndorsementStatus.REQUESTED,
        type: EndorsementType.OWNER_TRANSFER,
        baseVersion: 1,
        requestedChanges: JSON.stringify({
          newContactId: 'cont-new-owner',
          transferDate: '2026-08-20T00:00:00Z',
          ncbRetentionCertificate: null,
        }),
        policy: {
          id: 'pol-1',
          version: 1,
          contactId: 'cont-old-owner',
          motorMetadata: JSON.stringify({ ncbPercentage: 35 }),
        },
      });

      prisma.endorsement.update.mockResolvedValue({
        id: 'end-2',
        status: EndorsementStatus.COMPLETED,
      });

      await service.approveEndorsement(
        'end-2',
        'Ownership transfer approved',
        'user-underwriter-2',
      );

      expect(prisma.policy.update).toHaveBeenCalledWith({
        where: { id: 'pol-1' },
        data: expect.objectContaining({
          contactId: 'cont-new-owner',
          motorMetadata: expect.objectContaining({
            ncbPercentage: 0, // IRDAI rule: reset to 0%
          }),
        }),
      });
      expect(prisma.policy.update).toHaveBeenCalledWith({
        where: { id: 'pol-1' },
        data: {
          version: { increment: 1 },
          hasPendingApproval: false,
        },
      });
    });
  });

  describe('rejectEndorsement', () => {
    it('should throw ForbiddenException if requester attempts to reject their own endorsement', async () => {
      prisma.endorsement.findUnique.mockResolvedValue({
        id: 'end-3',
        requestedById: 'user-agent-1',
        status: EndorsementStatus.REQUESTED,
      });

      await expect(
        service.rejectEndorsement('end-3', 'Self rejection', 'user-agent-1'),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should update status to REJECTED, record rejectionReason, clear pending flag, and leave policy untouched', async () => {
      prisma.endorsement.findUnique.mockResolvedValue({
        id: 'end-3',
        policyId: 'pol-1',
        requestedById: 'user-agent-1',
        status: EndorsementStatus.REQUESTED,
      });

      prisma.endorsement.update.mockResolvedValue({
        id: 'end-3',
        status: EndorsementStatus.REJECTED,
      });

      const result = await service.rejectEndorsement(
        'end-3',
        'Incomplete KYC documents',
        'user-underwriter-2',
      );

      expect(result.status).toBe(EndorsementStatus.REJECTED);
      expect(prisma.endorsement.update).toHaveBeenCalledWith({
        where: { id: 'end-3' },
        data: expect.objectContaining({
          status: EndorsementStatus.REJECTED,
          rejectionReason: 'Incomplete KYC documents',
        }),
      });
      expect(prisma.policy.update).toHaveBeenCalledWith({
        where: { id: 'pol-1' },
        data: { hasPendingApproval: false },
      });
      expect(prisma.endorsementHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          endorsementId: 'end-3',
          status: EndorsementStatus.REJECTED,
          comments: 'Incomplete KYC documents',
          performedById: 'user-underwriter-2',
        }),
      });
    });
  });
});
