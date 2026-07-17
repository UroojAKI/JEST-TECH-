import { ClaimStatus } from '@prisma/client';
import { BadRequestException } from '@nestjs/common';

export class ClaimStateMachine {
  private static readonly ALLOWED_TRANSITIONS: Record<ClaimStatus, ClaimStatus[]> = {
    [ClaimStatus.REPORTED]: [
      ClaimStatus.REGISTERED,
      ClaimStatus.REJECTED,
      ClaimStatus.CLOSED,
    ],
    [ClaimStatus.REGISTERED]: [
      ClaimStatus.SURVEYOR_ASSIGNED,
      ClaimStatus.UNDER_ASSESSMENT,
      ClaimStatus.REJECTED,
      ClaimStatus.CLOSED,
    ],
    [ClaimStatus.SURVEYOR_ASSIGNED]: [
      ClaimStatus.UNDER_ASSESSMENT,
      ClaimStatus.REJECTED,
      ClaimStatus.CLOSED,
    ],
    [ClaimStatus.UNDER_ASSESSMENT]: [
      ClaimStatus.APPROVED,
      ClaimStatus.REJECTED,
      ClaimStatus.CLOSED,
    ],
    [ClaimStatus.APPROVED]: [
      ClaimStatus.PAYMENT_PENDING,
      ClaimStatus.SETTLED,
      ClaimStatus.CLOSED,
    ],
    [ClaimStatus.REJECTED]: [
      ClaimStatus.CLOSED,
    ],
    [ClaimStatus.PAYMENT_PENDING]: [
      ClaimStatus.SETTLED,
      ClaimStatus.CLOSED,
    ],
    [ClaimStatus.SETTLED]: [
      ClaimStatus.CLOSED,
    ],
    [ClaimStatus.CLOSED]: [], // Terminal state
  };

  static validateTransition(currentStatus: ClaimStatus, targetStatus: ClaimStatus): void {
    if (currentStatus === targetStatus) {
      return;
    }
    const allowed = this.ALLOWED_TRANSITIONS[currentStatus];
    if (!allowed || !allowed.includes(targetStatus)) {
      throw new BadRequestException(
        `Invalid claim status transition from ${currentStatus} to ${targetStatus}`,
      );
    }
  }
}
