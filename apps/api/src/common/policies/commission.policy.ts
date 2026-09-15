import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

@Injectable()
export class CommissionPolicy {
  canRead(actor: ActorContext, commission?: any): boolean {
    if (!actor?.userId) return false;
    if (actor.role === RoleType.ADMIN) return true;

    if (actor.role === RoleType.BACK_OFFICE) {
      if (commission) {
        const commCompanyId =
          commission.companyId ||
          commission.user?.companyId ||
          commission.policy?.companyId;
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
    return actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE;
  }

  canConfigure(actor: ActorContext): boolean {
    // Strictly Admin only
    return actor?.role === RoleType.ADMIN;
  }

  canExport(actor: ActorContext): boolean {
    return actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE;
  }
}
