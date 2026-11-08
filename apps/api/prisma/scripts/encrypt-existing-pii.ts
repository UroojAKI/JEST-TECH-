import { Prisma, PrismaClient } from '@prisma/client';
import { EncryptionUtil } from '../../src/common/utils/encryption.util';

const prisma = new PrismaClient();
const BATCH_SIZE = 250;
const PII_KEYS = /^(pan(number)?|aadhaar(number)?|proposerpan|proposeraadhaar)$/i;

function isPlainObject(value: unknown): value is Record<string, any> {
  if (!value || typeof value !== 'object') return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function encryptNestedPii(value: any): { value: any; changed: boolean } {
  if (Array.isArray(value)) {
    let changed = false;
    const items = value.map((item) => {
      const result = encryptNestedPii(item);
      changed ||= result.changed;
      return result.value;
    });
    return { value: items, changed };
  }
  if (!isPlainObject(value)) return { value, changed: false };

  let changed = false;
  const result: Record<string, any> = {};
  for (const [key, item] of Object.entries(value)) {
    if (typeof item === 'string' && PII_KEYS.test(key)) {
      const encrypted = EncryptionUtil.encryptIfNeeded(item);
      result[key] = encrypted;
      changed ||= encrypted !== item;
    } else {
      const nested = encryptNestedPii(item);
      result[key] = nested.value;
      changed ||= nested.changed;
    }
  }
  return { value: result, changed };
}

function getDelegate(modelName: string): any {
  return (prisma as any)[modelName.charAt(0).toLowerCase() + modelName.slice(1)];
}

async function backfillModel(model: any): Promise<number> {
  const modelName = model.name as string;
  const fields = model.fields as Array<any>;
  const idField = fields.find((field) => field.name === 'id' && field.kind === 'scalar');
  if (!idField) return 0;

  const directPiiFields = fields
    .filter((field) => field.kind === 'scalar' && ['panNumber', 'aadhaarNumber'].includes(field.name))
    .map((field) => field.name);
  const hasPanHash = fields.some((field) => field.name === 'panNumberHash');
  const jsonFields = fields
    .filter((field) => field.kind === 'scalar' && field.type === 'Json')
    .map((field) => field.name);

  if (directPiiFields.length === 0 && jsonFields.length === 0) return 0;
  const delegate = getDelegate(modelName);
  if (!delegate?.findMany || !delegate?.update) return 0;

  const select: Record<string, boolean> = { id: true };
  for (const field of directPiiFields) select[field] = true;
  if (hasPanHash) select.panNumberHash = true;
  for (const field of jsonFields) select[field] = true;

  let cursor: any;
  let updated = 0;
  while (true) {
    const rows = await delegate.findMany({
      take: BATCH_SIZE,
      orderBy: { id: 'asc' },
      ...(cursor !== undefined ? { cursor: { id: cursor }, skip: 1 } : {}),
      select,
    });
    if (rows.length === 0) break;

    for (const row of rows) {
      const data: Record<string, any> = {};

      for (const field of directPiiFields) {
        const value = row[field];
        if (typeof value === 'string' && value) {
          const encrypted = EncryptionUtil.encryptIfNeeded(value);
          if (encrypted !== value) data[field] = encrypted;
        }
      }

      if (hasPanHash && typeof row.panNumber === 'string' && row.panNumber) {
        const hash = EncryptionUtil.hashPan(row.panNumber);
        if (row.panNumberHash !== hash) data.panNumberHash = hash;
      }

      for (const field of jsonFields) {
        const nested = encryptNestedPii(row[field]);
        if (nested.changed) data[field] = nested.value;
      }

      if (Object.keys(data).length > 0) {
        await delegate.update({ where: { id: row.id }, data });
        updated++;
      }
    }

    cursor = rows[rows.length - 1].id;
  }

  if (updated > 0) {
    console.info(`[PII BACKFILL] ${modelName}: ${updated} record(s) updated`);
  }
  return updated;
}

async function main() {
  if (!process.env.PII_ENCRYPTION_KEY || process.env.PII_ENCRYPTION_KEY.length < 32) {
    throw new Error('PII_ENCRYPTION_KEY (minimum 32 characters) must be configured before running the PII backfill.');
  }

  let total = 0;
  for (const model of Prisma.dmmf.datamodel.models) {
    total += await backfillModel(model);
  }
  console.info(`[PII BACKFILL] Completed. ${total} record(s) updated across Prisma models. No PII values were logged.`);
}

main()
  .catch((error) => {
    console.error('[PII BACKFILL] Failed:', error instanceof Error ? error.message : 'Unknown error');
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
