import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

@Injectable()
export class ContactPolicy {
  canRead(actor: ActorContext, contact: any): boolean {
    if (!actor?.userId) return false;
    if (actor.role === RoleType.ADMIN) return true;

    if (actor.role === RoleType.BACK_OFFICE) {
      const contactCompanyId =
        contact.companyId || contact.createdBy?.companyId;
      if (contactCompanyId && contactCompanyId !== actor.companyId) {
        return false;
      }
      return true;
    }

    if (actor.role === RoleType.AGENT) {
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
