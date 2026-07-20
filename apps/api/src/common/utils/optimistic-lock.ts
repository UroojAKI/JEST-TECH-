import { ConflictException, NotFoundException } from '@nestjs/common';

/**
 * Checks if the expected version matches the current record version.
 * If there is a mismatch, throws a ConflictException.
 * Returns the next version number.
 */
export async function checkOptimisticLock(
  modelDelegate: any,
  id: string,
  expectedVersion: number | undefined,
): Promise<number> {
  if (expectedVersion === undefined) {
    return 1;
  }

  const record = await modelDelegate.findFirst({
    where: { id },
    select: { version: true },
  });

  if (!record) {
    throw new NotFoundException(`Record with ID ${id} not found`);
  }

  if (record.version !== expectedVersion) {
    throw new ConflictException(
      `Optimistic locking conflict: The record has been modified by another user. Expected version ${expectedVersion}, but database has version ${record.version}. Please refresh and try again.`,
    );
  }

  return record.version + 1;
}
