import { Test, TestingModule } from '@nestjs/testing';
import { LeadLifecycleService } from './lead-lifecycle.service';
import { PrismaService } from '../../../database/prisma.service';
import { LeadStatus, RoleType } from '@prisma/client';
import { BadRequestException, NotFoundException } from '@nestjs/common';

describe('LeadLifecycleService', () => {
  let service: LeadLifecycleService;
  let prisma: any;

  const mockLead = {
    id: 'lead-uuid-1',
    leadCode: 'LEAD-0001',
    status: LeadStatus.NEW,
    quotations: [],
    motorQuotations: [],
    vehicles: [],
    policies: [],
    backOfficeTasks: [],
    deletedAt: null,
  };

  beforeEach(async () => {
    prisma = {
      lead: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      policy: {
        count: jest.fn(),
      },
      leadStageHistory: {
        create: jest.fn(),
      },
      backOfficeTask: {
        findFirst: jest.fn(),
        count: jest.fn(),
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadLifecycleService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LeadLifecycleService>(LeadLifecycleService);
  });

  describe('getAllowedTransitions', () => {
    it('should return valid next states from NEW', () => {
      const allowed = service.getAllowedTransitions(LeadStatus.NEW);
      expect(allowed).toContain(LeadStatus.CONTACTED);
      expect(allowed).toContain(LeadStatus.LOST);
      expect(allowed).not.toContain(LeadStatus.CONVERTED);
    });

    it('should return empty list for CONVERTED terminal state', () => {
      expect(service.getAllowedTransitions(LeadStatus.CONVERTED)).toEqual([]);
    });
  });

  describe('validateTransition', () => {
    it('should reject illegal jump from NEW directly to CONVERTED', async () => {
      prisma.lead.findUnique.mockResolvedValue(mockLead);

      await expect(
        service.validateTransition('lead-uuid-1', LeadStatus.CONVERTED),
      ).rejects.toThrow(BadRequestException);
    });

    it('should reject transition to QUOTATION if no vehicle is linked', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...mockLead,
        status: LeadStatus.QUALIFIED,
        vehicles: [],
      });

      await expect(
        service.validateTransition('lead-uuid-1', LeadStatus.QUOTATION),
      ).rejects.toThrow(BadRequestException);
    });

    it('should allow transition to QUOTATION when a vehicle exists', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...mockLead,
        status: LeadStatus.QUALIFIED,
        vehicles: [{ id: 'veh-1' }],
      });

      const result = await service.validateTransition('lead-uuid-1', LeadStatus.QUOTATION);
      expect(result.valid).toBe(true);
    });

    it('should reject transition to CONVERTED without an issued policy', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...mockLead,
        status: LeadStatus.BACK_OFFICE,
        policies: [],
      });
      prisma.policy.count.mockResolvedValue(0);

      await expect(
        service.validateTransition('lead-uuid-1', LeadStatus.CONVERTED),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('transition', () => {
    it('should execute valid state change and record stage history', async () => {
      prisma.lead.findUnique.mockResolvedValue(mockLead);
      prisma.lead.update.mockResolvedValue({
        ...mockLead,
        status: LeadStatus.CONTACTED,
      });

      const result = await service.transition(
        'lead-uuid-1',
        LeadStatus.CONTACTED,
        { id: 'user-1', role: RoleType.AGENT } as any,
        'Initial customer outreach complete',
      );

      expect(result.success).toBe(true);
      expect(result.toStatus).toBe(LeadStatus.CONTACTED);
      expect(prisma.leadStageHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          leadId: 'lead-uuid-1',
          fromStage: LeadStatus.NEW,
          toStage: LeadStatus.CONTACTED,
          performedById: 'user-1',
          remarks: 'Initial customer outreach complete',
        }),
      });
    });

    it('should auto-create BackOfficeTask when entering BACK_OFFICE', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...mockLead,
        status: LeadStatus.POST_PAYMENT,
      });
      prisma.lead.update.mockResolvedValue({
        ...mockLead,
        status: LeadStatus.BACK_OFFICE,
      });
      prisma.backOfficeTask.findFirst.mockResolvedValue(null);
      prisma.backOfficeTask.count.mockResolvedValue(0);
      prisma.backOfficeTask.create.mockResolvedValue({ id: 'bot-1' });

      await service.transition(
        'lead-uuid-1',
        LeadStatus.BACK_OFFICE,
        { id: 'user-1', role: RoleType.AGENT } as any,
      );

      expect(prisma.backOfficeTask.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          leadId: 'lead-uuid-1',
          taskType: 'POLICY_ISSUANCE',
          taskCode: 'BOT-00001',
          status: 'PENDING',
        }),
      });
    });
  });
});
