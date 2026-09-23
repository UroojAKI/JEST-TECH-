import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

/**
 * ContactPolicy — authorization rules for Contact resources.
 *
 * ADMIN semantic: ADMIN is company-scoped, NOT global.
 *   if (actor.role === ADMIN) → only allowed if contact.companyId === actor.companyId
 */
@Injectable()
export class ContactPolicy {
  canRead(actor: ActorContext, contact: any): boolean {
    if (!actor?.userId) return false;

    const contactCompanyId =
      contact.companyId || contact.createdBy?.companyId;

    // ADMIN: company-scoped, not global
    if (actor.role === RoleType.ADMIN) {
      return contactCompanyId === actor.companyId;
    }

    if (actor.role === RoleType.BACK_OFFICE) {
      if (contactCompanyId && contactCompanyId !== actor.companyId) {
        return false;
      }
      return true;
    }

    if (actor.role === RoleType.AGENT) {
      // Agent: must be same company AND own/assigned contact
      if (contactCompanyId && contactCompanyId !== actor.companyId) {
        return false;
      }
      return (
        contact.createdById === actor.userId ||
        contact.agentId === actor.userId ||
        contact.assignedToId === actor.userId
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

  canUpdate(actor: ActorContext, contact: any): boolean {
    return this.canRead(actor, contact);
  }

  canDelete(actor: ActorContext): boolean {
    // Admin only or Back Office with appropriate permission
    return (
      actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE
    );
  }

  canExport(actor: ActorContext): boolean {
    return (
      actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE
    );
  }
}
