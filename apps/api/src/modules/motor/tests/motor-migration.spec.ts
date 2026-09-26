import { MotorQuotationMigrationService } from '../services/motor-migration.service';
import { PrismaClient, Prisma } from '@prisma/client';

describe('Phase 32: MotorQuotation Migration & Financial Graph Reconciliation (MOTOR-MIGRATION-01)', () => {
  let migrationService: MotorQuotationMigrationService;
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      $queryRaw: jest.fn(),
      policy: {
        findMany: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      motorQuotation: {
        findMany: jest.fn(),
      },
      quotation: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
    };

    migrationService = new MotorQuotationMigrationService(mockPrisma as unknown as PrismaClient);
  });

  describe('Policy Deduplication (MIGRATION-POLICY-01..03)', () => {
    it('should detect duplicate policies per quotation and resolve by keeping ISSUED policy', async () => {
      // 1. Mock finding duplicates
      mockPrisma.$queryRaw.mockResolvedValueOnce([
        { quotation_id: 'quote-dup-1', policy_count: 2 },
      ]);

      // 2. Mock finding the policies for the duplicate quote
      mockPrisma.policy.findMany.mockResolvedValueOnce([
        {
          id: 'pol-draft',
          policyNumber: 'POL-DRAFT-01',
          status: 'DRAFT',
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'pol-issued',
          policyNumber: 'POL-ISSUED-01',
          status: 'ISSUED',
          createdAt: new Date('2026-01-02'),
        },
      ]);

      mockPrisma.policy.update.mockResolvedValue({});

      const resolvedCount = await migrationService.deduplicateMotorPolicies(false);

      expect(resolvedCount).toBe(1);
      expect(mockPrisma.policy.update).toHaveBeenCalledWith({
        where: { id: 'pol-draft' },
        data: {
          quotationId: null,
          status: 'SUPERSEDED',
        },
      });
    });

    it('should assert post-deduplication zero duplicate policies (MIGRATION-POLICY-03)', async () => {
      mockPrisma.$queryRaw.mockResolvedValueOnce([]); // no duplicates found

      const count = await migrationService.deduplicateMotorPolicies(false);
      expect(count).toBe(0);
    });
  });

  describe('Zero Orphan Invariant Assertion', () => {
    it('should report pass when zero orphans exist across proposals, payments, and inspections', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: 0 }]) // proposals
        .mockResolvedValueOnce([{ count: 0 }]) // payments
        .mockResolvedValueOnce([{ count: 0 }]); // inspections

      const result = await migrationService.assertZeroOrphans();

      expect(result.pass).toBe(true);
      expect(result.orphans.proposals).toBe(0);
      expect(result.orphans.payments).toBe(0);
      expect(result.orphans.inspections).toBe(0);
    });

    it('should report failure if any orphan proposals, payments, or inspections exist', async () => {
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([{ count: 2 }]) // orphan proposals
        .mockResolvedValueOnce([{ count: 0 }])
        .mockResolvedValueOnce([{ count: 0 }]);

      const result = await migrationService.assertZeroOrphans();

      expect(result.pass).toBe(false);
      expect(result.orphans.proposals).toBe(2);
    });
  });

  describe('Full Migration Execution & Financial Reconciliation', () => {
    it('should reconcile exact gross premium and GST sums between legacy and canonical records', async () => {
      // No duplicate policies
      mockPrisma.$queryRaw
        .mockResolvedValueOnce([]) // deduplicateMotorPolicies
        .mockResolvedValueOnce([{ count: 0 }]) // postDupQuery
        .mockResolvedValueOnce([{ count: 0 }]) // orphan proposals
        .mockResolvedValueOnce([{ count: 0 }]) // orphan payments
        .mockResolvedValueOnce([{ count: 0 }]); // orphan inspections

      const mockLegacyQuotes = [
        {
          id: 'mq-1',
          quotationNumber: 'MQ-2026-001',
          companyId: 'comp-1',
          leadId: 'lead-1',
          vehicleId: 'veh-1',
          agentId: 'agent-1',
          insurerName: 'TATA AIG',
          policyType: 'PACKAGE_COMPREHENSIVE',
          status: 'ACCEPTED',
          idv: new Prisma.Decimal(500000),
          odPremium: new Prisma.Decimal(12000),
          tpPremium: new Prisma.Decimal(3416),
          addonPremium: new Prisma.Decimal(2500),
          ncbDiscount: new Prisma.Decimal(2400),
          gstAmount: new Prisma.Decimal(2792.88),
          finalPremium: new Prisma.Decimal(18308.88),
          breakup: { baseOd: 12000 },
          addonsSelected: ['ZERO_DEP'],
          agentCodeSnapshot: 'AGT-01',
          policyId: 'pol-1',
          lead: { contactId: 'con-1' },
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      mockPrisma.motorQuotation.findMany.mockResolvedValueOnce(mockLegacyQuotes);
      mockPrisma.quotation.findFirst.mockResolvedValueOnce(null); // not yet migrated
      mockPrisma.quotation.create.mockResolvedValueOnce({
        id: 'new-quote-1',
        quotationCode: 'MQ-2026-001',
      });
      mockPrisma.policy.updateMany.mockResolvedValueOnce({ count: 1 });

      const summary = await migrationService.executeMigration(false);

      expect(summary.legacyCount).toBe(1);
      expect(summary.migratedCount).toBe(1);
      expect(summary.legacyTotalGross).toBe('18308.88');
      expect(summary.canonicalTotalGross).toBe('18308.88');
      expect(summary.legacyTotalGst).toBe('2792.88');
      expect(summary.canonicalTotalGst).toBe('2792.88');
      expect(summary.financialReconciliationPass).toBe(true);
      expect(summary.policyUniquenessPass).toBe(true);
      expect(summary.zeroOrphanPass).toBe(true);

      // Verify foreign key repointing
      expect(mockPrisma.policy.updateMany).toHaveBeenCalledWith({
        where: { id: 'pol-1' },
        data: { quotationId: 'new-quote-1' },
      });
    });
  });
});
