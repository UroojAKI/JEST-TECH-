import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

/**
 * CommissionPolicy — authorization rules for Commission resources.
 *
 * ADMIN semantic: ADMIN is company-scoped, NOT global.
 *   if (actor.role === ADMIN) → only allowed if commission.companyId === actor.companyId
 */
@Injectable()
export class CommissionPolicy {
  canRead(actor: ActorContext, commission?: any): boolean {
    if (!actor?.userId) return false;

    const commCompanyId =
      commission?.companyId ||
      commission?.user?.companyId ||
      commission?.policy?.companyId;

    // ADMIN: company-scoped, not global
    if (actor.role === RoleType.ADMIN) {
      if (!commission) return true; // listing — query must be scoped externally
      return commCompanyId === actor.companyId;
    }

    if (actor.role === RoleType.BACK_OFFICE) {
      if (commission) {
        if (commCompanyId && commCompanyId !== actor.companyId) {
          return false;
        }
      }
      return true;
    }

    if (actor.role === RoleType.AGENT) {
      if (commission) {
        return (
          commission.userId === actor.userId ||
          commission.agentId === actor.userId
        );
      }
      return true;
    }

    return false;
  }

  canProcess(actor: ActorContext): boolean {
    return (
      actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE
    );
  }

  canConfigure(actor: ActorContext): boolean {
    // Strictly Admin only — but only within own company
    return actor?.role === RoleType.ADMIN;
  }

  canExport(actor: ActorContext): boolean {
    return (
      actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE
    );
  }
}
