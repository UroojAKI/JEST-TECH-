import { Test, TestingModule } from '@nestjs/testing';
import { LeadAssignmentService } from './lead-assignment.service';
import { PrismaService } from '../../../database/prisma.service';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { RoleType, UserStatus } from '@prisma/client';
import {
  ForbiddenException,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';

describe('LeadAssignmentService (Iteration 11)', () => {
  let service: LeadAssignmentService;
  let prisma: any;
  let authzService: ResourceAuthorizationService;

  beforeEach(async () => {
    authzService = new ResourceAuthorizationService();
    prisma = {
      lead: {
        findUnique: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      agent: { findFirst: jest.fn().mockResolvedValue(null) },
      agentAssignmentHistory: {
        create: jest.fn().mockResolvedValue({ id: 'assignment-history-1' }),
      },
      user: {
        findUnique: jest.fn(),
        findMany: jest.fn(),
      },
      activity: {
        create: jest.fn(),
      },
      auditLog: {
        create: jest.fn(),
      },
      $transaction: jest.fn((callback) => callback(prisma)),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadAssignmentService,
        { provide: PrismaService, useValue: prisma },
        { provide: ResourceAuthorizationService, useValue: authzService },
      ],
    }).compile();

    service = module.get<LeadAssignmentService>(LeadAssignmentService);
  });

  const createActor = (
    role: RoleType,
    branchId = 'branch-1',
    teamId = 'team-1',
  ): ActorContext => ({
    userId: 'usr-manager-1',
    email: 'manager@jest.com',
    firstName: 'Manager',
    lastName: 'Boss',
    organizationId: 'org-1',
    companyId: 'org-1',
    branchId,
    teamId,
    role,
    roles: [role],
    permissions: [],
    workspaces: ['SALES'],
    status: UserStatus.ACTIVE,
  });

  const mockLead = {
    id: 'lead-1',
    leadCode: 'LEAD-101',
    assignedToId: 'old-agent',
    deletedAt: null,
  };

  describe('Hierarchy Boundary Enforcement in assignLead', () => {
    it('should successfully assign lead when Team Leader assigns to agent in same team', async () => {
      const actor = createActor(RoleType.BACK_OFFICE, 'branch-1', 'team-1');
      const targetAgent = {
        id: 'agent-1',
        firstName: 'John',
        lastName: 'Agent',
        branchId: 'branch-1',
        teamId: 'team-1', // Same team!
        status: UserStatus.ACTIVE,
      };

      prisma.lead.findUnique.mockResolvedValue(mockLead);
      prisma.user.findUnique.mockResolvedValue(targetAgent);
      prisma.lead.update.mockResolvedValue({
        ...mockLead,
        assignedToId: 'agent-1',
      });

      const result = await service.assignLead('lead-1', 'agent-1', actor);

      expect(result.assignedToId).toBe('agent-1');
      expect(prisma.activity.create).toHaveBeenCalled();
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });

    it('stores canonical Agent identity and immutable assignment history', async () => {
      const actor = createActor(RoleType.BACK_OFFICE);
      prisma.lead.findUnique.mockResolvedValue({
        ...mockLead,
        companyId: actor.companyId,
        agentId: null,
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-agent-1',
        firstName: 'John',
        lastName: 'Agent',
        companyId: actor.companyId,
        branchId: 'branch-1',
        teamId: 'team-1',
        status: UserStatus.ACTIVE,
      });
      prisma.agent.findFirst.mockResolvedValue({ id: 'canonical-agent-1' });
      prisma.lead.update.mockResolvedValue({
        ...mockLead,
        assignedToId: 'user-agent-1',
        agentId: 'canonical-agent-1',
      });

      await service.assignLead('lead-1', 'user-agent-1', actor, 'corr-123');

      expect(prisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            assignedToId: 'user-agent-1',
            agentId: 'canonical-agent-1',
            agentExternalCodeId: null,
          }),
        }),
      );
      expect(prisma.agentAssignmentHistory.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            entityType: 'LEAD',
            entityId: 'lead-1',
            newAgentId: 'canonical-agent-1',
            correlationId: 'corr-123',
          }),
        }),
      );
    });

    it('should reject assignment when Agent attempts to assign lead', async () => {
      const actor = createActor(RoleType.AGENT, 'branch-1', 'team-1');
      const targetAgent = {
        id: 'agent-2',
        branchId: 'branch-1',
        teamId: 'team-2',
        status: UserStatus.ACTIVE,
      };

      prisma.lead.findUnique.mockResolvedValue(mockLead);
      prisma.user.findUnique.mockResolvedValue(targetAgent);

      await expect(
        service.assignLead('lead-1', 'agent-2', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should successfully assign lead when Branch Manager assigns to any agent in same branch', async () => {
      const actor = createActor(RoleType.BACK_OFFICE, 'branch-1', null as any);
      const targetAgent = {
        id: 'agent-3',
        firstName: 'Sarah',
        lastName: 'Agent',
        branchId: 'branch-1', // Same branch!
        teamId: 'team-2',
        status: UserStatus.ACTIVE,
      };

      prisma.lead.findUnique.mockResolvedValue(mockLead);
      prisma.user.findUnique.mockResolvedValue(targetAgent);
      prisma.lead.update.mockResolvedValue({
        ...mockLead,
        assignedToId: 'agent-3',
      });

      const result = await service.assignLead('lead-1', 'agent-3', actor);
      expect(result.assignedToId).toBe('agent-3');
    });

    it('should reject assignment when Back Office assigns to agent in different organization', async () => {
      const actor = createActor(RoleType.BACK_OFFICE, 'branch-1', null as any);
      const targetAgent = {
        id: 'agent-4',
        branchId: 'branch-2',
        companyId: 'org-different',
        status: UserStatus.ACTIVE,
      };

      prisma.lead.findUnique.mockResolvedValue(mockLead);
      prisma.user.findUnique.mockResolvedValue(targetAgent);

      await expect(
        service.assignLead('lead-1', 'agent-4', actor),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should reject assignment when target agent is inactive', async () => {
      const actor = createActor(RoleType.BACK_OFFICE, 'branch-1', null as any);
      const targetAgent = {
        id: 'agent-5',
        branchId: 'branch-1',
        status: UserStatus.INACTIVE, // Inactive!
      };

      prisma.lead.findUnique.mockResolvedValue(mockLead);
      prisma.user.findUnique.mockResolvedValue(targetAgent);

      await expect(
        service.assignLead('lead-1', 'agent-5', actor),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('autoAssignRoundRobin', () => {
    it('should select the agent with lowest active workload in the branch', async () => {
      const actor = createActor(RoleType.BACK_OFFICE, 'branch-1', null as any);
      const agentBusy = {
        id: 'agent-busy',
        firstName: 'Busy',
        lastName: 'Guy',
        leadsAssigned: [{ id: 'l1' }, { id: 'l2' }, { id: 'l3' }], // 3 leads
      };
      const agentFree = {
        id: 'agent-free',
        firstName: 'Free',
        lastName: 'Guy',
        leadsAssigned: [{ id: 'l4' }], // 1 lead
      };

      prisma.lead.findUnique.mockResolvedValue(mockLead);
      prisma.user.findMany.mockResolvedValue([agentBusy, agentFree]);
      prisma.lead.update.mockResolvedValue({
        ...mockLead,
        assignedToId: 'agent-free',
      });

      const result = await service.autoAssignRoundRobin('lead-1', actor);

      expect(result.assignedToId).toBe('agent-free');
      expect(prisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ assignedToId: 'agent-free' }),
        }),
      );
    });
  });

  describe('bulkAssign', () => {
    it('should update all leads atomically and log audit event', async () => {
      const actor = createActor(RoleType.BACK_OFFICE, 'branch-1', null as any);
      const targetAgent = {
        id: 'agent-bulk',
        firstName: 'Bulk',
        lastName: 'Agent',
        branchId: 'branch-1',
        status: UserStatus.ACTIVE,
      };

      prisma.user.findUnique.mockResolvedValue(targetAgent);
      prisma.lead.findMany.mockResolvedValue(
        ['l1', 'l2', 'l3', 'l4', 'l5'].map((id) => ({
          ...mockLead,
          id,
          companyId: actor.companyId,
          agentId: null,
          agentExternalCodeId: null,
        })),
      );

      const result = await service.bulkAssign(
        ['l1', 'l2', 'l3', 'l4', 'l5'],
        'agent-bulk',
        actor,
      );

      expect(result.reassignedCount).toBe(5);
      expect(prisma.lead.update).toHaveBeenCalledTimes(5);
      expect(prisma.lead.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'l1' },
          data: expect.objectContaining({
            assignedToId: 'agent-bulk',
            agentId: null,
            agentExternalCodeId: null,
          }),
        }),
      );
      expect(prisma.auditLog.create).toHaveBeenCalled();
    });
  });
});
