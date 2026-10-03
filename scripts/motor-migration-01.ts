import { PrismaClient } from '@prisma/client';
import { MotorQuotationMigrationService } from '../apps/api/src/modules/motor/services/motor-migration.service';

async function main() {
  const dryRun = !process.argv.includes('--apply');
  if (!dryRun) {
    console.warn('Applying MOTOR-MIGRATION-01 changes to the configured database.');
  }
  const prisma = new PrismaClient();

  try {
    const summary = await new MotorQuotationMigrationService(prisma).executeMigration(
      dryRun,
    );

    if (
      !summary.financialReconciliationPass ||
      !summary.policyUniquenessPass ||
      !summary.zeroOrphanPass
    ) {
      console.error('Migration verification assertions failed.');
      process.exitCode = 1;
    } else {
      console.log('PHASE 32: MOTOR-MIGRATION-01 completed successfully.');
    }
  } catch (error) {
    console.error('Fatal error during migration:', error);
    process.exitCode = 1;
  } finally {
    await prisma.$disconnect();
  }
}

void main();
