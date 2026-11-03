import { ConflictException } from '@nestjs/common';
import {
  AgentExternalCodeStatus,
  AgentIdentifierVerificationStatus,
  RoleType,
} from '@prisma/client';
import { AgentIdentityResolverService } from './agent-identity-resolver.service';
import { AgentIdentifierType } from './dto/agent-external-code.dto';

describe('AgentIdentityResolverService', () => {
  let service: AgentIdentityResolverService;
  let prisma: any;

  const actor = {
    userId: 'admin-user',
    companyId: 'company-1',
    organizationId: 'company-1',
    role: RoleType.ADMIN,
  } as any;

  beforeEach(() => {
    prisma = {
      agent: { findFirst: jest.fn(), findMany: jest.fn(), update: jest.fn() },
      agentExternalCode: { findUnique: jest.fn(), findMany: jest.fn(), create: jest.fn(), update: jest.fn() },
      agentExternalCodeHistory: { create: jest.fn(), findMany: jest.fn(), count: jest.fn() },
      user: { findFirst: jest.fn(), findUnique: jest.fn() },
      auditLog: { create: jest.fn() },
      $transaction: jest.fn((callback) => callback(prisma)),
    };
    service = new AgentIdentityResolverService(prisma);
  });

  it('resolves external identifiers only in the supplied namespace and preserves code case', async () => {
    prisma.agentExternalCode.findUnique.mockResolvedValue({
      id: 'code-1',
      companyId: 'company-1',
      codeSystem: 'CLIENT_A',
      normalizedCode: 'IgSk001',
      externalCode: 'IgSk001',
      status: AgentExternalCodeStatus.ACTIVE,
      verificationStatus: AgentIdentifierVerificationStatus.VERIFIED,
      effectiveFrom: null,
      effectiveTo: null,
      agent: {
        id: 'agent-1',
        userId: 'agent-user-1',
        companyId: 'company-1',
        agentCode: 'AGT-000001',
        isActive: true,
        deletedAt: null,
        user: { firstName: 'Asha', lastName: 'Patel', branch: null },
      },
    });

    const result = await service.resolveAgentIdentifier({
      identifier: '  IgSk001  ',
      identifierType: AgentIdentifierType.EXTERNAL_CODE,
      codeSystem: 'client_a',
    }, actor);

    expect(prisma.agentExternalCode.findUnique).toHaveBeenCalledWith(expect.objectContaining({
      where: {
        companyId_codeSystem_normalizedCode: {
          companyId: 'company-1',
          codeSystem: 'CLIENT_A',
          normalizedCode: 'IgSk001',
        },
      },
    }));
    expect(result.agent.id).toBe('agent-1');
    expect(result.identifier.externalCodeId).toBe('code-1');
  });

  it('blocks an unverified external identifier from assignment', async () => {
    prisma.agentExternalCode.findUnique.mockResolvedValue({
      id: 'code-pending',
      status: AgentExternalCodeStatus.ACTIVE,
      verificationStatus: AgentIdentifierVerificationStatus.PENDING,
    });

    await expect(service.resolveAgentIdentifier({
      identifier: 'IGSK001',
      identifierType: AgentIdentifierType.EXTERNAL_CODE,
      codeSystem: 'CLIENT_A',
    }, actor)).rejects.toThrow(ConflictException);
  });

  it('rejects an ambiguous legacy code instead of selecting a cross-namespace match', async () => {
    prisma.agent.findFirst.mockResolvedValue({
      id: 'agent-a', userId: 'user-a', agentCode: 'MATCH', companyId: 'company-1', isActive: true, deletedAt: null,
    });
    prisma.user.findFirst
      .mockResolvedValueOnce({ agentProfile: {
        id: 'agent-b', userId: 'user-b', agentCode: 'AGT-B', companyId: 'company-1', isActive: true, deletedAt: null,
      } })
      .mockResolvedValueOnce(null);

    await expect(service.resolveLegacyAgentCode('MATCH', actor)).rejects.toThrow(ConflictException);
  });

  it('records registration history and an audit row in the same transaction', async () => {
    prisma.agent.findFirst.mockResolvedValue({
      id: 'agent-1', companyId: 'company-1', isActive: true, deletedAt: null, user: {},
    });
    prisma.agentExternalCode.findMany.mockResolvedValue([]);
    prisma.agentExternalCode.create.mockResolvedValue({
      id: 'code-1', companyId: 'company-1', agentId: 'agent-1', externalCode: 'IGSK001',
      normalizedCode: 'IGSK001', codeSystem: 'CLIENT_A', status: AgentExternalCodeStatus.ACTIVE,
      isPrimary: true, verificationStatus: AgentIdentifierVerificationStatus.PENDING,
      createdAt: new Date(), updatedAt: new Date(),
    });

    await service.registerExternalCode('agent-1', {
      externalCode: ' IGSK001 ', codeSystem: 'client_a', isPrimary: true,
    } as any, actor, 'correlation-1');

    expect(prisma.agentExternalCode.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        externalCode: 'IGSK001', normalizedCode: 'IGSK001', codeSystem: 'CLIENT_A',
      }),
    });
    expect(prisma.agentExternalCodeHistory.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ action: 'CREATED', correlationId: 'correlation-1' }),
    }));
    expect(prisma.auditLog.create).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({ entity: 'AgentExternalCode', correlationId: 'correlation-1' }),
    }));
  });
});
