import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';
import { ResourceType } from './resource-authorization.service';

const userInCompany = (companyId: string) => ({
  OR: [
    { companyId },
    { branch: { zone: { region: { company: { id: companyId } } } } },
  ],
});

const orgScope = (
  actor: ActorContext,
  resourceType: ResourceType,
): Record<string, any> => {
  const companyId = actor.companyId || actor.organizationId;
  const userFilter = userInCompany(companyId);

  switch (resourceType) {
    case 'LEAD':
      return {
        OR: [
          { companyId },
          { createdBy: userFilter },
          { assignedTo: userFilter },
        ],
      };
    case 'QUOTATION':
      return {
        OR: [
          { companyId },
          { createdBy: userFilter },
          { lead: { createdBy: userFilter } },
        ],
      };
    case 'POLICY':
      return {
        OR: [
          { companyId },
          { createdBy: userFilter },
          { quotation: { createdBy: userFilter } },
        ],
      };
    case 'CLAIM':
      return {
        OR: [
          { companyId },
          { createdBy: userFilter },
          { policy: { createdBy: userFilter } },
        ],
      };
    case 'RENEWAL_TASK':
      return {
        OR: [
          { companyId },
          { agent: userFilter },
          { policy: { createdBy: userFilter } },
        ],
      };
    case 'ACCOUNT':
    case 'CONTACT':
    case 'DOCUMENT':
    case 'REPORT':
    default:
      return {
        OR: [
          { companyId },
          { createdBy: userFilter },
        ],
      };
  }
};

const agentScope = (
  actor: ActorContext,
  resourceType: ResourceType,
): Record<string, any> => {
  switch (resourceType) {
    case 'LEAD':
      return {
        OR: [
          { assignedToId: actor.userId },
          { createdById: actor.userId },
        ],
      };
    case 'QUOTATION':
      return {
        OR: [
          { createdById: actor.userId },
          { lead: { assignedToId: actor.userId } },
        ],
      };
    case 'POLICY':
      return {
        OR: [
          { createdById: actor.userId },
          { quotation: { createdById: actor.userId } },
        ],
      };
    case 'CLAIM':
      return {
        OR: [
          { createdById: actor.userId },
          { policy: { createdById: actor.userId } },
        ],
      };
    case 'RENEWAL_TASK':
      return {
        OR: [
          { agentId: actor.userId },
          { policy: { createdById: actor.userId } },
        ],
      };
    case 'ACCOUNT':
    case 'CONTACT':
    case 'DOCUMENT':
    case 'REPORT':
    default:
      return { createdById: actor.userId };
  }
};

@Injectable()
export class ScopeResolver {
  resolveScopeFilter(
    actor: ActorContext,
    resourceType: ResourceType,
  ): Record<string, any> {
    if (!actor?.userId || !actor.organizationId) {
      return { id: '__UNAUTHORIZED_ACCESS_BLOCKED__' };
    }

    const roles = actor.roles?.length ? actor.roles : [actor.role];

    // ADMIN: Universal access (ALL companies)
    if (roles.includes(RoleType.ADMIN)) {
      return {};
    }

    // BACK_OFFICE: Scoped to company / organization
    if (roles.includes(RoleType.BACK_OFFICE)) {
      return orgScope(actor, resourceType);
    }

    // AGENT: Scoped to OWN / ASSIGNED resources
    return agentScope(actor, resourceType);
  }
}
