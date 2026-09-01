import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';
import { ResourceType } from './resource-authorization.service';

const ADMIN_ROLES: RoleType[] = [
  RoleType.SUPER_ADMIN,
  RoleType.ADMIN,
  RoleType.MD_CEO,
  RoleType.SYSTEM_ADMINISTRATOR,
];

const OPERATIONAL_ROLES: RoleType[] = [
  RoleType.OPERATIONS,
  RoleType.POLICY_ISSUANCE_EXECUTIVE,
  RoleType.UNDERWRITER,
  RoleType.FINANCE,
  RoleType.FINANCE_ACCOUNTS_EXECUTIVE,
  RoleType.CHIEF_FINANCE_OFFICER,
  RoleType.CLAIMS_OFFICER,
  RoleType.RENEWAL_EXECUTIVE,
  RoleType.CUSTOMER_SERVICE_EXECUTIVE,
];

const BRANCH_ROLES: RoleType[] = [RoleType.BRANCH_MANAGER, RoleType.MARKETING_DIRECTOR];
const TEAM_ROLES: RoleType[] = [RoleType.TEAM_LEADER, RoleType.SALES_MANAGER];

/**
 * Models without a direct organizationId are scoped through the owning user.
 * The owner -> branch -> zone -> region -> company hierarchy is the canonical
 * organizational path in the current schema.
 */
const organizationOwnerFilter = (organizationId: string) => ({
  createdBy: {
    branch: {
      zone: {
        region: {
          company: { id: organizationId },
        },
      },
    },
  },
});

@Injectable()
export class ScopeResolver {
  resolveScopeFilter(actor: ActorContext, resourceType: ResourceType): Record<string, any> {
    if (!actor?.userId || !actor.organizationId) {
      return { id: '__UNAUTHORIZED_ACCESS_BLOCKED__' };
    }

    const roles = actor.roles?.length ? actor.roles : [actor.role];

    // Admin visibility remains organization-wide in the current single-org product model.
    if (roles.some((r) => ADMIN_ROLES.includes(r))) return {};

    // Operational teams need organization-wide operational visibility, but never
    // cross-organization visibility. Use the canonical owner hierarchy rather than {}.
    if (roles.some((r) => OPERATIONAL_ROLES.includes(r))) {
      const orgFilter = organizationOwnerFilter(actor.organizationId);
      switch (resourceType) {
        case 'LEAD':
        case 'QUOTATION':
        case 'POLICY':
        case 'CLAIM':
        case 'RENEWAL_TASK':
        case 'ACCOUNT':
        case 'CONTACT':
          return orgFilter;
        default:
          return orgFilter;
      }
    }

    if (roles.some((r) => BRANCH_ROLES.includes(r))) {
      if (!actor.branchId) return { id: '__BRANCH_CONTEXT_REQUIRED__' };
      return {
        OR: [
          { createdBy: { branchId: actor.branchId } },
          { assignedTo: { branchId: actor.branchId } },
          { createdById: actor.userId },
        ],
      };
    }

    if (roles.some((r) => TEAM_ROLES.includes(r))) {
      if (!actor.teamId) return { id: '__TEAM_CONTEXT_REQUIRED__' };
      return {
        OR: [
          { createdBy: { teamId: actor.teamId } },
          { assignedTo: { teamId: actor.teamId } },
          { createdById: actor.userId },
        ],
      };
    }

    switch (resourceType) {
      case 'LEAD':
        return { OR: [{ assignedToId: actor.userId }, { createdById: actor.userId }] };
      case 'QUOTATION':
        return { OR: [{ createdById: actor.userId }, { lead: { assignedToId: actor.userId } }] };
      case 'POLICY':
        return { OR: [{ createdById: actor.userId }, { quotation: { createdById: actor.userId } }] };
      case 'CLAIM':
        return { OR: [{ createdById: actor.userId }, { policy: { createdById: actor.userId } }] };
      case 'RENEWAL_TASK':
        return { OR: [{ agentId: actor.userId }, { policy: { createdById: actor.userId } }] };
      default:
        return { createdById: actor.userId };
    }
  }
}
