import { Injectable, BadRequestException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

/**
 * PolicyPolicy — authorization rules for Policy (insurance policy) resources.
 *
 * ADMIN semantic: ADMIN is company-scoped, NOT global.
 *   if (actor.role === ADMIN) → only allowed if policy.companyId === actor.companyId
 */
@Injectable()
export class PolicyPolicy {
  canRead(actor: ActorContext, policy: any): boolean {
    if (!actor?.userId) return false;

    const policyCompanyId =
      policy.companyId ||
      policy.createdBy?.companyId ||
      policy.quotation?.companyId;

    // ADMIN: company-scoped, not global
    if (actor.role === RoleType.ADMIN) {
      return policyCompanyId === actor.companyId;
    }

    if (actor.role === RoleType.BACK_OFFICE) {
      if (policyCompanyId && policyCompanyId !== actor.companyId) {
        return false;
      }
      return true;
    }

    if (actor.role === RoleType.AGENT) {
      if (policyCompanyId && policyCompanyId !== actor.companyId) {
        return false;
      }
      return (
        policy.createdById === actor.userId ||
        policy.agentId === actor.userId ||
        policy.quotation?.createdById === actor.userId
      );
    }

    return false;
  }

  canCreate(actor: ActorContext): boolean {
    if (!actor?.userId) return false;
    return [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT].includes(
      actor.role,
    );
  }

  canUpdate(actor: ActorContext, policy: any): boolean {
    return this.canRead(actor, policy);
  }

  canIssue(actor: ActorContext): boolean {
    // Strictly Back Office and Admin. Field agents cannot issue policies directly.
    return (
      actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE
    );
  }

  canCancel(actor: ActorContext): boolean {
    // Strictly Back Office and Admin.
    return (
      actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE
    );
  }

  canExport(actor: ActorContext): boolean {
    return (
      actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE
    );
  }

  /**
   * Domain Invariant Assertion: Dates must always be logically sound.
   * Admin != Business Rule Bypass.
   */
  assertValidDates(effectiveDate: Date, expiryDate: Date): void {
    const eff = new Date(effectiveDate);
    const exp = new Date(expiryDate);
    if (isNaN(eff.getTime()) || isNaN(exp.getTime())) {
      throw new BadRequestException(
        'Effective date and expiry date must be valid timestamps',
      );
    }
    if (exp <= eff) {
      throw new BadRequestException(
        'Policy expiryDate must strictly be after effectiveDate',
      );
    }
  }
}
