import { ActorContext } from '../interfaces/actor-context.interface';

/**
 * Tenant scope that ALL Prisma queries against tenant-owned data MUST carry.
 * Never construct a TenantScope from client input — always derive it from ActorContext.
 */
export interface TenantScope {
  companyId: string;
  branchId?: string;
}

/**
 * Returns a company-wide scope (ADMIN and company-wide BACK_OFFICE).
 * ADMIN: all data within actor.companyId — never another company.
 * BACK_OFFICE with branchId=null: same as ADMIN scope for data access.
 */
export function companyScope(actor: ActorContext): TenantScope {
  return { companyId: actor.companyId };
}

/**
 * Returns a branch-restricted scope (branch-scoped BACK_OFFICE and AGENT).
 * If actor.branchId is null, falls back to company-wide scope.
 */
export function branchScope(actor: ActorContext): TenantScope {
  if (actor.branchId) {
    return { companyId: actor.companyId, branchId: actor.branchId };
  }
  return { companyId: actor.companyId };
}

/**
 * Returns the most restrictive scope applicable to the given actor.
 * ADMIN → companyId only.
 * BACK_OFFICE branchId=null → companyId only.
 * BACK_OFFICE branchId=X → companyId + branchId.
 * AGENT → companyId + branchId (if set).
 */
export function actorScope(actor: ActorContext): TenantScope {
  if (actor.branchId) {
    return { companyId: actor.companyId, branchId: actor.branchId };
  }
  return { companyId: actor.companyId };
}
