import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { RoleType, UserStatus } from '@prisma/client';
import { AnalyticsController } from './analytics.controller';
import { LeadAnalyticsService } from '../services/lead-analytics.service';
import { PolicyAnalyticsService } from '../services/policy-analytics.service';
import { ClaimAnalyticsService } from '../services/claim-analytics.service';
import { RevenueAnalyticsService } from '../services/revenue-analytics.service';
import { RenewalAnalyticsService } from '../services/renewal-analytics.service';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { RequestUser } from '../../auth/decorators/current-user.decorator';

describe('AnalyticsController Security & Delegation Spec', () => {
  let controller: AnalyticsController;
  let reflector: Reflector;

  const mockLeadService = { getOverview: jest.fn().mockResolvedValue({ total: 10 }) };
  const mockPolicyService = { getOverview: jest.fn().mockResolvedValue({ total: 5 }) };
  const mockClaimService = { getOverview: jest.fn().mockResolvedValue({ total: 2 }) };
  const mockRevenueService = {
    getOverview: jest.fn().mockResolvedValue({ total: 100000 }),
    getMonthlyTrend: jest.fn().mockResolvedValue([]),
  };
  const mockRenewalService = { getOverview: jest.fn().mockResolvedValue({ total: 3 }) };

  const mockAdmin: RequestUser = {
    id: 'admin-1',
    userId: 'admin-1',
    email: 'admin@jestpolicy.com',
    role: RoleType.ADMIN,
    firstName: 'System',
    lastName: 'Admin',
    organizationId: 'org-1',
    companyId: 'org-1',
    roles: [RoleType.ADMIN],
    permissions: ['*'],
    workspaces: ['ADMIN'],
    status: UserStatus.ACTIVE,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AnalyticsController],
      providers: [
        Reflector,
        { provide: LeadAnalyticsService, useValue: mockLeadService },
        { provide: PolicyAnalyticsService, useValue: mockPolicyService },
        { provide: ClaimAnalyticsService, useValue: mockClaimService },
        { provide: RevenueAnalyticsService, useValue: mockRevenueService },
        { provide: RenewalAnalyticsService, useValue: mockRenewalService },
      ],
    }).compile();

    controller = module.get<AnalyticsController>(AnalyticsController);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should restrict all Analytics endpoints to ADMIN and BACK_OFFICE at controller level', () => {
    const roles = reflector.get<string[]>(ROLES_KEY, AnalyticsController);
    expect(roles).toBeDefined();
    expect(roles).toContain(RoleType.ADMIN);
    expect(roles).toContain(RoleType.BACK_OFFICE);
    // AGENT must NOT have access to company-wide analytics
    expect(roles).not.toContain(RoleType.AGENT);
  });

  it('should delegate getLeadsAnalytics to LeadAnalyticsService', async () => {
    const result = await controller.getLeadsAnalytics(mockAdmin);
    expect(result).toEqual({ total: 10 });
    expect(mockLeadService.getOverview).toHaveBeenCalledWith(mockAdmin);
  });

  it('should delegate getRevenueAnalytics to RevenueAnalyticsService', async () => {
    const result = await controller.getRevenueAnalytics(mockAdmin);
    expect(result).toEqual({ total: 100000 });
    expect(mockRevenueService.getOverview).toHaveBeenCalledWith(mockAdmin);
  });
});
