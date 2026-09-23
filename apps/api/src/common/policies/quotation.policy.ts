import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

/**
 * QuotationPolicy — authorization rules for Quotation resources.
 *
 * ADMIN semantic: ADMIN is company-scoped, NOT global.
 *   if (actor.role === ADMIN) → only allowed if quote.companyId === actor.companyId
 */
@Injectable()
export class QuotationPolicy {
  canRead(actor: ActorContext, quote: any): boolean {
    if (!actor?.userId) return false;

    const quoteCompanyId =
      quote.companyId || quote.createdBy?.companyId || quote.lead?.companyId;

    // ADMIN: company-scoped, not global
    if (actor.role === RoleType.ADMIN) {
      return quoteCompanyId === actor.companyId;
    }

    if (actor.role === RoleType.BACK_OFFICE) {
      if (quoteCompanyId && quoteCompanyId !== actor.companyId) {
        return false;
      }
      return true;
    }

    if (actor.role === RoleType.AGENT) {
      if (quoteCompanyId && quoteCompanyId !== actor.companyId) {
        return false;
      }
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
    return [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT].includes(
      actor.role,
    );
  }

  canUpdate(actor: ActorContext, quote: any): boolean {
    return this.canRead(actor, quote);
  }

  canApprove(actor: ActorContext): boolean {
    // Segregation of Duties: Agents can NEVER approve quotations
    return (
      actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE
    );
  }

  canReject(actor: ActorContext): boolean {
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
