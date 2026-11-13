import { ForbiddenException } from '@nestjs/common';
import { RenewalAnalyticsService } from './renewal-analytics.service';

describe('RenewalAnalyticsService tenant isolation', () => {
  const prisma = {
    policy: { count: jest.fn() },
    policyRenewal: { count: jest.fn() },
  } as any;
  const service = new RenewalAnalyticsService(prisma);

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.policy.count.mockResolvedValue(0);
    prisma.policyRenewal.count.mockResolvedValue(0);
  });

  it('scopes renewal totals through the owning policy company', async () => {
    await service.getOverview({
      id: 'admin-1',
      companyId: 'company-A',
      roles: [],
    } as any);

    expect(prisma.policyRenewal.count).toHaveBeenCalledWith({
      where: { policy: { companyId: 'company-A' } },
    });
  });

  it('does not run any analytics query without a company context', async () => {
    await expect(
      service.getOverview({ id: 'admin-no-company', roles: [] } as any),
    ).rejects.toThrow(ForbiddenException);

    expect(prisma.policy.count).not.toHaveBeenCalled();
    expect(prisma.policyRenewal.count).not.toHaveBeenCalled();
  });
});
