import { withDistributedLock } from './distributed-lock.util';
import { Logger } from '@nestjs/common';

describe('withDistributedLock', () => {
  let mockPrisma: any;
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('TestLock');
    jest.spyOn(logger, 'log').mockImplementation(() => {});
    jest.spyOn(logger, 'warn').mockImplementation(() => {});
  });

  it('should acquire lock, execute callback, unlock, and return result', async () => {
    mockPrisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ locked: true }]) // try lock
        .mockResolvedValueOnce([{ unlocked: true }]), // unlock
    };

    const task = jest.fn().mockResolvedValue('task-result');

    const result = await withDistributedLock(
      mockPrisma,
      'test_cron_job',
      task,
      logger,
    );

    expect(result).toBe('task-result');
    expect(task).toHaveBeenCalledTimes(1);
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2);
  });

  it('should skip callback and return null if lock is already held by another replica', async () => {
    mockPrisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ locked: false }]), // lock failed
    };

    const task = jest.fn().mockResolvedValue('task-result');

    const result = await withDistributedLock(
      mockPrisma,
      'test_cron_job',
      task,
      logger,
    );

    expect(result).toBeNull();
    expect(task).not.toHaveBeenCalled();
    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(1); // Only lock attempt, no unlock
  });

  it('should release lock in finally block even if callback throws', async () => {
    mockPrisma = {
      $queryRaw: jest
        .fn()
        .mockResolvedValueOnce([{ locked: true }])
        .mockResolvedValueOnce([{ unlocked: true }]),
    };

    const task = jest.fn().mockRejectedValue(new Error('Task crashed'));

    await expect(
      withDistributedLock(mockPrisma, 'test_cron_job', task, logger),
    ).rejects.toThrow('Task crashed');

    expect(mockPrisma.$queryRaw).toHaveBeenCalledTimes(2); // Attempt lock + unlock in finally
  });

  it('should execute task safely when $queryRaw is unavailable (mock DB)', async () => {
    mockPrisma = {};

    const task = jest.fn().mockResolvedValue('fallback-result');

    const result = await withDistributedLock(
      mockPrisma,
      'test_cron_job',
      task,
      logger,
    );

    expect(result).toBe('fallback-result');
    expect(task).toHaveBeenCalledTimes(1);
  });
});
