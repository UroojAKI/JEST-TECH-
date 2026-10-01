import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Wave 2: MotorCaseStatus Rollback ===');

  const rollback = await prisma.$transaction(async (tx) => {
    const r1 = await tx.$executeRawUnsafe(
      UPDATE motor_quotation_cases SET status = 'OPEN'::"MotorCaseStatus" WHERE status = 'DRAFT'::"MotorCaseStatus"
    );
    const r2 = await tx.$executeRawUnsafe(
      UPDATE motor_quotation_cases SET status = 'QUOTED'::"MotorCaseStatus" WHERE status = 'QUOTE_GENERATED'::"MotorCaseStatus"
    );
    const r3 = await tx.$executeRawUnsafe(
      UPDATE motor_quotation_cases SET status = 'SELECTED'::"MotorCaseStatus" WHERE status = 'PROPOSAL_READY'::"MotorCaseStatus"
    );
    return { draftToOpen: r1, generatedToQuoted: r2, readyToSelected: r3 };
  });

  const report = {
    timestamp: new Date().toISOString(),
    rollbackRows: rollback,
    success: true,
  };

  const outDir = path.join(process.cwd(), 'docs', 'audit', 'baseline');
  if (!fs.existsSync((outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'status-rollback-report.json'),
    JSON.stringify(report, null, 2),
  );

  console.log('Status rollback report saved');
}

main()
  .catch((e) => {
    console.error("Rollback failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
