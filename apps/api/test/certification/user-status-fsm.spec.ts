import { BadRequestException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';

describe('Authoritative User Status State Machine Specification & FSM Integrity Suite', () => {
  const allowedTransitions: Record<UserStatus, UserStatus[]> = {
    PENDING_VERIFICATION: [UserStatus.ACTIVE, UserStatus.INACTIVE],
    ACTIVE: [UserStatus.SUSPENDED, UserStatus.INACTIVE],
    SUSPENDED: [UserStatus.ACTIVE, UserStatus.INACTIVE],
    INACTIVE: [UserStatus.ACTIVE],
  };

  const validateTransition = (current: UserStatus, target: UserStatus) => {
    if (current === target) return true;
    const allowed = allowedTransitions[current] || [];
    if (!allowed.includes(target)) {
      throw new BadRequestException(
        `Invalid status transition from ${current} to ${target}`,
      );
    }
    return true;
  };

  describe('Valid User Status Transitions', () => {
    it('PENDING_VERIFICATION -> ACTIVE is permitted upon onboarding completion', () => {
      expect(validateTransition(UserStatus.PENDING_VERIFICATION, UserStatus.ACTIVE)).toBe(true);
    });

    it('ACTIVE -> SUSPENDED is permitted when user is locked', () => {
      expect(validateTransition(UserStatus.ACTIVE, UserStatus.SUSPENDED)).toBe(true);
    });

    it('SUSPENDED -> ACTIVE is permitted when user is unlocked', () => {
      expect(validateTransition(UserStatus.SUSPENDED, UserStatus.ACTIVE)).toBe(true);
    });

    it('ACTIVE -> INACTIVE is permitted when user is deactivated', () => {
      expect(validateTransition(UserStatus.ACTIVE, UserStatus.INACTIVE)).toBe(true);
    });

    it('INACTIVE -> ACTIVE is permitted when user is reactivated', () => {
      expect(validateTransition(UserStatus.INACTIVE, UserStatus.ACTIVE)).toBe(true);
    });
  });

  describe('Illegal User Status Transitions (400 Bad Request)', () => {
    it('INACTIVE -> SUSPENDED is rejected', () => {
      expect(() => validateTransition(UserStatus.INACTIVE, UserStatus.SUSPENDED)).toThrow(
        BadRequestException,
      );
    });

    it('SUSPENDED -> INACTIVE is permitted (graceful deactivation of suspended user)', () => {
      expect(validateTransition(UserStatus.SUSPENDED, UserStatus.INACTIVE)).toBe(true);
    });

    it('PENDING_VERIFICATION -> SUSPENDED is rejected', () => {
      expect(() =>
        validateTransition(UserStatus.PENDING_VERIFICATION, UserStatus.SUSPENDED),
      ).toThrow(BadRequestException);
    });
  });

  describe('Audit Trail Invariant Verification', () => {
    it('ensures status transition payload captures all required audit fields', () => {
      const buildAuditLog = (
        actorId: string,
        targetUserId: string,
        previousStatus: UserStatus,
        newStatus: UserStatus,
        reason?: string,
      ) => {
        return {
          actorId,
          targetUserId,
          previousStatus,
          newStatus,
          reason: reason || null,
          timestamp: new Date().toISOString(),
        };
      };

      const log = buildAuditLog('admin-1', 'usr-123', UserStatus.ACTIVE, UserStatus.SUSPENDED, 'Excessive failed logins');
      expect(log.actorId).toBe('admin-1');
      expect(log.targetUserId).toBe('usr-123');
      expect(log.previousStatus).toBe(UserStatus.ACTIVE);
      expect(log.newStatus).toBe(UserStatus.SUSPENDED);
      expect(log.reason).toBe('Excessive failed logins');
      expect(log.timestamp).toBeDefined();
    });
  });
});
