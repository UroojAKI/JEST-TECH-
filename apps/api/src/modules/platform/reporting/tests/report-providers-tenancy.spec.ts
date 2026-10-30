import { ForbiddenException } from '@nestjs/common';
import { PolicyReportProvider } from '../../../policies/providers/policy-report.provider';
import { RevenueReportProvider } from '../../../policies/providers/revenue-report.provider';
import { ClaimReportProvider } from '../../../claims/providers/claim-report.provider';
import { LeadReportProvider } from '../../../leads/providers/lead-report.provider';
import { AuditReportProvider } from '../../audit/providers/audit-report.provider';
import { ExportService } from '../services/export.service';

describe('Report Providers Tenancy & Data Integrity (REP-001 - REP-024)', () => {
  let mockPrisma: any;
  let mockRegistry: any;

  beforeEach(() => {
    mockPrisma = {
      policy: {
        findMany: jest.fn().mockResolvedValue([
          {
            policyNumber: 'POL-1001',
            premiumAmount: 15000,
            status: 'ACTIVE',
            expiryDate: new Date('2027-01-01'),
            contact: { firstName: 'Aarav', lastName: 'Patel' },
            quotation: { productType: 'MOTOR_COMPREHENSIVE', insurerName: 'HDFC ERGO' },
          },
        ]),
      },
      policyRenewal: {
        findMany: jest.fn().mockResolvedValue([
          {
            renewalNumber: 'REN-2001',
            premiumAmount: 16000,
            status: 'IN_REVIEW',
            createdAt: new Date('2026-10-01'),
            policy: {
              policyNumber: 'POL-1001',
              contact: { firstName: 'Aarav', lastName: 'Patel' },
            },
          },
        ]),
      },
      policyPayment: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'pay-1',
            amount: 15000,
            paymentMethod: 'UPI',
            transactionId: 'TXN-999',
            status: 'SUCCESS',
            paymentDate: new Date('2026-10-15'),
            policy: {
              policyNumber: 'POL-1001',
              contact: { firstName: 'Aarav', lastName: 'Patel' },
            },
          },
        ]),
      },
      claim: {
        findMany: jest.fn().mockResolvedValue([
          {
            claimNumber: 'CLM-3001',
            claimAmount: 50000,
            approvedAmount: 45000,
            status: 'APPROVED',
            surveyorName: 'Vikram Joshi',
            policy: { policyNumber: 'POL-1001' },
            contact: { firstName: 'Aarav', lastName: 'Patel' },
          },
        ]),
      },
      lead: {
        findMany: jest.fn().mockResolvedValue([
          {
            leadCode: 'LEAD-4001',
            source: 'WEBSITE',
            status: 'CONVERTED',
            createdAt: new Date('2026-09-01'),
            updatedAt: new Date('2026-09-10'),
            contact: { firstName: 'Pooja', lastName: 'Mehta' },
            assignedTo: { firstName: 'Rohan', lastName: 'Verma' },
          },
        ]),
      },
      auditLog: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'audit-log-1',
            createdAt: new Date('2026-10-20'),
            action: 'UPDATE',
            module: 'POLICIES',
            entity: 'POLICY',
            entityId: 'pol-1',
            ipAddress: '192.168.1.1',
            userAgent: 'Mozilla/5.0',
            correlationId: 'corr-123',
            user: { firstName: 'Admin', lastName: 'User', email: 'admin@jest.com' },
          },
        ]),
      },
    };

    mockRegistry = {
      register: jest.fn(),
      getProvider: jest.fn(),
    };
  });

  describe('PolicyReportProvider', () => {
    it('throws ForbiddenException when companyId is missing', async () => {
      const provider = new PolicyReportProvider(mockRegistry, mockPrisma);
      await expect(
        provider.execute({ parameters: { reportCode: 'ACTIVE_POLICIES' } }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enforces mandatory tenant companyId scoping', async () => {
      const provider = new PolicyReportProvider(mockRegistry, mockPrisma);
      await provider.execute({
        companyId: 'tenant-xyz',
        parameters: { reportCode: 'ACTIVE_POLICIES' },
        filters: [],
      });

      expect(mockPrisma.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'tenant-xyz',
            status: 'ACTIVE',
            deletedAt: null,
          }),
        }),
      );
    });

    it('enforces ACTIVE status and date bounds for EXPIRING_POLICIES', async () => {
      const provider = new PolicyReportProvider(mockRegistry, mockPrisma);
      await provider.execute({
        companyId: 'tenant-xyz',
        parameters: { reportCode: 'EXPIRING_POLICIES', days: 45 },
      });

      expect(mockPrisma.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'tenant-xyz',
            status: 'ACTIVE',
            deletedAt: null,
            expiryDate: expect.any(Object),
          }),
        }),
      );
    });

    it('enforces date boundaries when startDate and endDate are provided', async () => {
      const provider = new PolicyReportProvider(mockRegistry, mockPrisma);
      await provider.execute({
        companyId: 'tenant-xyz',
        parameters: {
          reportCode: 'POLICY_REGISTER',
          startDate: '2026-01-01',
          endDate: '2026-12-31',
        },
      });

      expect(mockPrisma.policy.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'tenant-xyz',
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-12-31'),
            },
          }),
        }),
      );
    });
  });

  describe('RevenueReportProvider', () => {
    it('throws ForbiddenException when companyId is missing', async () => {
      const provider = new RevenueReportProvider(mockRegistry, mockPrisma);
      await expect(
        provider.execute({ parameters: { reportCode: 'REVENUE_REPORT' } }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('strictly isolates renewals by companyId and maps dynamic status', async () => {
      const provider = new RevenueReportProvider(mockRegistry, mockPrisma);
      const result = await provider.execute({
        companyId: 'tenant-abc',
        parameters: { reportCode: 'RENEWAL_REVENUE' },
      });

      expect(mockPrisma.policyRenewal.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            policy: { companyId: 'tenant-abc' },
          }),
        }),
      );
      expect(result.rows[0].status).toBe('IN_REVIEW');
    });

    it('enforces companyId and status SUCCESS on premium collection', async () => {
      const provider = new RevenueReportProvider(mockRegistry, mockPrisma);
      await provider.execute({
        companyId: 'tenant-abc',
        parameters: { reportCode: 'PREMIUM_COLLECTION' },
      });

      expect(mockPrisma.policyPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            policy: { companyId: 'tenant-abc' },
            status: 'SUCCESS',
          }),
        }),
      );
    });

    it('calculates full revenue aggregation without take truncation', async () => {
      const provider = new RevenueReportProvider(mockRegistry, mockPrisma);
      const result = await provider.execute({
        companyId: 'tenant-abc',
        parameters: { reportCode: 'REVENUE_REPORT' },
        limit: 10,
      });

      // Should not have passed take: 10 to policyPayment.findMany
      expect(mockPrisma.policyPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            policy: { companyId: 'tenant-abc' },
          }),
        }),
      );
      expect(mockPrisma.policyPayment.findMany).not.toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
      expect(result.rows[0].totalRevenue).toBe(15000);
    });
  });

  describe('ClaimReportProvider', () => {
    it('throws ForbiddenException when companyId is missing', async () => {
      const provider = new ClaimReportProvider(mockRegistry, mockPrisma);
      await expect(
        provider.execute({ parameters: { reportCode: 'CLAIMS_REGISTER' } }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('enforces tenant companyId on both claims and payments for loss ratio', async () => {
      const provider = new ClaimReportProvider(mockRegistry, mockPrisma);
      const result = await provider.execute({
        companyId: 'tenant-loss-ratio',
        parameters: { reportCode: 'LOSS_RATIO' },
      });

      expect(mockPrisma.claim.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'tenant-loss-ratio',
            status: { in: ['SETTLED', 'APPROVED'] },
          }),
        }),
      );

      expect(mockPrisma.policyPayment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            policy: { companyId: 'tenant-loss-ratio' },
            status: 'SUCCESS',
          }),
        }),
      );

      expect(result.rows[0].claimsPaid).toBe(45000);
      expect(result.rows[0].premiumCollected).toBe(15000);
      expect(result.rows[0].lossRatio).toBe('300.00%');
    });
  });

  describe('LeadReportProvider', () => {
    it('throws ForbiddenException when companyId is missing for execute or stream', async () => {
      const provider = new LeadReportProvider(mockRegistry, mockPrisma);
      await expect(
        provider.execute({ parameters: { reportCode: 'LEAD_SUMMARY' } }),
      ).rejects.toThrow(ForbiddenException);

      const gen = provider.stream({ parameters: { reportCode: 'LEAD_SUMMARY' } });
      await expect(gen.next()).rejects.toThrow(ForbiddenException);
    });

    it('enforces companyId and date filters on lead stream', async () => {
      const provider = new LeadReportProvider(mockRegistry, mockPrisma);
      const gen = provider.stream({
        companyId: 'tenant-lead-stream',
        parameters: {
          startDate: '2026-01-01',
          endDate: '2026-06-30',
        },
      });
      await gen.next();

      expect(mockPrisma.lead.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            companyId: 'tenant-lead-stream',
            deletedAt: null,
            createdAt: {
              gte: new Date('2026-01-01'),
              lte: new Date('2026-06-30'),
            },
          }),
        }),
      );
    });
  });

  describe('AuditReportProvider', () => {
    it('throws ForbiddenException when companyId is missing', async () => {
      const provider = new AuditReportProvider(mockRegistry, mockPrisma);
      await expect(
        provider.execute({ parameters: { reportCode: 'AUDIT_TRAIL' } }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('isolates audit trail by user companyId', async () => {
      const provider = new AuditReportProvider(mockRegistry, mockPrisma);
      await provider.execute({
        companyId: 'tenant-audit-org',
        parameters: { reportCode: 'AUDIT_TRAIL', action: 'UPDATE' },
      });

      expect(mockPrisma.auditLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            user: { companyId: 'tenant-audit-org' },
            action: 'UPDATE',
          }),
        }),
      );
    });
  });

  describe('ExportService PDF Parity', () => {
    it('generates a valid %PDF- header without throwing constructor errors', async () => {
      const exporter = new ExportService();
      const sampleData = [
        {
          policyNumber: 'POL-101',
          clientName: 'Rahul Sharma',
          amount: 12500,
        },
      ];
      const columns = [
        { field: 'policyNumber', label: 'Policy Number' },
        { field: 'clientName', label: 'Client Name' },
        { field: 'amount', label: 'Amount' },
      ];

      const result = await exporter.export(
        sampleData,
        columns,
        'Executive Financial Summary',
        'pdf',
      );

      expect(result).toBeDefined();
      expect(result.mimeType).toBe('application/pdf');
      expect(result.extension).toBe('pdf');
      expect(result.buffer).toBeDefined();
      expect(result.buffer.slice(0, 5).toString()).toBe('%PDF-');
    });
  });
});
