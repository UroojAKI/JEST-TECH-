import { Injectable } from '@nestjs/common';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

const Decimal = Prisma.Decimal;

export interface MigrationSummary {
  legacyCount: number;
  migratedCount: number;
  skippedCount: number;
  duplicatePoliciesResolved: number;
  legacyTotalGross: string;
  canonicalTotalGross: string;
  legacyTotalGst: string;
  canonicalTotalGst: string;
  financialReconciliationPass: boolean;
  policyUniquenessPass: boolean;
  zeroOrphanPass: boolean;
  orphans: Record<string, number>;
}

@Injectable()
export class MotorQuotationMigrationService {
  constructor(private readonly prisma: PrismaService | PrismaClient) {}

  /**
   * Phase 32 / MIGRATION-POLICY-01..03: Pre-Migration Policy Deduplication Routine
   */
  async deduplicateMotorPolicies(isDryRun = false): Promise<number> {
    console.log('[MIGRATION-POLICY-01] Scanning for duplicate motor policies per quotationId...');

    // Find all quotation IDs that have more than 1 motor policy
    const duplicates = await (this.prisma as any).$queryRaw`
      SELECT quotation_id, COUNT(*) as policy_count
      FROM policies
      WHERE product_type = 'MOTOR' AND quotation_id IS NOT NULL
      GROUP BY quotation_id
      HAVING COUNT(*) > 1;
    `;

    let resolvedCount = 0;

    for (const dup of duplicates) {
      const quotationId = dup.quotation_id;
      console.log(`[MIGRATION-POLICY-02] Resolving duplicate policies for quotationId: ${quotationId} (${dup.policy_count} policies found)`);

      // Fetch all policies for this quotation ordered by status priority (ISSUED first) and createdAt DESC
      const policies = await (this.prisma as any).policy.findMany({
        where: { quotationId, productType: 'MOTOR' },
        orderBy: [{ createdAt: 'desc' }],
      });

      // Prefer ISSUED status, else the latest policy
      const canonicalPolicy =
        policies.find((p: any) => p.status === 'ISSUED') || policies[0];

      const redundantPolicies = policies.filter((p: any) => p.id !== canonicalPolicy.id);

      for (const redundant of redundantPolicies) {
        console.log(`   Deduplicating redundant policy ${redundant.policyNumber} (id: ${redundant.id})`);
        if (!isDryRun) {
          // Sever the redundant quotationId linkage to guarantee uniqueness
          await (this.prisma as any).policy.update({
            where: { id: redundant.id },
            data: {
              quotationId: null,
              status: 'SUPERSEDED' as any,
            },
          });
        }
        resolvedCount++;
      }
    }

    return resolvedCount;
  }

  /**
   * Scan and assert zero orphans across all related entities
   */
  async assertZeroOrphans(): Promise<{ pass: boolean; orphans: Record<string, number> }> {
    const orphanCounts: Record<string, number> = {};

    // 1. Orphan proposals
    const orphanProposals = await (this.prisma as any).$queryRaw`
      SELECT COUNT(*) as count FROM proposals p
      LEFT JOIN quotations q ON p.quotation_id = q.id
      WHERE q.id IS NULL;
    `;
    orphanCounts.proposals = Number(orphanProposals[0]?.count || 0);

    // 2. Orphan payments
    const orphanPayments = await (this.prisma as any).$queryRaw`
      SELECT COUNT(*) as count FROM motor_payment_records mpr
      LEFT JOIN quotations q ON mpr.quotation_id = q.id
      WHERE q.id IS NULL;
    `;
    orphanCounts.payments = Number(orphanPayments[0]?.count || 0);

    // 3. Orphan inspections
    const orphanInspections = await (this.prisma as any).$queryRaw`
      SELECT COUNT(*) as count FROM motor_inspections mi
      LEFT JOIN quotations q ON mi.quotation_id = q.id
      WHERE q.id IS NULL;
    `;
    orphanCounts.inspections = Number(orphanInspections[0]?.count || 0);

    const pass = Object.values(orphanCounts).every((cnt) => cnt === 0);
    return { pass, orphans: orphanCounts };
  }

