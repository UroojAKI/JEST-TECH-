import { Injectable, ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

@Injectable()
export class LeadPolicy {
  canRead(actor: ActorContext, lead: any): boolean {
    if (!actor?.userId) return false;
    if (actor.role === RoleType.ADMIN) return true;

    // Tenant boundary: Back Office is strictly bounded by companyId
    if (actor.role === RoleType.BACK_OFFICE) {
      const leadCompanyId = lead.companyId || lead.createdBy?.companyId || lead.assignedTo?.companyId;
      if (leadCompanyId && leadCompanyId !== actor.companyId) {
        return false;
      }
      return true;
    }

    // Agent: OWN or ASSIGNED scope only
    if (actor.role === RoleType.AGENT) {
      return (
        lead.createdById === actor.userId ||
        lead.assignedToId === actor.userId ||
        lead.agentId === actor.userId
      );
    }

    return false;
  }

  canCreate(actor: ActorContext): boolean {
    if (!actor?.userId) return false;
    return [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT].includes(actor.role);
  }

  canUpdate(actor: ActorContext, lead: any): boolean {
    if (!actor?.userId) return false;
    if (actor.role === RoleType.ADMIN) return true;

    if (actor.role === RoleType.BACK_OFFICE) {
      const leadCompanyId = lead.companyId || lead.createdBy?.companyId || lead.assignedTo?.companyId;
      if (leadCompanyId && leadCompanyId !== actor.companyId) {
        return false;
      }
      return true;
    }

    if (actor.role === RoleType.AGENT) {
      return (
        lead.createdById === actor.userId ||
        lead.assignedToId === actor.userId ||
        lead.agentId === actor.userId
      );
    }

    return false;
  }

  canDelete(actor: ActorContext): boolean {
    // Strictly ADMIN only. Back Office and Agent are denied lead:delete
    return actor?.role === RoleType.ADMIN;
  }

  canAssign(actor: ActorContext, lead?: any): boolean {
    // ADMIN and BACK_OFFICE can assign; AGENT cannot
    if (actor.role === RoleType.ADMIN) return true;
    if (actor.role === RoleType.BACK_OFFICE) {
      if (lead) {
        const leadCompanyId = lead.companyId || lead.createdBy?.companyId || lead.assignedTo?.companyId;
        if (leadCompanyId && leadCompanyId !== actor.companyId) {
          return false;
        }
      }
      return true;
    }
    return false;
  }

  canMerge(actor: ActorContext): boolean {
    // ADMIN and BACK_OFFICE can merge; AGENT cannot
    return actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE;
  }

  canExport(actor: ActorContext): boolean {
    // ADMIN and BACK_OFFICE can export; AGENT cannot
    return actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE;
  }
}
