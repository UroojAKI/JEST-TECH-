import { Injectable, ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

/**
 * UsersPolicy — authorization rules for User management operations.
 *
 * ADMIN semantic: ADMIN is company-scoped, NOT global.
 *   All ADMIN actions are restricted to actor.companyId — no cross-company user management.
 */
@Injectable()
export class UsersPolicy {
  canRead(actor: ActorContext, targetUser?: any): boolean {
    if (!actor?.userId) return false;

    // ADMIN: company-scoped, not global
    if (actor.role === RoleType.ADMIN) {
      if (!targetUser) return true; // listing — query must enforce companyId externally
      const targetCompanyId =
        targetUser.companyId || targetUser.branch?.zone?.region?.company?.id;
      return targetCompanyId === actor.companyId;
    }

    // Back Office can view users within their organization
    if (actor.role === RoleType.BACK_OFFICE) {
      if (!targetUser) return true;
      const targetCompanyId =
        targetUser.companyId || targetUser.branch?.zone?.region?.company?.id;
      return targetCompanyId === actor.companyId;
    }

    return false;
  }

  canCreate(actor: ActorContext): boolean {
    if (!actor?.userId) return false;
    // Strictly Admin only — within own company (query must enforce companyId)
    return actor.role === RoleType.ADMIN;
  }

  canUpdate(actor: ActorContext, targetUser?: any): boolean {
    if (!actor?.userId) return false;
    // Strictly Admin only
    if (actor.role !== RoleType.ADMIN) return false;
    if (!targetUser) return true; // query must enforce companyId
    const targetCompanyId =
      targetUser.companyId || targetUser.branch?.zone?.region?.company?.id;
    return targetCompanyId === actor.companyId;
  }

  canDelete(actor: ActorContext): boolean {
    if (!actor?.userId) return false;
    // Strictly Admin only — query must enforce companyId
    return actor.role === RoleType.ADMIN;
  }

  canDeactivate(actor: ActorContext): boolean {
    if (!actor?.userId) return false;
    // Strictly Admin only — query must enforce companyId
    return actor.role === RoleType.ADMIN;
  }

  assertCanRead(actor: ActorContext, targetUser?: any): void {
    if (!this.canRead(actor, targetUser)) {
      throw new ForbiddenException('Access denied: user read unauthorized');
    }
  }

  assertCanCreate(actor: ActorContext): void {
    if (!this.canCreate(actor)) {
      throw new ForbiddenException(
        'Access denied: only Administrators can create users',
      );
    }
  }

  assertCanUpdate(actor: ActorContext, targetUser?: any): void {
    if (!this.canUpdate(actor, targetUser)) {
      throw new ForbiddenException(
        'Access denied: only Administrators can update users',
      );
    }
  }

  assertCanDeactivate(actor: ActorContext): void {
    if (!this.canDeactivate(actor)) {
      throw new ForbiddenException(
        'Access denied: only Administrators can deactivate users',
      );
    }
  }
}
