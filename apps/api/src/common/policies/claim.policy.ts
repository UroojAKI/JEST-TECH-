import { Injectable, ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

/**
 * ClaimPolicy — authorization rules for Claim resources.
 *
 * ADMIN semantic: ADMIN is company-scoped, NOT global.
 *   if (actor.role === ADMIN) → only allowed if resource.companyId === actor.companyId
 *
 * Claim creation authority (locked decision):
 *   BACK_OFFICE: CREATE + VIEW/manage within company (or branch if branch-scoped)
 *   AGENT: VIEW assigned claims only — NO creation
 *   ADMIN: MANAGE claims within own company only
 */
@Injectable()
export class ClaimPolicy {
  canRead(actor: ActorContext, claim: any): boolean {
    if (!actor?.userId) return false;

    const claimCompanyId =
      claim.companyId ||
      claim.createdBy?.companyId ||
      claim.policy?.companyId;

    // ADMIN: company-scoped, not global — must match actor.companyId
    if (actor.role === RoleType.ADMIN) {
      return claimCompanyId === actor.companyId;
    }

    if (actor.role === RoleType.BACK_OFFICE) {
      if (claimCompanyId && claimCompanyId !== actor.companyId) {
        return false;
      }
      // Branch-scoped BACK_OFFICE: further restrict to own branch
      if (actor.branchId) {
        const claimBranchId = claim.branchId || claim.policy?.branchId;
        if (claimBranchId && claimBranchId !== actor.branchId) {
          return false;
        }
      }
      return true;
    }

    if (actor.role === RoleType.AGENT) {
      // AGENT: view assigned claims only — same company implied
      if (claimCompanyId && claimCompanyId !== actor.companyId) {
        return false;
      }
      return (
        claim.createdById === actor.userId ||
        claim.policy?.createdById === actor.userId ||
        claim.policy?.agentId === actor.userId
      );
    }

    return false;
  }

  /**
   * Claim creation authority (BACK_OFFICE only per locked decision Q5).
   * AGENT cannot create claims. ADMIN can create within own company.
   */
  canCreate(actor: ActorContext): boolean {
    if (!actor?.userId) return false;
    return (
      actor.role === RoleType.BACK_OFFICE || actor.role === RoleType.ADMIN
    );
  }

  canUpdate(actor: ActorContext, claim: any): boolean {
    return this.canRead(actor, claim);
  }

  canApprove(actor: ActorContext, claim?: any): boolean {
    // Agents CANNOT approve claims
    if (actor.role === RoleType.AGENT) return false;

    // Segregation of Duties: Creator cannot approve own claim
    if (claim && claim.createdById === actor.userId) {
      throw new ForbiddenException(
        'Segregation of duties violation: Claim creator cannot self-approve claim',
      );
    }

    if (actor.role === RoleType.ADMIN) {
      if (claim) {
        const claimCompanyId =
          claim.companyId ||
          claim.createdBy?.companyId ||
          claim.policy?.companyId;
        return claimCompanyId === actor.companyId;
      }
      return true;
    }

    return actor.role === RoleType.BACK_OFFICE;
  }

  canReject(actor: ActorContext): boolean {
    return actor.role === RoleType.ADMIN || actor.role === RoleType.BACK_OFFICE;
  }

  canSettle(actor: ActorContext, claim?: any): boolean {
    if (actor.role === RoleType.AGENT) return false;

    if (claim && claim.createdById === actor.userId) {
      throw new ForbiddenException(
        'Segregation of duties violation: Claim creator cannot self-settle claim',
      );
    }

    return actor.role === RoleType.ADMIN || actor.role === RoleType.BACK_OFFICE;
  }

  canExport(actor: ActorContext): boolean {
    return actor.role === RoleType.ADMIN || actor.role === RoleType.BACK_OFFICE;
  }
}
