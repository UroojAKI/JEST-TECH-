import { Injectable, ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

@Injectable()
export class UsersPolicy {
  canRead(actor: ActorContext, targetUser?: any): boolean {
    if (!actor?.userId) return false;
    if (actor.role === RoleType.ADMIN) return true;

    // Back Office can view users within their organization
    if (actor.role === RoleType.BACK_OFFICE) {
      if (!targetUser) return true;
      const targetCompanyId = targetUser.companyId || targetUser.branch?.zone?.region?.company?.id;
      return targetCompanyId === actor.companyId;
    }

    return false;
  }

  canCreate(actor: ActorContext): boolean {
    if (!actor?.userId) return false;
    // Strictly Admin only
    return actor.role === RoleType.ADMIN;
  }

  canUpdate(actor: ActorContext, targetUser?: any): boolean {
    if (!actor?.userId) return false;
    // Strictly Admin only
    return actor.role === RoleType.ADMIN;
  }

  canDelete(actor: ActorContext): boolean {
    if (!actor?.userId) return false;
    // Strictly Admin only
    return actor.role === RoleType.ADMIN;
  }

  canDeactivate(actor: ActorContext): boolean {
    if (!actor?.userId) return false;
    // Strictly Admin only
    return actor.role === RoleType.ADMIN;
  }

  assertCanRead(actor: ActorContext, targetUser?: any): void {
    if (!this.canRead(actor, targetUser)) {
      throw new ForbiddenException('Access denied: user read unauthorized');
    }
  }

  assertCanCreate(actor: ActorContext): void {
    if (!this.canCreate(actor)) {
      throw new ForbiddenException('Access denied: only Administrators can create users');
    }
  }

  assertCanUpdate(actor: ActorContext, targetUser?: any): void {
    if (!this.canUpdate(actor, targetUser)) {
      throw new ForbiddenException('Access denied: only Administrators can update users');
    }
  }

  assertCanDeactivate(actor: ActorContext): void {
    if (!this.canDeactivate(actor)) {
      throw new ForbiddenException('Access denied: only Administrators can deactivate users');
    }
  }
}
