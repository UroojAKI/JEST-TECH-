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
];

const BRANCH_ROLES: RoleType[] = [
  RoleType.BRANCH_MANAGER,
  RoleType.MARKETING_DIRECTOR,
];

const TEAM_ROLES: RoleType[] = [
  RoleType.TEAM_LEADER,
  RoleType.SALES_MANAGER,
];

@Injectable()
export class ScopeResolver {
  resolveScopeFilter(actor: ActorContext, resourceType: ResourceType): Record<string, any> {
    if (!actor || !actor.userId) {
      return { id: 'UNAUTHORIZED_ACCESS_BLOCKED' };
    }

    const actorRoles: RoleType[] = actor.roles || [actor.role];
    const base: Record<string, any> = actor.organizationId ? { organizationId: actor.organizationId } : {};

    if (actorRoles.some((r) => ADMIN_ROLES.includes(r))) {
      return base;
    }

    if (actorRoles.some((r) => OPERATIONAL_ROLES.includes(r))) {
      return base;
    }

    if (actorRoles.some((r) => BRANCH_ROLES.includes(r)) && actor.branchId) {
      return {
        ...base,
        OR: [
          { branchId: actor.branchId },
          { createdBy: { branchId: actor.branchId } },
          { assignedTo: { branchId: actor.branchId } },
          { createdById: actor.userId },
        ],
      };
    }

    if (actorRoles.some((r) => TEAM_ROLES.includes(r)) && actor.teamId) {
      return {
        ...base,
        OR: [
          { teamId: actor.teamId },
          { createdBy: { teamId: actor.teamId } },
          { assignedTo: { teamId: actor.teamId } },
          { createdById: actor.userId },
        ],
      };
    }

    switch (resourceType) {
      case 'LEAD':
        return {
          ...base,
          OR: [
            { assignedToId: actor.userId },
            { createdById: actor.userId },
          ],
        };
      case 'QUOTATION':
        return {
          ...base,
          OR: [
            { createdById: actor.userId },
            { lead: { assignedToId: actor.userId } },
          ],
        };
      case 'POLICY':
        return {
          ...base,
          OR: [
            { createdById: actor.userId },
            { quotation: { createdById: actor.userId } },
          ],
        };
      case 'CLAIM':
        return {
          ...base,
          OR: [
            { createdById: actor.userId },
            { policy: { createdById: actor.userId } },
          ],
        };
      case 'RENEWAL_TASK':
        return {
          ...base,
          OR: [
            { agentId: actor.userId },
            { policy: { createdById: actor.userId } },
          ],
        };
      default:
        return {
          ...base,
          createdById: actor.userId,
        };
    }
  }
}
