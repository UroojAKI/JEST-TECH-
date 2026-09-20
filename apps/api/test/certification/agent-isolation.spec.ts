import { ForbiddenException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { ResourceAuthorizationService } from '../../src/common/services/resource-authorization.service';

describe('Authoritative Agent Isolation & Tampering Certification Suite', () => {
  let authzService: ResourceAuthorizationService;

  beforeEach(() => {
    authzService = new ResourceAuthorizationService();
  });

  const agentA = {
    userId: 'agent-a-user',
    agentId: 'agent-a-profile',
    companyId: 'company-shared',
    organizationId: 'company-shared',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    status: UserStatus.ACTIVE,
  };

  const agentB = {
    userId: 'agent-b-user',
    agentId: 'agent-b-profile',
    companyId: 'company-shared',
    organizationId: 'company-shared',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
    status: UserStatus.ACTIVE,
  };

  it('Agent A cannot modify Quote owned by Agent B while supplying Agent B contactId', () => {
    const quoteB = {
      id: 'quote-b-1',
      companyId: 'company-shared',
      createdById: agentB.userId,
      agentId: agentB.agentId,
      contactId: 'contact-b-id',
    };
    expect(() =>
      authzService.authorize(agentA as any, 'QUOTATION', 'UPDATE', quoteB),
    ).toThrow(ForbiddenException);
  });

  it('Agent A cannot issue Policy using Agent B quotation', () => {
    expect(() =>
      authzService.authorize(agentA as any, 'POLICY', 'ISSUE'),
    ).toThrow(ForbiddenException);
  });

  it('Agent A cannot create Claim against Agent B policy without authorization', () => {
    const policyB = {
      id: 'pol-b-1',
      companyId: 'company-shared',
      createdById: agentB.userId,
      agentId: agentB.agentId,
    };
    expect(() =>
      authzService.authorize(agentA as any, 'POLICY', 'READ', policyB),
    ).toThrow(ForbiddenException);
  });

  it('Agent A cannot perform Renewal actions on Agent B policy', () => {
    const renewalTaskB = {
      id: 'ren-task-b',
      companyId: 'company-shared',
      policy: {
        companyId: 'company-shared',
        createdById: agentB.userId,
        agentId: agentB.agentId,
      },
    };
    expect(() =>
      authzService.authorize(agentA as any, 'RENEWAL_TASK', 'READ', renewalTaskB),
    ).toThrow(ForbiddenException);
  });

  it('Agent A cannot download Agent B customer documents', () => {
    const documentB = {
      id: 'doc-b-1',
      companyId: 'company-shared',
      createdById: agentB.userId,
    };
    expect(() =>
      authzService.authorize(agentA as any, 'DOCUMENT', 'READ', documentB),
    ).toThrow(ForbiddenException);
  });
});
