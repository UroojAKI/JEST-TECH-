import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Wave 2: MotorCaseStatus Data Migration ===');

  const beforeCounts = {
    OPEN: await prisma.motorQuotationCase.count({ where: { status: 'OPEN' as any } }),
    QUOTED: await prisma.motorQuotationCase.count({ where: { status: 'QUOTED' as any } }),
    SELECTED: await prisma.motorQuotationCase.count({ where: { status: 'SELECTED' as any } }),
    DRAFT: await prisma.motorQuotationCase.count({ where: { status: 'DRAFT' as any } }),
    QUOTE_GENERATED: await prisma.motorQuotationCase.count({ where: { status: 'QUOTE_GENERATED' as any } }),
    PROPOSAL_READY: await prisma.motorQuotationCase.count({ where: { status: 'PROPOSAL_READY' as any } }),
    COMPLETED: await prisma.motorQuotationCase.count({ where: { status: 'COMPLETED' as any } }),
    CANCELLED: await prisma.motorQuotationCase.count({ where: { status: 'CANCELLED' as any } }),
  };

  console.log('Before migration status distribution:', beforeCounts);

  const migrated = await prisma.$transaction(async (tx) => {
    const r1 = await tx.$executeRawUnsafe(
      UPDATE motor_quotation_cases SET status = 'DRAFT'::"motorCaseStatus" WHERE status = 'OPEN'::"MotorCaseStatus"
    );
    const r2 = await tx.$executeRawUnsafe(
      UPDATE motor_quotation_cases SET status = 'QUOTE_GENERATED'::"MotorCaseStatus" WHERE status = 'QUOTED'::"motorCaseStatus"
    );
    const r3 = await tx.$executeRawUnsafe(
      UPDATE motor_quotation_cases SET status = 'PROPOSAL_READY'::"MotorCaseStatus" WHERE status = 'SELECTED'::"MotorCaseStatus"
    );
    return { openToDraft: r1, quotedToGenerated: r2, selectedToReady: r3 };
  });

  const afterCounts = {
    OPEN: await prisma.motorQuotationCase.count({ where: { status: 'OPEN' as any } }),
    QUOTED: await prisma.motorQuotationCase.count({ where: { status: 'QUOTED' as any } }),
    SELECTED: await prisma.motorQuotationCase.count({ where: { status: 'SELECTED' as any } }),
    DRAFT: await prisma.motorQuotationCase.count({ where: { status: 'DRAFT' as any } }),
    QUOTE_GENERATED: await prisma.motorQuotationCase.count({ where: { status: 'QUOTE_GENERATED' as any } }),
    PROPOSAL_READY: await prisma.motorQuotationCase.count({ where: { status: 'PROPOSAL_READY' as any } }),
    COMPLETED: await prisma.motorQuotationCase.count({ where: { status: 'COMPLETED' as any } }),
    CANCELLED: await prisma.motorQuotationCase.count({ where: { status: 'CANCELLED' as any } }),
  };

  console.log('After migration status distribution:', afterCounts);

  const report = {
    timestamp: new Date().toISOString(),
    migratedRows: migrated,
    beforeCounts,
    afterCounts,
    success: afterCounts.OPEN === 0 && afterCounts.QUOTED === 0 && afterCounts.SELECTED === 0,
  };

  const outDir = path.join(process.cwd(), 'docs', 'audit', 'baseline');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'status-migration-report.json'),
    JSON.stringify(report, null, 2),
  );

  console.log('Status migration report saved to docs/audit/baseline/status-migration-report.json');
}

main()
  .catch((e) => {
    console.error('Migration failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
