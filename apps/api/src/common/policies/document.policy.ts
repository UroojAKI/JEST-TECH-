import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

@Injectable()
export class DocumentPolicy {
  canRead(actor: ActorContext, document: any): boolean {
    if (!actor?.userId) return false;
    if (actor.role === RoleType.ADMIN) return true;

    if (actor.role === RoleType.BACK_OFFICE) {
      const docCompanyId =
        document.companyId ||
        document.uploadedBy?.companyId ||
        document.policy?.companyId ||
        document.claim?.companyId;
      if (docCompanyId && docCompanyId !== actor.companyId) {
        return false;
      }
      return true;
    }

    if (actor.role === RoleType.AGENT) {
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
