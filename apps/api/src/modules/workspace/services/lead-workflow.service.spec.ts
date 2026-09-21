import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LeadWorkflowService, WorkflowStage } from './lead-workflow.service';
import { PrismaService } from '../../../database/prisma.service';

describe('LeadWorkflowService', () => {
  let service: LeadWorkflowService;
  let prisma: {
    lead: {
      findUnique: jest.Mock;
      update: jest.Mock;
    };
    leadStageHistory: {
      create: jest.Mock;
      findMany: jest.Mock;
    };
  };

  beforeEach(async () => {
    prisma = {
      lead: {
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      leadStageHistory: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadWorkflowService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<LeadWorkflowService>(LeadWorkflowService);
  });

  const mockLead = {
    id: 'lead-123',
    currentWorkflowStep: 'ASSIGNED',
    status: 'NEW',
    contact: { phone: '9876543210', email: 'test@example.com' },
    callLogs: [],
    meetingLogs: [],
    activities: [],
    notes: [],
    quotations: [],
    stageHistory: [],
    referrals: [],
  };

  describe('transitionStage', () => {
    it('throws NotFoundException if lead does not exist', async () => {
      prisma.lead.findUnique.mockResolvedValue(null);

      await expect(
        service.transitionStage('lead-404', 'CONTACTED', {
          id: 'user-1',
          role: 'AGENT',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for invalid target workflow stage', async () => {
      prisma.lead.findUnique.mockResolvedValue(mockLead);

      await expect(
        service.transitionStage('lead-123', 'INVALID_STAGE' as any, {
          id: 'user-1',
          role: 'AGENT',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('blocks AGENT from skipping steps (throws ForbiddenException)', async () => {
      prisma.lead.findUnique.mockResolvedValue(mockLead);

      await expect(
        service.transitionStage('lead-123', 'QUOTATION', {
          id: 'agent-1',
          role: 'AGENT',
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks AGENT from moving to CONTACTED without required interaction log', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...mockLead,
        callLogs: [],
        meetingLogs: [],
        activities: [],
      });

      await expect(
        service.transitionStage('lead-123', 'CONTACTED', {
          id: 'agent-1',
          role: 'AGENT',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('allows AGENT to move to CONTACTED when call log exists', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...mockLead,
        callLogs: [{ id: 'call-1' }],
      });
      prisma.lead.update.mockResolvedValue({
        ...mockLead,
        currentWorkflowStep: 'CONTACTED',
      });
      prisma.leadStageHistory.create.mockResolvedValue({ id: 'hist-1' });

      const result = await service.transitionStage('lead-123', 'CONTACTED', {
        id: 'agent-1',
        role: 'AGENT',
      });

      expect(result.toStage).toBe('CONTACTED');
      expect(result.isOverride).toBe(false);
      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-123' },
        data: expect.objectContaining({ currentWorkflowStep: 'CONTACTED' }),
      });
    });

    it('allows BACK_OFFICE to override prerequisites with valid overrideReason', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...mockLead,
        callLogs: [],
      });
      prisma.lead.update.mockResolvedValue({
        ...mockLead,
        currentWorkflowStep: 'CONTACTED',
      });
      prisma.leadStageHistory.create.mockResolvedValue({ id: 'hist-1' });

      const result = await service.transitionStage(
        'lead-123',
        'CONTACTED',
        { id: 'bo-1', role: 'BACK_OFFICE' },
        'Client was contacted directly via email offline',
        'Approved by supervisor',
      );

      expect(result.toStage).toBe('CONTACTED');
      expect(result.isOverride).toBe(true);
      expect(prisma.leadStageHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          isOverride: true,
          overrideReason: 'Client was contacted directly via email offline',
          performerRole: 'BACK_OFFICE',
        }),
      });
    });

    it('allows ADMIN to skip stages with mandatory overrideReason', async () => {
      prisma.lead.findUnique.mockResolvedValue({
        ...mockLead,
        quotations: [{ id: 'q-1', status: 'DRAFT' }],
      });
      prisma.lead.update.mockResolvedValue({
        ...mockLead,
        currentWorkflowStep: 'PROPOSAL',
      });
      prisma.leadStageHistory.create.mockResolvedValue({ id: 'hist-1' });

      const result = await service.transitionStage(
        'lead-123',
        'PROPOSAL',
        { id: 'admin-1', role: 'ADMIN' },
        'Corporate fast-track workflow approved',
      );

      expect(result.toStage).toBe('PROPOSAL');
      expect(result.isOverride).toBe(true);
    });

    it('rejects ADMIN skip stage if overrideReason is too short (< 5 chars)', async () => {
      prisma.lead.findUnique.mockResolvedValue(mockLead);

      await expect(
        service.transitionStage(
          'lead-123',
          'QUOTATION',
          { id: 'admin-1', role: 'ADMIN' },
          'skip', // < 5 chars
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
