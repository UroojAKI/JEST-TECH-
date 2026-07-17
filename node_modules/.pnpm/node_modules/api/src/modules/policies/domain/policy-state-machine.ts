import { PolicyStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

export class PolicyStateMachine {
  private static readonly ALLOWED_TRANSITIONS: Record<PolicyStatus, PolicyStatus[]> = {
    [PolicyStatus.ACTIVE]: [
      PolicyStatus.PENDING_RENEWAL,
      PolicyStatus.LAPSED,
      PolicyStatus.CANCELLED,
    ],
    [PolicyStatus.PENDING_RENEWAL]: [
      PolicyStatus.ACTIVE,
      PolicyStatus.LAPSED,
      PolicyStatus.CANCELLED,
    ],
    [PolicyStatus.LAPSED]: [
      PolicyStatus.ACTIVE,
      PolicyStatus.CANCELLED,
    ],
    [PolicyStatus.CANCELLED]: [], // Terminal state
  };

  static validateTransition(currentStatus: PolicyStatus, targetStatus: PolicyStatus): void {
    if (currentStatus === targetStatus) {
      return;
    }
    const allowed = this.ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid policy status transition from ${currentStatus} to ${targetStatus}`,
      );
    }
  }
}
