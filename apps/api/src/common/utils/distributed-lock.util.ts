import { Logger } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

/**
 * Execute an asynchronous function under a PostgreSQL advisory lock.
 * Prevents overlapping cron/worker execution across multi-pod deployments.
 *
 * @param prisma PrismaService instance
 * @param lockKey A unique string identifier for the job
 * @param fn The callback function to execute if the lock is successfully acquired
 * @param logger Optional Logger instance for diagnostics
 * @returns The result of fn, or null if another instance already holds the lock
 */
export async function withDistributedLock<T>(
  prisma: PrismaService,
  lockKey: string,
  fn: () => Promise<T>,
  logger?: Logger,
): Promise<T | null> {
  let lockAcquired = false;

  try {
    if (typeof (prisma as any).$queryRaw === 'function') {
      const result = await prisma.$queryRaw<Array<{ locked: boolean }>>`
        SELECT pg_try_advisory_lock(hashtext(${lockKey})) AS locked
      `;
      lockAcquired = Boolean(result?.[0]?.locked);
    } else {
      lockAcquired = true;
    }
  } catch (_err) {
    // Non-PostgreSQL environments (e.g., unit test mocks, SQLite) fall back to execute
    lockAcquired = true;
  }

  if (!lockAcquired) {
    logger?.log(
      `[DistributedLock] Task '${lockKey}' is currently executing on another replica. Skipping this cycle.`,
    );
    return null;
  }

  try {
    return await fn();
  } finally {
    if (lockAcquired) {
      try {
        if (typeof (prisma as any).$queryRaw === 'function') {
          await prisma.$queryRaw`
            SELECT pg_advisory_unlock(hashtext(${lockKey}))
          `;
        }
      } catch {
        // Connection drops / non-Postgres environments will automatically free or ignore
      }
    }
  }
}
