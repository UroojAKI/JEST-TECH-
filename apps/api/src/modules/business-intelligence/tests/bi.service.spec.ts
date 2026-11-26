import { Test, TestingModule } from '@nestjs/testing';
import { BiService } from '../services/bi.service';
import { KpiService } from '../services/kpi.service';
import { PrismaService } from '../../../database/prisma.service';
import { WarehouseService } from '../../warehouse/services/warehouse.service';
import { ForbiddenException, NotFoundException } from '@nestjs/common';

describe('BiService & KpiService (Wave 7 Tenancy Isolation & Workstream 3 BI)', () => {
  let service: BiService;
  let kpiService: KpiService;

  const mockPrisma = {
    lead: {
      count: jest.fn().mockResolvedValue(100),
      groupBy: jest.fn().mockResolvedValue([
        { status: 'NEW', _count: { id: 30 } },
        { status: 'CONVERTED', _count: { id: 20 } },
      ]),
    },
    contact: {
      count: jest.fn().mockResolvedValue(40),
    },
    proposal: {
      count: jest.fn().mockResolvedValue(15),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'prop-1',
          proposalNumber: 'PROP-001',
          status: 'APPROVED',
          createdAt: new Date(),
          quotation: {
            customerName: 'Rajesh Sharma',
            totalPremium: 25000,
            motorPaymentRecord: null,
          },
        },
        {
          id: 'prop-2',
          proposalNumber: 'PROP-002',
          status: 'UNDERWRITING_REVIEW',
          createdAt: new Date(),
          quotation: { customerName: 'Anita Gupta', totalPremium: 40000 },
        },
      ]),
    },
    motorInspection: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'insp-1',
          quotationId: 'q-insp-1',
          inspectionCode: 'INSP-001',
          status: 'PENDING',
          createdAt: new Date(),
          quotation: {
            quotationCode: 'MQ-001',
            contact: { firstName: 'Sanjay', lastName: 'Verma' },
          },
        },
      ]),
    },
    policy: {
      count: jest.fn().mockResolvedValue(20),
      findMany: jest.fn().mockResolvedValue([
        {
          productType: 'MOTOR',
          actualPremium: 30000,
          premiumAmount: 30000,
          expiryDate: new Date(Date.now() + 15 * 86400000),
        },
        {
          productType: 'HEALTH',
          actualPremium: 20000,
          premiumAmount: 20000,
          expiryDate: new Date(Date.now() + 35 * 86400000),
        },
      ]),
    },
    policyPayment: {
      count: jest.fn().mockResolvedValue(18),
      aggregate: jest.fn().mockResolvedValue({ _sum: { amount: 500000 } }),
      findMany: jest.fn().mockResolvedValue([
        {
          amount: 50000,
          paymentDate: new Date(),
          policy: {
            quotation: { insurerName: 'HDFC ERGO', productType: 'MOTOR' },
            productType: 'MOTOR',
          },
        },
      ]),
    },
    motorQuotation: {
      count: jest.fn().mockResolvedValue(12),
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'mq-1',
          quotationCode: 'MQ-001',
          status: 'INSPECTION_PENDING',
          customerName: 'Sanjay Verma',
          createdAt: new Date(),
        },
      ]),
    },
    quotation: {
      count: jest.fn().mockResolvedValue(15),
      findMany: jest.fn().mockResolvedValue([]),
    },
    claim: {
      aggregate: jest
        .fn()
        .mockResolvedValue({ _sum: { approvedAmount: 50000 } }),
      findMany: jest.fn().mockResolvedValue([
        {
          approvedAmount: 50000,
          policy: { productType: 'MOTOR' },
        },
      ]),
    },
    policyRenewal: { count: jest.fn().mockResolvedValue(10) },
    user: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'user-agent-1',
          firstName: 'Vikram',
          lastName: 'Patel',
          email: 'vikram.patel@test.com',
          phone: '9876543210',
          branch: { name: 'Mumbai South' },
          agentProfile: { agentCode: 'AGT-MUM-001', agencyName: 'Patel Associates' },
          policiesCreated: [
            { id: 'pol-1', status: 'ACTIVE', actualPremium: 75000, premiumAmount: 75000 },
            { id: 'pol-2', status: 'ISSUED', actualPremium: 45000, premiumAmount: 45000 },
          ],
          leadsAssigned: [
            { id: 'lead-1', status: 'CONVERTED' },
            { id: 'lead-2', status: 'IN_PROGRESS' },
            { id: 'lead-3', status: 'CONVERTED' },
          ],
        },
        {
          id: 'user-agent-2',
          firstName: 'Pooja',
          lastName: 'Mehta',
          email: 'pooja.mehta@test.com',
          branch: { name: 'Pune Central' },
          agentProfile: { agentCode: 'AGT-PUN-002', agencyName: 'Mehta Fin' },
          policiesCreated: [
            { id: 'pol-3', status: 'EXPIRED', actualPremium: 20000, premiumAmount: 20000 },
          ],
          leadsAssigned: [
            { id: 'lead-4', status: 'LOST' },
          ],
        },
      ]),
    },
    commission: {
      findMany: jest.fn().mockResolvedValue([
        {
          userId: 'user-agent-1',
          amount: 12000,
          status: 'PAID',
          user: {
            id: 'user-agent-1',
            firstName: 'Vikram',
            lastName: 'Patel',
            agentProfile: { agentCode: 'AGT-MUM-001' },
          },
        },
        {
          userId: 'user-agent-1',
          amount: 8000,
          status: 'ACCRUED',
          user: {
            id: 'user-agent-1',
            firstName: 'Vikram',
            lastName: 'Patel',
            agentProfile: { agentCode: 'AGT-MUM-001' },
          },
        },
      ]),
    },
    task: {
      findMany: jest.fn().mockResolvedValue([
        {
          id: 'task-1',
          title: 'Client KYC Verification Overdue',
          dueDate: new Date(Date.now() - 2 * 86400000), // 2 days ago
          priority: 'HIGH',
          assignedTo: { firstName: 'Ramesh', lastName: 'Kumar' },
          createdAt: new Date(Date.now() - 5 * 86400000),
        },
      ]),
    },
    backOfficeTask: {
      findMany: jest.fn().mockResolvedValue([]),
    },
    kpiDefinition: {
      findMany: jest.fn().mockResolvedValue([
        {
          key: 'conversion_rate',
          name: 'Conversion Rate',
          formula: 'leads_converted / leads_total * 100',
          unit: 'PERCENTAGE',
          description: 'Overall conversion',
          category: 'sales',
        },
      ]),
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
      count: jest.fn().mockResolvedValue(1),
    },
  };

  const mockWarehouse = {
    getReportingRenewals: jest.fn().mockResolvedValue([]),
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BiService,
        KpiService,
        { provide: PrismaService, useValue: mockPrisma },
        { provide: WarehouseService, useValue: mockWarehouse },
      ],
    }).compile();

    service = module.get<BiService>(BiService);
    kpiService = module.get<KpiService>(KpiService);
  });

  describe('getConversionMetrics', () => {
    it('should calculate conversion rates correctly with companyId', async () => {
      const result = await service.getConversionMetrics('org-a');
      expect(result.totalLeads).toBe(100);
      expect(result.policiesIssued).toBe(20);
      expect(result.overallConversionRate).toBe(20);
      expect(result.stageFunnel).toHaveLength(2);
      expect(result.funnelJourney).toHaveLength(5);
      expect(result.funnelJourney[0].stage).toBe('LEAD');
      expect(mockPrisma.lead.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'org-a' }),
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getConversionMetrics()).rejects.toThrow(
        ForbiddenException,
      );
      await expect(service.getConversionMetrics('')).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should return correct results when there are zero leads', async () => {
      mockPrisma.lead.count.mockResolvedValueOnce(0).mockResolvedValueOnce(0);
      mockPrisma.policy.count.mockResolvedValueOnce(0);
      mockPrisma.proposal.count.mockResolvedValueOnce(0);
      mockPrisma.policyPayment.count.mockResolvedValueOnce(0);
      mockPrisma.lead.groupBy.mockResolvedValueOnce([]);

      const result = await service.getConversionMetrics('org-a');
      expect(result.totalLeads).toBe(0);
      expect(result.quotedLeads).toBe(0);
      expect(result.leadToQuoteRate).toBe(0);
      expect(result.overallConversionRate).toBe(0);
      expect(result.quoteToProposalRate).toBe(0);
      expect(result.proposalToPaymentRate).toBe(0);
      expect(result.paymentToPolicyRate).toBe(0);
    });

    it('should query quoted leads using valid LeadStatus enums and quotation relations', async () => {
      await service.getConversionMetrics('org-a');
      expect(mockPrisma.lead.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'org-a',
            deletedAt: null,
            OR: expect.arrayContaining([
              expect.objectContaining({
                status: expect.objectContaining({
                  in: expect.arrayContaining([
                    'QUOTE_PREPARED',
                    'QUOTATION',
                    'CUSTOMER_ACCEPTED',
                    'POLICY_ISSUED',
                    'CONVERTED',
                  ]),
                }),
              }),
              { quotations: { some: { deletedAt: null } } },
              { motorQuotations: { some: { deletedAt: null } } },
            ]),
          }),
        }),
      );
    });

    it('should not inflate conversion when one lead has multiple quotations', async () => {
      // 10 total leads, 3 distinct leads quoted (each may have 5 quotations, but distinct lead count is 3)
      mockPrisma.lead.count
        .mockResolvedValueOnce(10) // totalLeads
        .mockResolvedValueOnce(3); // quotedLeads (distinct unique leads)
      mockPrisma.proposal.count.mockResolvedValueOnce(2);
      mockPrisma.policy.count.mockResolvedValueOnce(1);
      mockPrisma.policyPayment.count.mockResolvedValueOnce(1);

      const result = await service.getConversionMetrics('org-a');
      expect(result.totalLeads).toBe(10);
      expect(result.quotedLeads).toBe(3);
      expect(result.leadToQuoteRate).toBe(30); // 3/10 * 100 = 30%, not inflated by multiple quotes
      expect(result.quoteToProposalRate).toBe(66.7); // 2/3 * 100
      expect(result.quoteToPolicyRate).toBe(33.3); // 1/3 * 100
      expect(result.overallConversionRate).toBe(10); // 1/10 * 100
    });

    it('should count policies issued only when status is ACTIVE or ISSUED', async () => {
      await service.getConversionMetrics('org-a');
      expect(mockPrisma.policy.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'org-a',
            status: { in: ['ACTIVE', 'ISSUED'] },
          }),
        }),
      );
    });
  });

  describe('getRevenueMetrics', () => {
    it('should aggregate revenue for the specified tenant', async () => {
      const result = await service.getRevenueMetrics('org-a');
      expect(result).toHaveProperty('totalPremium');
      expect(result).toHaveProperty('byProductType');
      expect(result).toHaveProperty('quarterlyBreakdown');
      expect(result).toHaveProperty('insurerMarketShare');
      expect(mockPrisma.policyPayment.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            policy: { companyId: 'org-a' },
          }),
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getRevenueMetrics()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getLossRatioMetrics', () => {
    it('should calculate loss ratio scoped to tenant', async () => {
      const result = await service.getLossRatioMetrics('org-a');
      expect(result).toHaveProperty('lossRatio');
      expect(result).toHaveProperty('byProduct');
      expect(mockPrisma.claim.aggregate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { companyId: 'org-a' },
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getLossRatioMetrics()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getRenewalMetrics', () => {
    it('should return renewal pipeline scoped to tenant', async () => {
      const result = await service.getRenewalMetrics('org-a');
      expect(result).toHaveProperty('conversionRate');
      expect(result).toHaveProperty('retentionRate');
      expect(result.pipeline.length).toBeGreaterThanOrEqual(3);
      expect(mockPrisma.policy.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'org-a' }),
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getRenewalMetrics()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getSalesMetrics', () => {
    it('should return policies issued this month and agent breakdown for tenant', async () => {
      const result = await service.getSalesMetrics('org-a');
      expect(result).toHaveProperty('policiesIssuedThisMonth');
      expect(result).toHaveProperty('monthOverMonthGrowth');
      expect(result).toHaveProperty('byAgent');
      expect(mockPrisma.policy.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'org-a' }),
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getSalesMetrics()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getAgentPerformanceAnalytics (Workstream 3)', () => {
    it('should return comprehensive agent performance scoped to tenant', async () => {
      const result = await service.getAgentPerformanceAnalytics('org-a');
      expect(result).toHaveProperty('totalAgents');
      expect(result).toHaveProperty('activeAgents');
      expect(result).toHaveProperty('totalGwp');
      expect(result.topPerformers.length).toBeGreaterThanOrEqual(1);
      expect(result.topPerformers[0].agentName).toBe('Vikram Patel');
      expect(result.topPerformers[0].gwp).toBe(120000);
      expect(result.topPerformers[0].conversionRate).toBe(66.7);
      expect(result.topPerformers[0].commissionEarned).toBe(20000);
      expect(result.topPerformers[0].commissionPaid).toBe(12000);
      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'org-a' }),
        }),
      );
    });

    it('should reject missing companyId with ForbiddenException', async () => {
      await expect(service.getAgentPerformanceAnalytics()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getOperationalActionCentre (Workstream 3)', () => {
    it('should return action centre queue partitioned by category scoped to tenant', async () => {
      const result = await service.getOperationalActionCentre('org-a');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('criticalItems');
      expect(result).toHaveProperty('itemsByCategory');
      expect(result.summary.overdueTasksCount).toBe(1);
      expect(result.summary.pendingInspectionsCount).toBe(1);
      expect(result.summary.pendingPaymentsCount).toBe(1);
      expect(result.summary.complianceBlocksCount).toBe(1);
      expect(result.summary.totalActionItems).toBe(4);
    });

    it('should reject missing companyId with ForbiddenException', async () => {
      await expect(service.getOperationalActionCentre()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getCommissionIntelligence (Workstream 3)', () => {
    it('should return earned vs paid reconciliation intelligence scoped to tenant', async () => {
      const result = await service.getCommissionIntelligence('org-a');
      expect(result.totalEarned).toBe(20000);
      expect(result.totalPaid).toBe(12000);
      expect(result.totalPending).toBe(8000);
      expect(result.reconciliationRate).toBe(60);
      expect(result.byAgent).toHaveLength(1);
      expect(result.byAgent[0].agentName).toBe('Vikram Patel');
      expect(result.byAgent[0].totalPaid).toBe(12000);
      expect(mockPrisma.commission.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'org-a' }),
        }),
      );
    });

    it('should reject missing companyId with ForbiddenException', async () => {
      await expect(service.getCommissionIntelligence()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('exportBiReport (Workstream 3)', () => {
    it('should export agent-performance CSV correctly', async () => {
      const result = await service.exportBiReport('agent-performance', 'org-a');
      expect(result.filename).toMatch(/agent-performance-.*\.csv/);
      expect(result.contentType).toBe('text/csv');
      expect(result.data).toContain('Agent Code,Agent Name');
      expect(result.data).toContain('Vikram Patel');
    });

    it('should export commission-intelligence CSV correctly', async () => {
      const result = await service.exportBiReport('commission-intelligence', 'org-a');
      expect(result.filename).toMatch(/commission-intelligence-.*\.csv/);
      expect(result.data).toContain('Earned Commission,Paid Commission');
      expect(result.data).toContain('Vikram Patel');
    });

    it('should export action-centre CSV correctly', async () => {
      const result = await service.exportBiReport('action-centre', 'org-a');
      expect(result.filename).toMatch(/operational-action-centre-.*\.csv/);
      expect(result.data).toContain('Category,Severity,Title');
    });

    it('should reject missing companyId with ForbiddenException', async () => {
      await expect(service.exportBiReport('agent-performance')).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getGrowthMetrics', () => {
    it('should return growth metrics for tenant', async () => {
      const result = await service.getGrowthMetrics('org-a');
      expect(result).toHaveProperty('portfolioSize');
      expect(result).toHaveProperty('trendByMonth');
      expect(mockPrisma.policy.count).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ companyId: 'org-a' }),
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getGrowthMetrics()).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  describe('getKpiValues', () => {
    it('should evaluate KPI formulas and return values scoped to tenant', async () => {
      const result = await service.getKpiValues('org-a');
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe('conversion_rate');
      expect(typeof result[0].value).toBe('number');
      expect(mockPrisma.kpiDefinition.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: expect.arrayContaining([
              { createdBy: { companyId: 'org-a' } },
              { createdById: null },
            ]),
          }),
        }),
      );
    });

    it('should reject without companyId with ForbiddenException', async () => {
      await expect(service.getKpiValues()).rejects.toThrow(ForbiddenException);
    });
  });

  describe('KpiService (Wave 7 Tenancy Isolation)', () => {
    it('throws NotFoundException if KPI definition does not exist', async () => {
      mockPrisma.kpiDefinition.findUnique.mockResolvedValue(null);

      await expect(
        kpiService.updateKpi('missing-kpi', { name: 'Updated' }, 'org-a'),
      ).rejects.toThrow(NotFoundException);
    });

    it('blocks cross-tenant KPI update with HTTP 403 Forbidden', async () => {
      mockPrisma.kpiDefinition.findUnique.mockResolvedValue({
        id: 'kpi-tenant-b',
        createdBy: { companyId: 'org-b' },
      });

      await expect(
        kpiService.updateKpi('kpi-tenant-b', { name: 'Tampered' }, 'org-a'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.kpiDefinition.update).not.toHaveBeenCalled();
    });

    it('allows updating KPI when tenant matches', async () => {
      mockPrisma.kpiDefinition.findUnique.mockResolvedValue({
        id: 'kpi-tenant-a',
        createdBy: { companyId: 'org-a' },
      });
      mockPrisma.kpiDefinition.update.mockResolvedValue({
        id: 'kpi-tenant-a',
        name: 'Updated Name',
      });

      const result = await kpiService.updateKpi(
        'kpi-tenant-a',
        { name: 'Updated Name' },
        'org-a',
      );

      expect(result.name).toBe('Updated Name');
    });

    it('blocks cross-tenant KPI deletion with HTTP 403 Forbidden', async () => {
      mockPrisma.kpiDefinition.findUnique.mockResolvedValue({
        id: 'kpi-tenant-b',
        createdBy: { companyId: 'org-b' },
      });

      await expect(
        kpiService.deleteKpi('kpi-tenant-b', 'org-a'),
      ).rejects.toThrow(ForbiddenException);

      expect(mockPrisma.kpiDefinition.update).not.toHaveBeenCalled();
    });

    it('allows soft-deleting KPI when tenant matches', async () => {
      mockPrisma.kpiDefinition.findUnique.mockResolvedValue({
        id: 'kpi-tenant-a',
        createdBy: { companyId: 'org-a' },
      });
      mockPrisma.kpiDefinition.update.mockResolvedValue({
        id: 'kpi-tenant-a',
        isActive: false,
      });

      const result = await kpiService.deleteKpi('kpi-tenant-a', 'org-a');

      expect(result.isActive).toBe(false);
    });
  });
});
