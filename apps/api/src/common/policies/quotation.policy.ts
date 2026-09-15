import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

@Injectable()
export class QuotationPolicy {
  canRead(actor: ActorContext, quote: any): boolean {
    if (!actor?.userId) return false;
    if (actor.role === RoleType.ADMIN) return true;

    if (actor.role === RoleType.BACK_OFFICE) {
      const quoteCompanyId = quote.companyId || quote.createdBy?.companyId || quote.lead?.companyId;
      if (quoteCompanyId && quoteCompanyId !== actor.companyId) {
        return false;
      }
      return true;
    }

    if (actor.role === RoleType.AGENT) {
      return (
        quote.createdById === actor.userId ||
        quote.lead?.assignedToId === actor.userId ||
        quote.lead?.createdById === actor.userId
      );
    }

    return false;
  }

  canCreate(actor: ActorContext): boolean {
    if (!actor?.userId) return false;
    return [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT].includes(actor.role);
  }

  canUpdate(actor: ActorContext, quote: any): boolean {
    return this.canRead(actor, quote);
  }

  canApprove(actor: ActorContext): boolean {
    // Segregation of Duties: Agents can NEVER approve quotations
    return actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE;
  }

  canReject(actor: ActorContext): boolean {
    return actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE;
  }

  canExport(actor: ActorContext): boolean {
    return actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE;
  }
}
