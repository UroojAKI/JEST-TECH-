import { PrismaClient, UserStatus } from '@prisma/client';

const CANONICAL_EMAILS = new Set([
  'superadmin@jest.com',
  'admin@jest.com',
  'manager@jest.com',
  'agent@jest.com',
  'underwriter@jest.com',
  'claims@jest.com',
  'finance@jest.com',
  'md@jest.com',
  'sm@jest.com',
  'renewal@jest.com',
  'cre@jest.com',
  'arm@jest.com',
  'backoffice@jest.com',
  'accounts@jest.com',
  'marketing@jest.com',
]);

const CANONICAL_COMPANY_CODES = new Set(['JEST_INDIA']);
const CANONICAL_BRANCH_CODES = new Set(['GG-CHK', 'PUN-SHV', 'BLR-IND', 'DEL-CP', 'PUN-01']);

const CANDIDATE_TABLES = [
  'policies',
  'proposals',
  'quotations',
  'quotation_documents',
  'quotation_histories',
  'motor_quotations',
  'motor_quotation_cases',
  'motor_quotation_documents',
  'motor_quotation_migrations',
  'motor_inspections',
  'motor_inspection_histories',
  'motor_payment_records',
  'saod_tp_verifications',
  'motor_previous_policies',
  'motor_rule_evaluations',
  'motor_journeys',
  'claims',
  'claim_documents',
  'claim_histories',
  'claim_communications',
  'endorsements',
  'endorsement_documents',
  'endorsement_histories',
  'insurer_policy_details',
  'policy_documents',
  'policy_histories',
  'policy_members',
  'policy_nominees',
  'policy_payments',
  'policy_renewals',
  'renewal_jobs',
  'renewal_tasks',
  'leads',
  'lead_stage_history',
  'lead_assignments',
  'contacts',
  'customers',
  'customer_alerts',
  'customer_agent_histories',
  'vehicles',
  'back_office_tasks',
  'tasks',
  'activities',
  'notes',
  'call_logs',
  'meeting_logs',
  'referrals',
  'opportunities',
];

export async function cleanTestData(dryRun = true) {
  const prisma = new PrismaClient();

  console.log('========================================================================');
  console.log(`🧹 PRODUCTION PURGE: Clean Test & Churn Data (DryRun: ${dryRun})`);
  console.log('========================================================================');

  try {
    const summary: Record<string, number> = {};

    // 1. Find non-canonical companies
    const testCompanies = await prisma.company.findMany({
      where: { code: { notIn: Array.from(CANONICAL_COMPANY_CODES) } },
    });
    summary.testCompanies = testCompanies.length;

    // 2. Find non-canonical branches
    const testBranches = await prisma.branch.findMany({
      where: { code: { notIn: Array.from(CANONICAL_BRANCH_CODES) } },
    });
    summary.testBranches = testBranches.length;

    // 3. Find test users
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true },
    });
    const testUsers = allUsers.filter((u) => {
      const email = u.email.toLowerCase();
      return !CANONICAL_EMAILS.has(email);
    });
    summary.testUsers = testUsers.length;
    const testUserIds = testUsers.map((u) => u.id);

    // 4. Counts of transactional entities
    summary.policies = await prisma.policy.count();
    summary.quotations = await prisma.quotation.count();
    summary.motorCases = await prisma.motorQuotationCase.count();
    summary.leads = await prisma.lead.count();
    summary.contacts = await prisma.contact.count();
    summary.customers = await prisma.customer.count();
    summary.vehicles = await prisma.vehicle.count();

    console.log('Identified test records for deletion/deactivation:');
    for (const [key, count] of Object.entries(summary)) {
      console.log(`  - ${key}: ${count}`);
    }

    if (dryRun) {
      console.log('------------------------------------------------------------------------');
      console.log('Dry-run complete. No database mutations applied.');
      console.log('To apply deletions, run with --apply');
      console.log('========================================================================');
      return summary;
    }

    console.log('Applying deletions in atomic transaction via CASCADE truncate...');

    const existingTables = await prisma.$queryRawUnsafe<Array<{ table_name: string }>>(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'",
    );
    const existingTableNames = new Set(existingTables.map((t) => t.table_name));
    const toTruncate = CANDIDATE_TABLES.filter((t) => existingTableNames.has(t));

    await prisma.$transaction(
      async (tx) => {
        // 1. Truncate all verified transactional tables with CASCADE
        if (toTruncate.length > 0) {
          const sql = `TRUNCATE TABLE ${toTruncate.map((t) => `"${t}"`).join(', ')} CASCADE;`;
          await tx.$executeRawUnsafe(sql);
        }

        // 2. Deactivate & soft-delete test users (complies with IRDAI append-only audit trigger G023)
        if (testUserIds.length > 0) {
          await tx.agent.updateMany({
            where: { userId: { in: testUserIds } },
            data: { isActive: false },
          });
          await tx.refreshToken.deleteMany({ where: { userId: { in: testUserIds } } });
          await tx.user.updateMany({
            where: { id: { in: testUserIds } },
            data: {
              status: UserStatus.INACTIVE,
              deletedAt: new Date(),
            },
          });
        }

        // 3. Deactivate test branches
        await tx.branch.updateMany({
          where: { code: { notIn: Array.from(CANONICAL_BRANCH_CODES) } },
          data: { isActive: false },
        });

        // 4. Deactivate test companies
        await tx.company.updateMany({
          where: { code: { notIn: Array.from(CANONICAL_COMPANY_CODES) } },
          data: { isActive: false },
        });
      },
      { maxWait: 15_000, timeout: 60_000 },
    );

    console.log('✅ Successfully purged all transactional test data and deactivated test personas.');
    console.log('========================================================================');
    return summary;
  } finally {
    await prisma.$disconnect();
  }
}

async function main() {
  const dryRun = !process.argv.includes('--apply');
  await cleanTestData(dryRun);
}

if (require.main === module) {
  main().catch((err) => {
    console.error('Fatal cleanup error:', err);
    process.exit(1);
  });
}
