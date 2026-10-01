import { PrismaClient, BackOfficeTaskStatus } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('=== Wave 2 WF-006B: Backfill caseId on BackOfficeTask ===');

  const tasks = await prisma.backOfficeTask.findMany({
    where: { caseId: null },
  });

  console.log(`Found ${tasks.length} tasks without caseId`);

  let linkedViaQuotation = 0;
  let linkedViaLead = 0;
  let unresolvable = 0;

  for (const task of tasks) {
    let resolvedCaseId: string | null = null;

    // 1. Try via motorQuotationId
    if (task.motorQuotationId) {
      const q = await prisma.quotation.findFirst({
        where: { id: task.motorQuotationId },
        select: { caseId: true },
      });
      if (q?.caseId) {
        resolvedCaseId = q.caseId;
        linkedViaQuotation++;
      }
    }

    // 2. Try via leadId if still not resolved
    if (!resolvedCaseId && task.leadId) {
      const c = await prisma.motorQuotationCase.findFirst({
        where: { leadId: task.leadId, companyId: task.companyId },
        orderBy: { createdAt: 'desc' },
        select: { id: true },
      });
      if (c?.id) {
        resolvedCaseId = c.id;
        linkedViaLead++;
      }
    }
    if (resolvedCaseId) {
      await prisma.backOfficeTask.update({
        where: { id: task.id },
        data: { caseId: resolvedCaseId },
      });
    } else {
      // Non-destructive orphan reconciliation: mark UNRESOLVED_MIGRATION
      await prisma.backOfficeTask.update({
        where: { id: task.id },
        data: { status: BackOfficeTaskStatus.UNRESOLVED_MIGRATION },
      });
      unresolvable++;
    }
  }

  console.log('Reconciliation complete:', {
    totalTasks: tasks.length,
    linkedViaQuotatiol,
    linkedViaLead,
    unresolvable,
  });

  const report = {
    timestamp: new Date().toISOString(),
    totalCandidates: tasks.length,
    linkedViaQuotation,
    linkedViaLead,
    unresolvable,
    strategy: 'non-destructive reconciliation via UNRESOLVED_MIGRATION as defined in WF-006B',
  };

  const outDir = path.join(process.cwd(), 'docs', 'audit', 'baseline');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, 'task-reconciliation-report.json'),
    JSON.stringify(report, null, 2),
  );

  console.log('Task reconciliation report saved');
}

main()
  .catch((e) => {
    console.error('Task backfill failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