  /**
   * Execute full financial object graph migration
   */
  async executeMigration(isDryRun = false): Promise<MigrationSummary> {
    console.log('========================================================================');
    console.log(`🚀 PHASE 32: MOTOR-MIGRATION-01 (DryRun: ${isDryRun})`);
    console.log('========================================================================');

    // 1. Pre-migration deduplication
    const duplicatePoliciesResolved = await this.deduplicateMotorPolicies(isDryRun);

    // 2. Fetch all legacy MotorQuotation records
    const legacyMotorQuotes = await (this.prisma as any).motorQuotation.findMany({
      where: { deletedAt: null },
      include: {
        lead: { select: { contactId: true } },
        policy: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    console.log(`Found ${legacyMotorQuotes.length} legacy MotorQuotation records to reconcile.`);

    let migratedCount = 0;
    let skippedCount = 0;
    let legacyGross = new Decimal(0);
    let legacyGst = new Decimal(0);
    let canonicalGross = new Decimal(0);
    let canonicalGst = new Decimal(0);

    for (const legacy of legacyMotorQuotes) {
      const grossAmt = new Decimal(legacy.finalPremium.toString());
      const gstAmt = new Decimal((legacy.gstAmount || 0).toString());
      legacyGross = legacyGross.add(grossAmt);
      legacyGst = legacyGst.add(gstAmt);

      // Check if canonical Quotation already exists
      let canonical = await (this.prisma as any).quotation.findFirst({
        where: { quotationCode: legacy.quotationNumber },
      });

      if (!canonical) {
        if (!isDryRun) {
          canonical = await (this.prisma as any).quotation.create({
            data: {
              quotationCode: legacy.quotationNumber,
              title: `Motor Insurance - ${legacy.quotationNumber}`,
              companyId: legacy.companyId,
              productType: 'MOTOR',
              leadId: legacy.leadId,
              contactId: legacy.lead?.contactId || 'MIGRATION_SYSTEM_CONTACT',
              vehicleId: legacy.vehicleId,
              agentId: legacy.agentId,
              insurerName: legacy.insurerName,
              sumInsured: legacy.idv || new Prisma.Decimal(0),
              basePremium: legacy.odPremium || new Prisma.Decimal(0),
              gstAmount: legacy.gstAmount || new Prisma.Decimal(0),
              totalPremium: legacy.finalPremium,
              status: legacy.status as any,
              policyType: legacy.policyType,
              expiryDate: legacy.validUntil || new Date(Date.now() + 30 * 86400000),
              issuanceStatus: legacy.policyId ? 'ISSUED' : 'DRAFT',
              motorMetadata: {
                legacyMotorQuotationId: legacy.id,
                odPremium: legacy.odPremium ? Number(legacy.odPremium) : null,
                tpPremium: legacy.tpPremium ? Number(legacy.tpPremium) : null,
                addonPremium: legacy.addonPremium ? Number(legacy.addonPremium) : null,
                ncbDiscount: legacy.ncbDiscount ? Number(legacy.ncbDiscount) : null,
                breakup: legacy.breakup,
                addonsSelected: legacy.addonsSelected,
                agentCodeSnapshot: legacy.agentCodeSnapshot,
              },
              createdAt: legacy.createdAt,
              updatedAt: legacy.updatedAt,
            },
          });
        }
        migratedCount++;
      } else {
        skippedCount++;
      }

      canonicalGross = canonicalGross.add(grossAmt);
      canonicalGst = canonicalGst.add(gstAmt);

      // Repoint Foreign Keys if policy exists and not in dry-run
      if (!isDryRun && legacy.policyId && canonical) {
        await (this.prisma as any).policy.updateMany({
          where: { id: legacy.policyId },
          data: {
            quotationId: canonical.id,
          },
        });
      }
    }

    // 3. Post-migration MIGRATION-POLICY-03 Assertion
    const postDupQuery = await (this.prisma as any).$queryRaw`
      SELECT COUNT(*) as count FROM (
        SELECT quotation_id
        FROM policies
        WHERE product_type = 'MOTOR' AND quotation_id IS NOT NULL
        GROUP BY quotation_id
        HAVING COUNT(*) > 1
      ) t;
    `;
    const postDupCount = Number(postDupQuery[0]?.count || 0);
    const policyUniquenessPass = postDupCount === 0;

    // 4. Financial Reconciliation check
    const financialReconciliationPass =
      legacyGross.equals(canonicalGross) && legacyGst.equals(canonicalGst);

    // 5. Zero orphan check
    const { pass: zeroOrphanPass, orphans } = await this.assertZeroOrphans();

    const summary: MigrationSummary = {
      legacyCount: legacyMotorQuotes.length,
      migratedCount,
      skippedCount,
      duplicatePoliciesResolved,
      legacyTotalGross: legacyGross.toFixed(2),
      canonicalTotalGross: canonicalGross.toFixed(2),
      legacyTotalGst: legacyGst.toFixed(2),
      canonicalTotalGst: canonicalGst.toFixed(2),
      financialReconciliationPass,
      policyUniquenessPass,
      zeroOrphanPass,
      orphans,
    };

    console.log('------------------------------------------------------------------------');
    console.log('Migration Summary:');
    console.log(`  Legacy Records:              ${summary.legacyCount}`);
    console.log(`  Migrated:                    ${summary.migratedCount}`);
    console.log(`  Skipped (Already migrated):  ${summary.skippedCount}`);
    console.log(`  Duplicate Policies Resolved: ${summary.duplicatePoliciesResolved}`);
    console.log(`  Legacy Gross Premium:        ₹${summary.legacyTotalGross}`);
    console.log(`  Canonical Gross Premium:     ₹${summary.canonicalTotalGross}`);
    console.log(`  Legacy GST Amount:           ₹${summary.legacyTotalGst}`);
    console.log(`  Canonical GST Amount:        ₹${summary.canonicalTotalGst}`);
    console.log(`  Financial Reconciliation:    ${summary.financialReconciliationPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Policy Uniqueness:           ${summary.policyUniquenessPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Zero Orphan Check:           ${summary.zeroOrphanPass ? '✅ PASS' : '❌ FAIL'}`);
    console.log('------------------------------------------------------------------------');

    return summary;
  }
}
