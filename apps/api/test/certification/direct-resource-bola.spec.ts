import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { ResourceAuthorizationService } from '../../src/common/services/resource-authorization.service';

describe('Authoritative Direct Resource BOLA Certification Suite', () => {
  let authzService: ResourceAuthorizationService;

  beforeEach(() => {
    authzService = new ResourceAuthorizationService();
  });

  const agent1 = {
    userId: 'agent-1-id',
    agentId: 'agent-profile-1',
    companyId: 'company-a',
    organizationId: 'company-a',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    status: UserStatus.ACTIVE,
  };

  const agent2 = {
    userId: 'agent-2-id',
    agentId: 'agent-profile-2',
    companyId: 'company-a',
    organizationId: 'company-a',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    status: UserStatus.ACTIVE,
  };

  describe('Direct Resource ID vs List Authorization Checks', () => {
    it('GET /policies/:id: blocks Agent 1 from reading Agent 2 policy even within same company', () => {
      const policyAgent2 = {
        id: 'pol-2-uuid',
        companyId: 'company-a',
        createdById: 'agent-2-id',
        agentId: 'agent-profile-2',
      };
      expect(() =>
        authzService.authorize(agent1 as any, 'POLICY', 'READ', policyAgent2),
      ).toThrow(ForbiddenException);
    });

    it('PATCH /policies/:id: blocks Agent 1 from updating Agent 2 policy', () => {
      const policyAgent2 = {
        id: 'pol-2-uuid',
        companyId: 'company-a',
        createdById: 'agent-2-id',
        agentId: 'agent-profile-2',
      };
      expect(() =>
        authzService.authorize(agent1 as any, 'POLICY', 'UPDATE', policyAgent2),
      ).toThrow(ForbiddenException);
    });

    it('POST /policies/:id/cancel: blocks Agent from cancelling policies', () => {
      expect(() =>
        authzService.authorize(agent1 as any, 'POLICY', 'DELETE'),
      ).toThrow(ForbiddenException);
    });

    it('GET /claims/:id: blocks Agent 1 from reading Agent 2 claim', () => {
      const claimAgent2 = {
        id: 'clm-2-uuid',
        companyId: 'company-a',
        createdById: 'agent-2-id',
        agentId: 'agent-profile-2',
      };
      expect(() =>
        authzService.authorize(agent1 as any, 'CLAIM', 'READ', claimAgent2),
      ).toThrow(ForbiddenException);
    });

    it('POST /claims/:id/approve: blocks Agent from approving claim', () => {
      expect(() =>
        authzService.authorize(agent1 as any, 'CLAIM', 'APPROVE'),
      ).toThrow(ForbiddenException);
    });

    it('GET /documents/:id/download: blocks Agent 1 from accessing Agent 2 document', () => {
      const docAgent2 = {
        id: 'doc-2-uuid',
        companyId: 'company-a',
        createdById: 'agent-2-id',
      };
      expect(() =>
        authzService.authorize(agent1 as any, 'DOCUMENT', 'READ', docAgent2),
      ).toThrow(ForbiddenException);
    });
  });
});
