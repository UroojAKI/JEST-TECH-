import { Test, TestingModule } from '@nestjs/testing';
import { RenewalEngineService } from './renewal-engine.service';
import { PrismaService } from '../../../database/prisma.service';
import { getQueueToken } from '@nestjs/bullmq';
import { PolicyStatus } from '@prisma/client';

describe('RenewalEngineService (Iteration 10)', () => {
  let service: RenewalEngineService;
  let prisma: any;
  let queue: any;

  beforeEach(async () => {
    prisma = {
      policy: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
      },
      renewalTask: {
        create: jest.fn(),
      },
    };

    queue = {
      add: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RenewalEngineService,
        { provide: PrismaService, useValue: prisma },
        { provide: getQueueToken('renewal-reminders'), useValue: queue },
      ],
    }).compile();

    service = module.get<RenewalEngineService>(RenewalEngineService);
  });

  describe('calculateNextNCBSlab', () => {
    it('should correctly increment NCB according to IRDAI slabs', () => {
      expect(service.calculateNextNCBSlab(0)).toBe(20);
      expect(service.calculateNextNCBSlab(20)).toBe(25);
      expect(service.calculateNextNCBSlab(25)).toBe(35);
      expect(service.calculateNextNCBSlab(35)).toBe(45);
      expect(service.calculateNextNCBSlab(45)).toBe(50);
      expect(service.calculateNextNCBSlab(50)).toBe(50);
    });
  });

  describe('findPoliciesRequiringRenewal', () => {
    it('should query active policies expiring within target days without pending tasks', async () => {
      const mockPolicies = [
        { id: 'pol-1', policyNumber: 'POL-1', status: PolicyStatus.ACTIVE },
      ];
      prisma.policy.findMany.mockResolvedValue(mockPolicies);

      const result = await service.findPoliciesRequiringRenewal(30);

      expect(result).toEqual(mockPolicies);
      expect(prisma.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: PolicyStatus.ACTIVE,
          }),
        }),
      );
    });
  });

  describe('createRenewalRecord', () => {
    it('should create a renewal task with due date matching policy expiry', async () => {
      const expiryDate = new Date('2026-10-15');
      prisma.policy.findUnique.mockResolvedValue({
        id: 'pol-1',
        expiryDate,
      });

      await service.createRenewalRecord('pol-1', 'agent-1');

      expect(prisma.renewalTask.create).toHaveBeenCalledWith({
        data: {
          policyId: 'pol-1',
          agentId: 'agent-1',
          dueDate: expiryDate,
          status: 'PENDING',
          priority: 'MEDIUM',
        },
      });
    });
  });

  describe('getRenewalQueue', () => {
    it('should calculate rolled-over NCB and mark urgency correctly', async () => {
      const now = new Date();
      const in5Days = new Date(now.getTime() + 5 * 86400000);

      const mockPolicies = [
        {
          id: 'pol-10',
          policyNumber: 'POL-M-10',
          premiumAmount: 20000,
          expiryDate: in5Days,
          contact: { firstName: 'Amit', lastName: 'Patel', phone: '9876543210' },
          claims: [], // No claims
          quotation: { ncbPercentage: 20, insurerName: 'Tata AIG' },
          renewalTasks: [],
        },
      ];

      prisma.policy.findMany.mockResolvedValue(mockPolicies);

      const result = await service.getRenewalQueue();

      expect(result.data).toHaveLength(1);
      const item = result.data[0];
      expect(item.urgency).toBe('CRITICAL'); // <= 7 days
      expect(item.currentNcb).toBe(20);
      expect(item.nextNcb).toBe(25); // incremented from 20 to 25
      expect(item.estimatedRenewalPremium).toBe(15000); // 20000 * (1 - 0.25)
      expect(result.summary.criticalCount).toBe(1);
    });

    it('should reset NCB to 0 if claims are reported in prior year', async () => {
      const now = new Date();
      const in20Days = new Date(now.getTime() + 20 * 86400000);

      const mockPolicies = [
        {
          id: 'pol-11',
          policyNumber: 'POL-M-11',
          premiumAmount: 20000,
          expiryDate: in20Days,
          contact: { firstName: 'Sara', lastName: 'Ali' },
          claims: [{ id: 'clm-1', status: 'SETTLED' }], // Claim reported!
          quotation: { ncbPercentage: 35 },
          renewalTasks: [],
        },
      ];

      prisma.policy.findMany.mockResolvedValue(mockPolicies);

      const result = await service.getRenewalQueue();

      const item = result.data[0];
      expect(item.urgency).toBe('MEDIUM'); // 20 days
      expect(item.nextNcb).toBe(0); // Reset to 0 due to claim!
      expect(item.estimatedRenewalPremium).toBe(20000);
    });
  });

  describe('triggerManualReminder', () => {
    it('should add immediate reminder job to BullMQ queue', async () => {
      prisma.policy.findUnique.mockResolvedValue({
        id: 'pol-1',
        policyNumber: 'POL-1',
        expiryDate: new Date(),
        contactId: 'c-1',
      });

      const result = await service.triggerManualReminder('pol-1', 'agent-1');

      expect(result.success).toBe(true);
      expect(queue.add).toHaveBeenCalledWith('send-renewal-reminder', expect.objectContaining({
        policyId: 'pol-1',
        isManualTrigger: true,
      }));
    });
  });
});
