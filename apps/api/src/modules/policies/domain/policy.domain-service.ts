import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { PolicyStatus, QuotationStatus } from '@prisma/client';
import { PolicyStateMachine } from './policy-state-machine';
import { Money } from '../../../common/domain/value-objects/money.value-object';

@Injectable()
export class PolicyDomainService {
  /**
   * Domain rules for issuing a policy from an approved quotation.
   */
  validateIssuance(
    quotation: {
      status: QuotationStatus;
      deletedAt?: Date | null;
      totalPremium: any;
    },
    nominees: { percentage: number }[],
    hasExistingPolicy: boolean,
  ): void {
    // 1. Quotation status check
    if (quotation.status !== QuotationStatus.APPROVED) {
      throw new BadRequestException(
        `Quotation status is ${quotation.status}. It must be APPROVED to issue a policy.`,
      );
    }

    // 2. Duplicate Policy check
    if (hasExistingPolicy) {
      throw new ConflictException(
        'A policy has already been issued for this quotation',
      );
    }

    // 3. Nominees allocation percentages check
    const totalPercentage = nominees.reduce((sum, n) => sum + n.percentage, 0);
    if (totalPercentage !== 100) {
      throw new BadRequestException(
        'Nominee allocation percentages must sum to exactly 100%',
      );
    }
  }

  /**
   * Domain rules for cancelling a policy.
   */
  validateCancellation(currentStatus: PolicyStatus): void {
    PolicyStateMachine.validateTransition(
      currentStatus,
      PolicyStatus.CANCELLED,
    );
  }

  /**
   * Domain rules for renewing a policy.
   */
  validateRenewal(
    currentStatus: PolicyStatus,
    previousExpiry: Date,
    newExpiry: Date,
    premiumAmount: number | string,
  ): void {
    // 1. Enforce State Machine transition
    PolicyStateMachine.validateTransition(currentStatus, PolicyStatus.ACTIVE);

    // 2. Expiry dates validation
    if (newExpiry <= previousExpiry) {
      throw new BadRequestException(
        'New expiry date must be after previous expiry date',
      );
    }

    // 3. Premium amount validation using Money value object
    const moneyPremium = Money.from(premiumAmount);
    if (moneyPremium.toNumber() <= 0) {
      throw new BadRequestException(
        'Premium amount for renewal must be greater than zero',
      );
    }
  }
}
