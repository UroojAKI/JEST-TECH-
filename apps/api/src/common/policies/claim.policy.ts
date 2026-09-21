import { Injectable, ForbiddenException } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

@Injectable()
export class ClaimPolicy {
  canRead(actor: ActorContext, claim: any): boolean {
    if (!actor?.userId) return false;
    if (actor.role === RoleType.ADMIN) return true;

    if (actor.role === RoleType.BACK_OFFICE) {
      const claimCompanyId =
        claim.companyId ||
        claim.createdBy?.companyId ||
        claim.policy?.companyId;
      if (claimCompanyId && claimCompanyId !== actor.companyId) {
        return false;
      }
      return true;
    }

    if (actor.role === RoleType.AGENT) {
      return (
        claim.createdById === actor.userId ||
        claim.policy?.createdById === actor.userId ||
        claim.policy?.agentId === actor.userId
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

  canUpdate(actor: ActorContext, claim: any): boolean {
    return this.canRead(actor, claim);
  }

  canApprove(actor: ActorContext, claim?: any): boolean {
    // Agents CANNOT approve claims
    if (actor.role === RoleType.AGENT) return false;

    // Segregation of Duties: Creator cannot approve own claim
    if (claim && claim.createdById === actor.userId) {
      throw new ForbiddenException(
        'Segregation of duties violation: Claim creator cannot self-approve claim',
      );
    }

    return actor.role === RoleType.ADMIN || actor.role === RoleType.BACK_OFFICE;
  }

  canReject(actor: ActorContext): boolean {
    return actor.role === RoleType.ADMIN || actor.role === RoleType.BACK_OFFICE;
  }

  canSettle(actor: ActorContext, claim?: any): boolean {
    if (actor.role === RoleType.AGENT) return false;

    if (claim && claim.createdById === actor.userId) {
      throw new ForbiddenException(
        'Segregation of duties violation: Claim creator cannot self-settle claim',
      );
    }

    return actor.role === RoleType.ADMIN || actor.role === RoleType.BACK_OFFICE;
  }

  canExport(actor: ActorContext): boolean {
    return actor.role === RoleType.ADMIN || actor.role === RoleType.BACK_OFFICE;
  }
}
