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
});
