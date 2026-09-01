import { Injectable } from '@nestjs/common';
import { RoleType } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';
import { ResourceType } from './resource-authorization.service';

// Only Super Admin is system-global. Admin/System Administrator/MD-CEO are
// organization-scoped and must never receive an empty query filter.
const GLOBAL_ROLES: RoleType[] = [RoleType.SUPER_ADMIN];
const ORGANIZATION_ADMIN_ROLES: RoleType[] = [RoleType.ADMIN, RoleType.MD_CEO, RoleType.SYSTEM_ADMINISTRATOR];
const OPERATIONAL_ROLES: RoleType[] = [RoleType.OPERATIONS, RoleType.POLICY_ISSUANCE_EXECUTIVE, RoleType.UNDERWRITER, RoleType.FINANCE, RoleType.FINANCE_ACCOUNTS_EXECUTIVE, RoleType.CHIEF_FINANCE_OFFICER, RoleType.CLAIMS_OFFICER, RoleType.RENEWAL_EXECUTIVE, RoleType.CUSTOMER_SERVICE_EXECUTIVE];
const BRANCH_ROLES: RoleType[] = [RoleType.BRANCH_MANAGER, RoleType.MARKETING_DIRECTOR];
const TEAM_ROLES: RoleType[] = [RoleType.TEAM_LEADER, RoleType.SALES_MANAGER];

const ownerInOrganization = (organizationId: string) => ({ branch: { zone: { region: { company: { id: organizationId } } } } });
const orgScope = (actor: ActorContext, resourceType: ResourceType): Record<string, any> => {
  switch (resourceType) {
    case 'LEAD': return { OR: [{ createdBy: ownerInOrganization(actor.organizationId) }, { assignedTo: ownerInOrganization(actor.organizationId) }] };
    case 'QUOTATION': case 'ACCOUNT': case 'CONTACT': case 'DOCUMENT': case 'REPORT': return { createdBy: ownerInOrganization(actor.organizationId) };
    case 'POLICY': return { OR: [{ createdBy: ownerInOrganization(actor.organizationId) }, { quotation: { createdBy: ownerInOrganization(actor.organizationId) } }] };
    case 'CLAIM': return { OR: [{ createdBy: ownerInOrganization(actor.organizationId) }, { policy: { createdBy: ownerInOrganization(actor.organizationId) } }] };
    case 'RENEWAL_TASK': return { OR: [{ agent: ownerInOrganization(actor.organizationId) }, { policy: { createdBy: ownerInOrganization(actor.organizationId) } }] };
    default: return { id: '__ORGANIZATION_SCOPE_NOT_IMPLEMENTED__' };
  }
};

@Injectable()
export class ScopeResolver {
  resolveScopeFilter(actor: ActorContext, resourceType: ResourceType): Record<string, any> {
    if (!actor?.userId || !actor.organizationId) return { id: '__UNAUTHORIZED_ACCESS_BLOCKED__' };
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (roles.some((r) => GLOBAL_ROLES.includes(r))) return {};
    if (roles.some((r) => ORGANIZATION_ADMIN_ROLES.includes(r))) return orgScope(actor, resourceType);
    if (roles.some((r) => OPERATIONAL_ROLES.includes(r))) return orgScope(actor, resourceType);

    if (roles.some((r) => BRANCH_ROLES.includes(r))) {
      if (!actor.branchId) return { id: '__BRANCH_CONTEXT_REQUIRED__' };
      switch (resourceType) {
        case 'LEAD': return { OR: [{ createdBy: { branchId: actor.branchId } }, { assignedTo: { branchId: actor.branchId } }, { createdById: actor.userId }] };
        case 'QUOTATION': case 'ACCOUNT': case 'CONTACT': case 'DOCUMENT': case 'REPORT': return { createdBy: { branchId: actor.branchId } };
        case 'POLICY': return { OR: [{ createdBy: { branchId: actor.branchId } }, { quotation: { createdBy: { branchId: actor.branchId } } }] };
        case 'CLAIM': return { OR: [{ createdBy: { branchId: actor.branchId } }, { policy: { createdBy: { branchId: actor.branchId } } }] };
        case 'RENEWAL_TASK': return { OR: [{ agent: { branchId: actor.branchId } }, { policy: { createdBy: { branchId: actor.branchId } } }] };
        default: return { id: '__BRANCH_SCOPE_NOT_IMPLEMENTED__' };
      }
    }

    if (roles.some((r) => TEAM_ROLES.includes(r))) {
      if (!actor.teamId) return { id: '__TEAM_CONTEXT_REQUIRED__' };
      switch (resourceType) {
        case 'LEAD': return { OR: [{ createdBy: { teamId: actor.teamId } }, { assignedTo: { teamId: actor.teamId } }, { createdById: actor.userId }] };
        case 'QUOTATION': case 'ACCOUNT': case 'CONTACT': case 'DOCUMENT': case 'REPORT': return { createdBy: { teamId: actor.teamId } };
        case 'POLICY': return { OR: [{ createdBy: { teamId: actor.teamId } }, { quotation: { createdBy: { teamId: actor.teamId } } }] };
        case 'CLAIM': return { OR: [{ createdBy: { teamId: actor.teamId } }, { policy: { createdBy: { teamId: actor.teamId } } }] };
        case 'RENEWAL_TASK': return { OR: [{ agent: { teamId: actor.teamId } }, { policy: { createdBy: { teamId: actor.teamId } } }] };
        default: return { id: '__TEAM_SCOPE_NOT_IMPLEMENTED__' };
      }
    }

    switch (resourceType) {
      case 'LEAD': return { OR: [{ assignedToId: actor.userId }, { createdById: actor.userId }] };
      case 'QUOTATION': return { OR: [{ createdById: actor.userId }, { lead: { assignedToId: actor.userId } }] };
      case 'POLICY': return { OR: [{ createdById: actor.userId }, { quotation: { createdById: actor.userId } }] };
      case 'CLAIM': return { OR: [{ createdById: actor.userId }, { policy: { createdById: actor.userId } }] };
      case 'RENEWAL_TASK': return { OR: [{ agentId: actor.userId }, { policy: { createdById: actor.userId } }] };
      case 'ACCOUNT': case 'CONTACT': case 'DOCUMENT': case 'REPORT': return { createdById: actor.userId };
      default: return { id: '__OWNERSHIP_SCOPE_NOT_IMPLEMENTED__' };
    }
  }
}