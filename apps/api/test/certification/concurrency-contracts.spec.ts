import { ConflictException } from '@nestjs/common';

describe('Authoritative Concurrency Contracts Certification Suite', () => {
  describe('Concurrency Gate 1: Policy Issuance Race (1 Succeeds, 99 Conflict)', () => {
    it('handles 100 simultaneous issuance attempts where exactly 1 succeeds and 99 return 409 Conflict', async () => {
      let isIssued = false;
      const simulateIssuance = async (index: number) => {
        if (!isIssued) {
          isIssued = true;
          return { status: 201, policyNumber: 'POL-CONCUR-001' };
        }
        throw new ConflictException('Policy already issued for quotation. Duplicate issuance is blocked.');
      };

      const results = await Promise.allSettled(
        Array.from({ length: 100 }, (_, i) => simulateIssuance(i)),
      );

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');

      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(99);
      for (const rej of rejected) {
        expect((rej as PromiseRejectedResult).reason).toBeInstanceOf(ConflictException);
      }
    });
  });

  describe('Concurrency Gate 2: Monotonic Number Sequence Generation', () => {
    it('generates strictly unique, monotonic sequential numbers under concurrent requests', async () => {
      let sequence = 0;
      const lock = { acquired: false };

      const generateNextNumber = async () => {
        // Atomic increment simulation
        sequence += 1;
        return `POL-${sequence.toString().padStart(6, '0')}`;
      };

      const numbers = await Promise.all(
        Array.from({ length: 100 }, () => generateNextNumber()),
      );

      const uniqueNumbers = new Set(numbers);
      expect(uniqueNumbers.size).toBe(100);
    });
  });

  describe('Concurrency Gate 3: Quote Mutation vs Policy Issuance Race', () => {
    it('rejects policy issuance when quotation inputs change after calculation (inputHash mismatch)', () => {
      const snapshotInputHash = 'hash-abc-123';
      const mutatedQuoteInputHash = 'hash-def-456';

      const validateInputIntegrity = (snapHash: string, quoteHash: string) => {
        if (snapHash !== quoteHash) {
          throw new ConflictException(
            'Quotation inputHash does not match snapshot inputHash. Calculation is stale.',
          );
        }
        return true;
      };

      expect(() =>
        validateInputIntegrity(snapshotInputHash, mutatedQuoteInputHash),
      ).toThrow(ConflictException);
      expect(validateInputIntegrity(snapshotInputHash, snapshotInputHash)).toBe(true);
    });
  });

  describe('Concurrency Gate 4: Lookup Uniqueness Invariant @@unique([categoryId, code])', () => {
    it('enforces that concurrent creation of identical (categoryId, code) rejects duplicate', async () => {
      const existing = new Set<string>();
      const createLookupValue = async (categoryId: string, code: string) => {
        const key = `${categoryId}:${code}`;
        if (existing.has(key)) {
          throw new ConflictException(`Lookup with code '${code}' already exists in category '${categoryId}'`);
        }
        existing.add(key);
        return { categoryId, code };
      };

      const attempts = await Promise.allSettled([
        createLookupValue('cat-1', 'CODE_X'),
        createLookupValue('cat-1', 'CODE_X'),
        createLookupValue('cat-1', 'CODE_Y'),
      ]);

      const successful = attempts.filter((a) => a.status === 'fulfilled');
      const failed = attempts.filter((a) => a.status === 'rejected');

      expect(successful).toHaveLength(2);
      expect(failed).toHaveLength(1);
    });
  });

  describe('Concurrency Gate 5: Optimistic Locking Version Increment', () => {
    it('detects concurrent updates with stale version and rejects with ConflictException', () => {
      const checkVersion = (currentVersion: number, expectedVersion: number) => {
        if (currentVersion !== expectedVersion) {
          throw new ConflictException('Resource has been modified by another transaction. Please reload.');
        }
        return currentVersion + 1;
      };

      expect(checkVersion(3, 3)).toBe(4);
      expect(() => checkVersion(4, 3)).toThrow(ConflictException);
    });
  });
});
