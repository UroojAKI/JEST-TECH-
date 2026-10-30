import { Injectable, ForbiddenException } from '@nestjs/common';
import { ActorContext } from '../interfaces/actor-context.interface';

/**
 * Universal Platform Privilege Resolver.
 *
 * Enforces the authoritative separation of roles and boundaries:
 * 1. Platform Super-Admin: Universal platform authority across all tenant companies.
 *    Only verified platform administrators can view all companies' hierarchies
 *    or modify system-wide global role permissions.
 * 2. Tenant Admin (RoleType.ADMIN): Administrator scoped strictly to their own company.
 *    Tenant Admins CANNOT view other companies' data or modify global role permissions.
 * 3. Back Office (RoleType.BACK_OFFICE): Operations staff scoped to company workflows.
 * 4. Agent (RoleType.AGENT): Field/sales personnel scoped to own/assigned customer portfolio.
 *
 * Security Invariants:
 * - RoleType.ADMIN alone NEVER grants platform super-admin privileges.
 * - Client-supplied flags or payload fields (e.g. { isSuperAdmin: true }) are NEVER trusted.
 * - Privilege is derived exclusively from server-verified ActorContext state.
 */
@Injectable()
export class PlatformPrivilegeResolver {
  /**
   * Evaluates whether the actor possesses verified, server-controlled platform super-administrator privileges.
   */
  static isPlatformAdmin(actor?: ActorContext | null): boolean {
    if (!actor) return false;

    // 1. Explicit server-verified flag on ActorContext
    if (actor.isPlatformAdmin === true) return true;

    // 2. Explicit server-verified role code indicating platform super-admin
    const rawRole = (actor.role as string)?.toUpperCase();
    if (rawRole === 'PLATFORM_SUPER_ADMIN' || rawRole === 'SUPER_ADMIN') {
      return true;
    }

    const rawRoles =
      (actor.roles as string[])?.map((r) => (typeof r === 'string' ? r.toUpperCase() : '')) || [];
    if (rawRoles.includes('PLATFORM_SUPER_ADMIN') || rawRoles.includes('SUPER_ADMIN')) {
      return true;
    }

    // 3. Explicit server-verified permissions (wildcard '*' or explicit platform permission)
    if (Array.isArray(actor.permissions)) {
      if (
        actor.permissions.includes('*') ||
        actor.permissions.includes('PLATFORM_SUPER_ADMIN') ||
        actor.permissions.includes('platform:super-admin') ||
        actor.permissions.includes('system:platform-admin')
      ) {
        return true;
      }
    }

    return false;
  }

  /**
   * Asserts that the actor is an authorized platform super-administrator.
   * Throws ForbiddenException if the actor is only a tenant admin or lower privilege.
   */
  static assertPlatformAdmin(actor?: ActorContext | null): void {
    if (!this.isPlatformAdmin(actor)) {
      throw new ForbiddenException(
        'Only platform super-administrators may perform this platform-wide operation. Tenant administrators are restricted from modifying global configurations.',
      );
    }
  }

  /**
   * Resolves the company scoping boundary for an actor:
   * - Platform Super Admin: Universal scope (returns null or requestedCompanyId).
   * - Tenant Admin / Back Office: Strictly constrained to actor.companyId.
   */
  static resolveEffectiveCompanyId(
    actor: ActorContext,
    requestedCompanyId?: string,
  ): string | null {
    if (this.isPlatformAdmin(actor)) {
      return requestedCompanyId || null;
    }

    const actorCompanyId = actor.companyId || actor.organizationId;
    if (!actorCompanyId) {
      throw new ForbiddenException('Actor organizational context is required');
    }

    if (requestedCompanyId && requestedCompanyId !== actorCompanyId) {
      throw new ForbiddenException(
        'Tenant administrators cannot access data across organizational boundaries.',
      );
    }

    return actorCompanyId;
  }
}
