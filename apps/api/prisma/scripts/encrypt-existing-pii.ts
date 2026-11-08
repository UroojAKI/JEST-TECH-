import { PrismaClient } from '@prisma/client';
import { EncryptionUtil } from '../../src/common/utils/encryption.util';

const prisma = new PrismaClient();
const BATCH_SIZE = 250;

type PiiRow = {
  id: string;
  panNumber: string | null;
  panNumberHash: string | null;
  aadhaarNumber?: string | null;
};

async function backfillModel(label: string, model: any, hasAadhaar: boolean): Promise<number> {
  let cursor: string | undefined;
  let updated = 0;

  while (true) {
    const rows: PiiRow[] = await model.findMany({
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
      select: {
        id: true,
        panNumber: true,
        panNumberHash: true,
        ...(hasAadhaar ? { aadhaarNumber: true } : {}),
      },
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const data: Record<string, string | null> = {};
      const plainPan = EncryptionUtil.decryptIfEncrypted(row.panNumber);
      const nextHash = EncryptionUtil.hashPan(plainPan);
      if (plainPan && !EncryptionUtil.isEncrypted(row.panNumber)) {
        data.panNumber = EncryptionUtil.encryptIfNeeded(plainPan) as string;
      }
      if (row.panNumberHash !== nextHash) data.panNumberHash = nextHash;

      if (hasAadhaar && row.aadhaarNumber) {
        const plainAadhaar = EncryptionUtil.decryptIfEncrypted(row.aadhaarNumber);
        if (plainAadhaar && !EncryptionUtil.isEncrypted(row.aadhaarNumber)) {
          data.aadhaarNumber = EncryptionUtil.encryptIfNeeded(plainAadhaar) as string;
        }
      }

      if (Object.keys(data).length > 0) {
        await model.update({ where: { id: row.id }, data });
        updated++;
      }
    }

    cursor = rows[rows.length - 1].id;
  }

  console.info(`[PII BACKFILL] ${label}: ${updated} record(s) updated`);
  return updated;
}

async function main() {
  if (!process.env.PII_ENCRYPTION_KEY || process.env.PII_ENCRYPTION_KEY.length < 32) {
    throw new Error('PII_ENCRYPTION_KEY (minimum 32 characters) must be configured before running the PII backfill.');
  }

  let total = 0;
  total += await backfillModel('contacts', prisma.contact, true);
  total += await backfillModel('customers', prisma.customer, true);
  total += await backfillModel('accounts', prisma.account, false);
  console.info(`[PII BACKFILL] Completed. ${total} record(s) updated. No PII values were logged.`);
}

main()
  .catch((error) => {
    console.error('[PII BACKFILL] Failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
