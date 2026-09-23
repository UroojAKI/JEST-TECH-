import { Injectable, ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

/**
 * LeadPolicy — authorization rules for Lead resources.
 *
 * ADMIN semantic: ADMIN is company-scoped, NOT global.
 *   if (actor.role === ADMIN) → only allowed if lead.companyId === actor.companyId
 */
@Injectable()
export class LeadPolicy {
  canRead(actor: ActorContext, lead: any): boolean {
    if (!actor?.userId) return false;

    const leadCompanyId =
      lead.companyId ||
      lead.createdBy?.companyId ||
      lead.assignedTo?.companyId;

    // ADMIN: company-scoped, not global
    if (actor.role === RoleType.ADMIN) {
      return leadCompanyId === actor.companyId;
    }

    // Tenant boundary: Back Office is strictly bounded by companyId
    if (actor.role === RoleType.BACK_OFFICE) {
      if (leadCompanyId && leadCompanyId !== actor.companyId) {
        return false;
      }
      return true;
    }

    // Agent: OWN or ASSIGNED scope only — same company implied
    if (actor.role === RoleType.AGENT) {
      if (leadCompanyId && leadCompanyId !== actor.companyId) {
        return false;
      }
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
    return [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT].includes(
      actor.role,
    );
  }

  canUpdate(actor: ActorContext, lead: any): boolean {
    if (!actor?.userId) return false;

    const leadCompanyId =
      lead.companyId ||
      lead.createdBy?.companyId ||
      lead.assignedTo?.companyId;

    // ADMIN: company-scoped, not global
    if (actor.role === RoleType.ADMIN) {
      return leadCompanyId === actor.companyId;
    }

    if (actor.role === RoleType.BACK_OFFICE) {
      if (leadCompanyId && leadCompanyId !== actor.companyId) {
        return false;
      }
      return true;
    }

    if (actor.role === RoleType.AGENT) {
      if (leadCompanyId && leadCompanyId !== actor.companyId) {
        return false;
      }
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
    // ADMIN is company-scoped — query must enforce companyId externally
    return actor?.role === RoleType.ADMIN;
  }

  canAssign(actor: ActorContext, lead?: any): boolean {
    // ADMIN and BACK_OFFICE can assign; AGENT cannot

    if (actor.role === RoleType.ADMIN) {
      if (lead) {
        const leadCompanyId =
          lead.companyId ||
          lead.createdBy?.companyId ||
          lead.assignedTo?.companyId;
        return leadCompanyId === actor.companyId;
      }
      return true; // listing — query must enforce companyId
    }

    if (actor.role === RoleType.BACK_OFFICE) {
      if (lead) {
        const leadCompanyId =
          lead.companyId ||
          lead.createdBy?.companyId ||
          lead.assignedTo?.companyId;
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
    return (
      actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE
    );
  }

  canExport(actor: ActorContext): boolean {
    // ADMIN and BACK_OFFICE can export; AGENT cannot
    return (
      actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE
    );
  }
}
