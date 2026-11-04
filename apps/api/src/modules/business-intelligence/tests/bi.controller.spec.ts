import { Test, TestingModule } from '@nestjs/testing';
import { BiController } from '../controllers/bi.controller';
import { BiService } from '../services/bi.service';
import { KpiService } from '../services/kpi.service';
import { ForbiddenException } from '@nestjs/common';
import type { RequestUser } from '../../auth/decorators/current-user.decorator';

describe('BiController (Workstream 3 BI Endpoints & Tenancy)', () => {
  let controller: BiController;

  const mockBiService = {
    getConversionMetrics: jest.fn().mockResolvedValue({ totalLeads: 100 }),
    getRevenueMetrics: jest.fn().mockResolvedValue({ totalPremium: 500000 }),
    getLossRatioMetrics: jest.fn().mockResolvedValue({ lossRatio: 12.5 }),
    getRenewalMetrics: jest.fn().mockResolvedValue({ conversionRate: 75.0 }),
    getSalesMetrics: jest.fn().mockResolvedValue({ policiesIssuedThisMonth: 15 }),
    getGrowthMetrics: jest.fn().mockResolvedValue({ portfolioSize: 500 }),
    getAgentPerformanceAnalytics: jest.fn().mockResolvedValue({ totalAgents: 10, totalGwp: 1200000 }),
    getOperationalActionCentre: jest.fn().mockResolvedValue({ summary: { totalActionItems: 8 } }),
    getCommissionIntelligence: jest.fn().mockResolvedValue({ totalEarned: 250000, totalPaid: 180000 }),
    exportBiReport: jest.fn().mockResolvedValue({
      filename: 'bi-report.csv',
      contentType: 'text/csv',
      data: 'col1,col2\nval1,val2',
    }),
    getKpiValues: jest.fn().mockResolvedValue([]),
  };

  const mockKpiService = {
    listKpis: jest.fn().mockResolvedValue([]),
    createKpi: jest.fn(),
    updateKpi: jest.fn(),
    deleteKpi: jest.fn(),
    seedDefaultKpis: jest.fn(),
  };

  const mockUser: RequestUser = {
    id: 'user-admin-1',
    email: 'admin@company-a.com',
    companyId: 'company-a',
    roles: ['ADMIN'],
  } as any;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BiController],
      providers: [
        { provide: BiService, useValue: mockBiService },
        { provide: KpiService, useValue: mockKpiService },
      ],
    }).compile();

    controller = module.get<BiController>(BiController);
  });

  it('should delegate getAgentPerformance with caller companyId', async () => {
    const res = await controller.getAgentPerformance(mockUser);
    expect(res).toEqual({ totalAgents: 10, totalGwp: 1200000 });
    expect(mockBiService.getAgentPerformanceAnalytics).toHaveBeenCalledWith('company-a');
  });

  it('should delegate getActionCentre with caller companyId', async () => {
    const res = await controller.getActionCentre(mockUser);
    expect(res).toEqual({ summary: { totalActionItems: 8 } });
    expect(mockBiService.getOperationalActionCentre).toHaveBeenCalledWith('company-a');
  });

  it('should delegate getCommissionIntelligence with caller companyId', async () => {
    const res = await controller.getCommissionIntelligence(mockUser);
    expect(res).toEqual({ totalEarned: 250000, totalPaid: 180000 });
    expect(mockBiService.getCommissionIntelligence).toHaveBeenCalledWith('company-a');
  });

  it('should stream CSV export with correct headers', async () => {
    const mockRes: any = {
      setHeader: jest.fn(),
      status: jest.fn().mockReturnThis(),
      send: jest.fn().mockReturnValue('ok'),
    };

    await controller.exportReport('agent-performance', mockUser, mockRes);
    expect(mockBiService.exportBiReport).toHaveBeenCalledWith('agent-performance', 'company-a');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Type', 'text/csv');
    expect(mockRes.setHeader).toHaveBeenCalledWith('Content-Disposition', expect.stringContaining('.csv'));
    expect(mockRes.status).toHaveBeenCalledWith(200);
    expect(mockRes.send).toHaveBeenCalledWith('col1,col2\nval1,val2');
  });

  it('should fail with ForbiddenException if actor has no companyId', async () => {
    const unauthenticatedUser: any = { id: 'user-anon' };
    expect(() => controller.getAgentPerformance(unauthenticatedUser)).toThrow(ForbiddenException);
  });
});
