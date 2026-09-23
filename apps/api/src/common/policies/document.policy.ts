import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

/**
 * DocumentPolicy — authorization rules for Document resources.
 *
 * ADMIN semantic: ADMIN is company-scoped, NOT global.
 *   if (actor.role === ADMIN) → only allowed if document.companyId === actor.companyId
 */
@Injectable()
export class DocumentPolicy {
  canRead(actor: ActorContext, document: any): boolean {
    if (!actor?.userId) return false;

    const docCompanyId =
      document.companyId ||
      document.uploadedBy?.companyId ||
      document.policy?.companyId ||
      document.claim?.companyId;

    // ADMIN: company-scoped, not global
    if (actor.role === RoleType.ADMIN) {
      return docCompanyId === actor.companyId;
    }

    if (actor.role === RoleType.BACK_OFFICE) {
      if (docCompanyId && docCompanyId !== actor.companyId) {
        return false;
      }
      return true;
    }

    if (actor.role === RoleType.AGENT) {
      if (docCompanyId && docCompanyId !== actor.companyId) {
        return false;
      }
      return (
        document.uploadedById === actor.userId ||
        document.createdById === actor.userId ||
        document.policy?.createdById === actor.userId ||
        document.policy?.agentId === actor.userId ||
        document.quotation?.createdById === actor.userId ||
        document.claim?.createdById === actor.userId
      );
    }

    return false;
  }

  canUpload(actor: ActorContext): boolean {
    if (!actor?.userId) return false;
    return [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT].includes(
      actor.role,
    );
  }

  canDelete(actor: ActorContext): boolean {
    // Admin or Back Office only. Agents cannot delete verification documents.
    return (
      actor?.role === RoleType.ADMIN || actor?.role === RoleType.BACK_OFFICE
    );
  }
}
