import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { GetPolicyHistoryService } from './get-policy-history.service';
import { ResourceAuthorizationService } from '../../../../common/services/resource-authorization.service';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';

describe('GetPolicyHistoryService (IDOR Defense)', () => {
  let service: GetPolicyHistoryService;
  let mockPolicyRepo: any;
  let authzService: ResourceAuthorizationService;

  beforeEach(() => {
    mockPolicyRepo = {
      findDetail: jest.fn(),
      findHistory: jest.fn(),
    };
    authzService = new ResourceAuthorizationService();
    service = new GetPolicyHistoryService(mockPolicyRepo, authzService);
  });

  const createActor = (overrides: Partial<ActorContext>): ActorContext => ({
    userId: 'usr-agent-a',
    email: 'agent.a@jest.com',
    firstName: 'Agent',
    lastName: 'A',
    organizationId: 'org-mumbai',
    companyId: 'org-mumbai',
    branchId: 'branch-andheri',
    branchCode: 'ANDHERI',
    departmentId: 'dept-sales',
    teamId: 'team-motor-a',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    permissions: ['policy.read'],
    workspaces: ['SALES'],
    status: UserStatus.ACTIVE,
    ...overrides,
  });

  it('allows an actor to view history of their own policy', async () => {
    const actor = createActor({ userId: 'usr-agent-a' });
    const policy = {
      id: 'pol-1',
      createdById: 'usr-agent-a',
      organizationId: 'org-mumbai',
      branchId: 'branch-andheri',
      deletedAt: null,
    };
    mockPolicyRepo.findDetail.mockResolvedValue(policy);
    mockPolicyRepo.findHistory.mockResolvedValue([
      {
        id: 'hist-1',
        status: 'ISSUED',
        comments: 'Initial issuance',
        createdById: 'usr-agent-a',
        createdAt: new Date(),
      },
    ]);

    const result = await service.execute('pol-1', actor);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('hist-1');
  });

  it('strictly blocks an agent from viewing policy history of another agent (IDOR Attack Blocked)', async () => {
    const rogueActor = createActor({ userId: 'usr-agent-rogue' });
    const policy = {
      id: 'pol-victim',
      createdById: 'usr-agent-victim',
      organizationId: 'org-mumbai',
      branchId: 'branch-andheri',
      deletedAt: null,
    };
    mockPolicyRepo.findDetail.mockResolvedValue(policy);

    await expect(service.execute('pol-victim', rogueActor)).rejects.toThrow(
      ForbiddenException,
    );
    expect(mockPolicyRepo.findHistory).not.toHaveBeenCalled();
  });
});
