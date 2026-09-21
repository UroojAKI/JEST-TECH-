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
          { lead: { assignedTo: userFilter } },
        ],
      };
    case 'POLICY':
      return {
        OR: [{ companyId }, { createdBy: userFilter }],
      };
    case 'CLAIM':
      return {
        OR: [
          { companyId },
          { createdBy: userFilter },
          { policy: { createdBy: userFilter } },
        ],
      };
    case 'CUSTOMER':
    case 'CUSTOMER_360':
    case 'CONTACT':
    case 'ACCOUNT':
      return { companyId };
    case 'RENEWAL_TASK':
      return {
        OR: [
          { policy: { companyId } },
          { agent: userFilter },
          { policy: { createdBy: userFilter } },
        ],
      };
    case 'DOCUMENT':
    case 'REPORT':
    default:
      return {
        OR: [{ companyId }, { createdBy: userFilter }],
      };
  }
};

const agentScope = (
  actor: ActorContext,
  resourceType: ResourceType,
): Record<string, any> => {
  const agentId = actor.agentId;

  switch (resourceType) {
    case 'LEAD':
      return {
        OR: [
          ...(agentId ? [{ agentId }] : []),
          { assignedToId: actor.userId },
          { createdById: actor.userId },
        ],
      };
    case 'QUOTATION':
      return {
        OR: [
          ...(agentId ? [{ agentId }, { lead: { agentId } }] : []),
          { createdById: actor.userId },
          { lead: { assignedToId: actor.userId } },
        ],
      };
    case 'POLICY':
      return {
        OR: [
          ...(agentId ? [{ agentId }, { quotation: { agentId } }] : []),
          { createdById: actor.userId },
          { quotation: { createdById: actor.userId } },
        ],
      };
    case 'CLAIM':
      return {
        OR: [
          ...(agentId ? [{ agentId }, { policy: { agentId } }] : []),
          { createdById: actor.userId },
          { policy: { createdById: actor.userId } },
        ],
      };
    case 'CUSTOMER':
    case 'CUSTOMER_360':
      return {
        OR: [
          ...(agentId ? [{ primaryAgentId: agentId }] : []),
          { createdById: actor.userId },
        ],
      };
    case 'RENEWAL_TASK':
      return {
        OR: [
          { agentId: actor.userId },
          ...(agentId ? [{ policy: { agentId } }] : []),
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
    if (!actor?.userId || (!actor.organizationId && !actor.companyId)) {
      return { id: '__UNAUTHORIZED_ACCESS_BLOCKED__' };
    }

    const roles = actor.roles?.length ? actor.roles : [actor.role];

    // Platform Super-Admin: Universal access across all tenants
    if (actor.permissions?.includes('*')) {
      return {};
    }

    // ADMIN and BACK_OFFICE: Scoped to company / organization
    if (
      roles.includes(RoleType.ADMIN) ||
      roles.includes(RoleType.BACK_OFFICE)
    ) {
      return orgScope(actor, resourceType);
    }

    // AGENT: Scoped to OWN / ASSIGNED resources
    return agentScope(actor, resourceType);
  }
}
