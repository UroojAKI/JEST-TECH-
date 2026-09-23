import { Injectable } from '@nestjs/common';
import { ActorContext } from '../interfaces/actor-context.interface';
import { CrossTenantException, CrossBranchException } from './tenant-exception';

/**
 * Canonical tenant authorization service for JEST Policy CRM.
 *
 * Security invariants (non-negotiable):
 *  1. ADMIN never means global. ADMIN is bounded by actor.companyId.
 *  2. BACK_OFFICE with branchId=null: company-wide within actor.companyId.
 *  3. BACK_OFFICE with branchId set: restricted to that branch within actor.companyId.
 *  4. AGENT: own records + assigned records within actor.companyId.
 *  5. NULL/undefined resource IDs are treated as DENY (fail-closed).
 *
 * Usage:
 *   this.tenantAuth.assertSameCompany(actor, resource.companyId);
 *   this.tenantAuth.assertSameBranch(actor, resource.branchId);
 */
@Injectable()
export class TenantAuthorizationService {
  /**
   * Asserts that the actor's companyId matches the resource's companyId.
   * Throws CrossTenantException on violation or if either ID is missing.
   */
  assertSameCompany(actor: ActorContext, resourceCompanyId: string | null | undefined): void {
    if (!resourceCompanyId) {
      // Fail-closed: if we cannot determine the resource's company, deny access.
      throw new CrossTenantException(
        'Access denied: resource has no company attribution',
      );
    }

    if (!actor?.companyId) {
      throw new CrossTenantException(
        'Access denied: actor has no company attribution',
      );
    }

    if (actor.companyId !== resourceCompanyId) {
      throw new CrossTenantException();
    }
  }

  /**
   * Asserts that the actor's companyId matches the resource's companyId.
   * Returns true if same company, false if not (non-throwing variant for policy checks).
   */
  isSameCompany(actor: ActorContext, resourceCompanyId: string | null | undefined): boolean {
    if (!resourceCompanyId || !actor?.companyId) return false;
    return actor.companyId === resourceCompanyId;
  }

  /**
   * Asserts that the actor's branch scope includes the resource's branchId.
   *
   * Rules:
   * - actor.branchId = null → company-wide → any branch within the same company is allowed
   *   (company-level scope must already be validated by assertSameCompany)
   * - actor.branchId = X → only branchId = X is allowed
   *
   * Throws CrossBranchException on violation.
   */
  assertSameBranch(actor: ActorContext, resourceBranchId: string | null | undefined): void {
    // If actor has no branch restriction (company-wide), allow any branch within the company
    if (!actor.branchId) {
      return; // Company-wide — any branch is permitted (company check must happen separately)
    }

    // Actor IS branch-restricted: resource must match exactly
    if (!resourceBranchId || actor.branchId !== resourceBranchId) {
      throw new CrossBranchException();
    }
  }

  /**
   * Returns true if actor's branch scope covers the resource's branchId.
   * - actor.branchId = null → true (company-wide covers all branches)
   * - actor.branchId = X → only true if resourceBranchId === X
   */
  isSameBranch(actor: ActorContext, resourceBranchId: string | null | undefined): boolean {
    if (!actor.branchId) return true; // company-wide actor
    return actor.branchId === resourceBranchId;
  }
}
