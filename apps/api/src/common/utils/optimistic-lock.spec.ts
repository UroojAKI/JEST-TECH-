import { checkOptimisticLock } from './optimistic-lock';
import { ConflictException, NotFoundException } from '@nestjs/common';

describe('checkOptimisticLock (G028 Optimistic Concurrency Control)', () => {
  let mockDelegate: any;

  beforeEach(() => {
    mockDelegate = {
      findFirst: jest.fn(),
    };
  });

  it('should return 1 and bypass check if expectedVersion is undefined', async () => {
    const nextVersion = await checkOptimisticLock(
      mockDelegate,
      'rec-1',
      undefined,
    );
    expect(nextVersion).toBe(1);
    expect(mockDelegate.findFirst).not.toHaveBeenCalled();
  });

  it('should throw NotFoundException if record does not exist', async () => {
    mockDelegate.findFirst.mockResolvedValue(null);

    await expect(
      checkOptimisticLock(mockDelegate, 'rec-404', 2),
    ).rejects.toThrow(NotFoundException);
    expect(mockDelegate.findFirst).toHaveBeenCalledWith({
      where: { id: 'rec-404' },
      select: { version: true },
    });
  });

  it('should throw ConflictException (409) when database version does not match expectedVersion', async () => {
    mockDelegate.findFirst.mockResolvedValue({ version: 3 });

    await expect(checkOptimisticLock(mockDelegate, 'rec-1', 2)).rejects.toThrow(
      ConflictException,
    );
  });

  it('should increment and return nextVersion when expectedVersion matches current database version', async () => {
    mockDelegate.findFirst.mockResolvedValue({ version: 5 });

    const nextVersion = await checkOptimisticLock(mockDelegate, 'rec-1', 5);
    expect(nextVersion).toBe(6);
  });
});
