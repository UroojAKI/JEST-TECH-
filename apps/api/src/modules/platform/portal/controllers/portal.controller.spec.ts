import { RoleType } from '@prisma/client';
import { PortalController } from './portal.controller';

describe('PortalController tenant scoping', () => {
  const companyId = 'tenant-a';
  const user = {
    id: 'agent-user-a',
    companyId,
    agentId: 'agent-a',
    role: RoleType.AGENT,
    roles: [RoleType.AGENT],
  } as any;

  const prisma = {
    agent: { findFirst: jest.fn().mockResolvedValue({ id: 'agent-a', agentCode: 'A-1' }) },
    lead: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    policy: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    quotation: { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) },
    claim: { count: jest.fn().mockResolvedValue(0) },
    motorInspection: { count: jest.fn().mockResolvedValue(0) },
    policyPayment: {
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 0 } }),
      findMany: jest.fn().mockResolvedValue([]),
    },
    contact: { findMany: jest.fn().mockResolvedValue([]) },
  };

  const controller = new PortalController(prisma as any);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.agent.findFirst.mockResolvedValue({ id: 'agent-a', agentCode: 'A-1' });
  });

  it('applies the caller company to portal reads and related payment filters', async () => {
    await controller.getAgentMetrics(user);
    await controller.getAgentCustomers(user);
    await controller.getAgentLeads(user);
    await controller.getAgentPolicies(user);
    await controller.getAgentRenewals(user);
    await controller.getAgentCommissions(user);
    await controller.compareQuotations(user, 'quote-a');

    expect(prisma.lead.count.mock.calls[0][0].where.companyId).toBe(companyId);
    expect(prisma.motorInspection.count.mock.calls[0][0].where.companyId).toBe(companyId);
    expect(prisma.policyPayment.aggregate.mock.calls[0][0].where.policy.is.companyId).toBe(companyId);
    expect(prisma.contact.findMany.mock.calls[0][0].where.companyId).toBe(companyId);
    expect(prisma.lead.findMany.mock.calls[0][0].where.companyId).toBe(companyId);
    expect(prisma.policy.findMany.mock.calls.map(([query]) => query.where.companyId)).toEqual([
      companyId,
      companyId,
    ]);
    expect(prisma.policyPayment.findMany.mock.calls[0][0].where.policy.is.companyId).toBe(companyId);
    expect(prisma.quotation.findMany.mock.calls[0][0].where.companyId).toBe(companyId);
  });

  it('passes the authenticated user before the quotation id from the POST route', async () => {
    const compare = jest.spyOn(controller, 'compareQuotations').mockResolvedValue({ quotes: [] } as any);

    await controller.compareQuotationsPost({ quotationId: 'quote-a' } as any, user);

    expect(compare).toHaveBeenCalledWith(user, 'quote-a');
  });
});
