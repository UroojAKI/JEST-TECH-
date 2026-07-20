import { Test, TestingModule } from '@nestjs/testing';
import { DashboardController } from '../controllers/dashboard.controller';
import { DashboardService } from '../services/dashboard.service';
import { RoleType } from '@prisma/client';
import { RequestUser } from '../../auth/decorators/current-user.decorator';
import { CACHE_MANAGER } from '@nestjs/cache-manager';

describe('DashboardController', () => {
  let controller: DashboardController;
  let service: DashboardService;

  const mockUser: RequestUser = {
    id: 'user-123',
    email: 'admin@jestpolicy.com',
    role: RoleType.ADMIN,
  };

  const mockDashboardData = {
    role: 'ADMIN',
    kpis: {
      revenue: 1250000,
      policiesCount: 450,
      claimsCount: 8,
      lossRatio: '1.8%',
      renewalRate: '86.4%',
    },
    charts: {
      funnel: [],
    },
    widgets: {
      renewals: {
        expiring20: 0,
        expiring30: 0,
        expiring45: 0,
        expired: 0,
        renewed: 0,
      },
      activities: [],
    },
    layout: [],
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DashboardController],
      providers: [
        {
          provide: DashboardService,
          useValue: {
            getDashboard: jest.fn().mockResolvedValue(mockDashboardData),
          },
        },
        { provide: CACHE_MANAGER, useValue: {} },
      ],
    }).compile();

    controller = module.get<DashboardController>(DashboardController);
    service = module.get<DashboardService>(DashboardService);
  });

  describe('Dashboard Fetching', () => {
    it('should return role-specific dashboard data for the active user', async () => {
      const result = await controller.getDashboard(mockUser);
      expect(result).toEqual(mockDashboardData);
      expect(service.getDashboard).toHaveBeenCalledWith(
        mockUser.role,
        mockUser.id,
      );
    });

    it('should return super-admin dashboard data', async () => {
      const result = await controller.getSuperAdminDashboard(mockUser);
      expect(result).toEqual(mockDashboardData);
      expect(service.getDashboard).toHaveBeenCalledWith(
        RoleType.SUPER_ADMIN,
        mockUser.id,
      );
    });
  });
});
