import { Injectable, ForbiddenException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

export type ResourceType = 'LEAD' | 'QUOTATION' | 'POLICY' | 'PAYMENT' | 'DOCUMENT' | 'RENEWAL_TASK' | 'CLAIM' | 'CONTACT' | 'ACCOUNT' | 'CUSTOMER_360' | 'REPORT';
export type ResourceAction = 'READ' | 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSITION' | 'ASSIGN' | 'ISSUE' | 'RECONCILE' | 'VERIFY' | 'APPROVE';
export type AccessScope = 'OWN' | 'ASSIGNED' | 'TEAM' | 'BRANCH' | 'ORGANIZATION' | 'GLOBAL';

const ADMIN_ROLES: RoleType[] = [RoleType.ADMIN, RoleType.SUPER_ADMIN, RoleType.MD_CEO, RoleType.SYSTEM_ADMINISTRATOR];
const BRANCH_ROLES: RoleType[] = [RoleType.BRANCH_MANAGER, RoleType.MARKETING_DIRECTOR];
const TEAM_ROLES: RoleType[] = [RoleType.TEAM_LEADER, RoleType.SALES_MANAGER];
const OPERATIONAL_ROLES: RoleType[] = [RoleType.OPERATIONS, RoleType.POLICY_ISSUANCE_EXECUTIVE, RoleType.UNDERWRITER, RoleType.FINANCE, RoleType.FINANCE_ACCOUNTS_EXECUTIVE, RoleType.CHIEF_FINANCE_OFFICER, RoleType.CLAIMS_OFFICER, RoleType.RENEWAL_EXECUTIVE, RoleType.CUSTOMER_SERVICE_EXECUTIVE];
const SALES_CREATORS: RoleType[] = [RoleType.SALES_AGENT, RoleType.SALES_EXECUTIVE, RoleType.SALES_MANAGER, RoleType.POSP_ADVISOR, RoleType.AGENT_MANAGER, RoleType.ADMIN, RoleType.SUPER_ADMIN];
const POLICY_ISSUERS: RoleType[] = [RoleType.OPERATIONS, RoleType.POLICY_ISSUANCE_EXECUTIVE, RoleType.UNDERWRITER, RoleType.ADMIN, RoleType.SUPER_ADMIN];
const FINANCE_ROLES: RoleType[] = [RoleType.FINANCE, RoleType.FINANCE_ACCOUNTS_EXECUTIVE, RoleType.CHIEF_FINANCE_OFFICER, RoleType.ADMIN, RoleType.SUPER_ADMIN];
const ASSIGNERS: RoleType[] = [RoleType.ADMIN, RoleType.SUPER_ADMIN, RoleType.MD_CEO, RoleType.SALES_MANAGER, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER];
const DOC_VERIFIERS: RoleType[] = [RoleType.OPERATIONS, RoleType.POLICY_ISSUANCE_EXECUTIVE, RoleType.UNDERWRITER, RoleType.ADMIN, RoleType.SUPER_ADMIN];
const QUOTE_APPROVERS: RoleType[] = [RoleType.SALES_MANAGER, RoleType.BRANCH_MANAGER, RoleType.TEAM_LEADER, RoleType.ADMIN, RoleType.SUPER_ADMIN];
const CLAIM_APPROVERS: RoleType[] = [RoleType.CLAIMS_OFFICER, RoleType.BRANCH_MANAGER, RoleType.ADMIN, RoleType.SUPER_ADMIN];

@Injectable()
export class ResourceAuthorizationService {
  authorize(actor: ActorContext, resourceType: ResourceType, action: ResourceAction, resource?: any): boolean {
    if (!actor?.userId || !actor.organizationId) throw new ForbiddenException('Actor organizational context is required');
    if (actor.status === UserStatus.SUSPENDED || actor.status === UserStatus.INACTIVE) throw new ForbiddenException(`User account is ${actor.status.toLowerCase()}`);
    if (resource) this.assertSameOrganization(actor, resource);

    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (roles.includes(RoleType.SUPER_ADMIN) || actor.permissions?.includes('*')) return true;

    switch (action) {
      case 'READ': return this.canRead(actor, resource, resourceType);
      case 'CREATE': return this.canCreate(actor, resourceType);
      case 'UPDATE': case 'TRANSITION': return this.canUpdate(actor, resource, resourceType);
      case 'DELETE': return this.canDelete(actor);
      case 'ASSIGN': return this.canAssign(actor, resource);
      case 'ISSUE': return this.canIssue(actor);
      case 'RECONCILE': return this.canReconcile(actor);
      case 'VERIFY': return this.canVerifyDocument(actor);
      case 'APPROVE': return this.canApprove(actor, resourceType);
      default: throw new ForbiddenException('Unsupported authorization action');
    }
  }

  private assertSameOrganization(actor: ActorContext, resource: any): void {
    const resourceOrg = resource.organizationId ?? resource.companyId;
    if (resourceOrg) {
      if (resourceOrg !== actor.organizationId) throw new ForbiddenException('Cross-organization access is strictly prohibited');
      return;
    }

    const relatedOrg =
      resource.createdBy?.organizationId ?? resource.createdBy?.companyId ??
      resource.createdBy?.branch?.zone?.region?.company?.id ??
      resource.assignedTo?.organizationId ?? resource.assignedTo?.companyId ??
      resource.assignedTo?.branch?.zone?.region?.company?.id ??
      resource.agent?.branch?.zone?.region?.company?.id;

    // An owner ID by itself is not proof of tenant membership. Fail closed unless
    // the resource carries an organization or an already-hydrated organizational owner.
    if (!relatedOrg) throw new ForbiddenException('Resource organizational context is unavailable');
    if (relatedOrg !== actor.organizationId) throw new ForbiddenException('Cross-organization access is strictly prohibited');
  }

  private resourceBranchId(resource: any): string | undefined {
    return resource.branchId ?? resource.createdBy?.branchId ?? resource.assignedTo?.branchId ?? resource.agent?.branchId ?? resource.lead?.createdBy?.branchId;
  }

  private resourceTeamId(resource: any): string | undefined {
    return resource.teamId ?? resource.createdBy?.teamId ?? resource.assignedTo?.teamId ?? resource.agent?.teamId ?? resource.lead?.createdBy?.teamId;
  }

  canRead(actor: ActorContext, resource: any, resourceType: ResourceType): boolean {
    if (!resource) throw new ForbiddenException('Resource is required for authorization');
    const roles = actor.roles?.length ? actor.roles : [actor.role];

    if (roles.some((r) => ADMIN_ROLES.includes(r))) return true;

    if (roles.some((r) => BRANCH_ROLES.includes(r))) {
      const branchId = this.resourceBranchId(resource);
      if (!actor.branchId || !branchId) throw new ForbiddenException('Branch context is required for branch-scoped access');
      if (actor.branchId !== branchId) throw new ForbiddenException('Resource belongs to another branch');
      return true;
    }

    if (roles.some((r) => TEAM_ROLES.includes(r))) {
      const teamId = this.resourceTeamId(resource);
      if (!actor.teamId || !teamId) throw new ForbiddenException('Team context is required for team-scoped access');
      if (actor.teamId !== teamId) throw new ForbiddenException('Resource belongs to another sales team');
      return true;
    }

    if (roles.some((r) => OPERATIONAL_ROLES.includes(r))) return true;

    const isOwner = resource.createdById === actor.userId || resource.assignedToId === actor.userId || resource.agentId === actor.userId || resource.userId === actor.userId || resource.lead?.assignedToId === actor.userId || resource.lead?.createdById === actor.userId || resource.quotation?.createdById === actor.userId || resource.policy?.createdById === actor.userId;
    if (isOwner) return true;
    throw new ForbiddenException(`You do not have permission to access this ${resourceType.toLowerCase()}`);
  }

  canCreate(actor: ActorContext, resourceType: ResourceType): boolean {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    switch (resourceType) {
      case 'QUOTATION': case 'LEAD': return roles.some((r) => SALES_CREATORS.includes(r));
      case 'POLICY': return roles.some((r) => POLICY_ISSUERS.includes(r));
      case 'PAYMENT': return roles.some((r) => [...FINANCE_ROLES, RoleType.SALES_AGENT, RoleType.SALES_EXECUTIVE].includes(r));
      case 'CLAIM': return roles.some((r) => [RoleType.CLAIMS_OFFICER, RoleType.SALES_AGENT, RoleType.SALES_EXECUTIVE, RoleType.CUSTOMER_SERVICE_EXECUTIVE, RoleType.ADMIN, RoleType.SUPER_ADMIN].includes(r));
      default: return roles.some((r) => r !== RoleType.CUSTOMER);
    }
  }

  canUpdate(actor: ActorContext, resource: any, resourceType: ResourceType): boolean { return this.canRead(actor, resource, resourceType); }

  canDelete(actor: ActorContext): boolean {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (!roles.some((r) => ADMIN_ROLES.includes(r))) throw new ForbiddenException('Only Administrators can delete records');
    return true;
  }

  canAssign(actor: ActorContext, resource: any): boolean {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (!roles.some((r) => ASSIGNERS.includes(r))) throw new ForbiddenException('Only Managers and Administrators can assign records');
    if (roles.includes(RoleType.TEAM_LEADER) && !roles.some((r) => ADMIN_ROLES.includes(r) || r === RoleType.BRANCH_MANAGER)) {
      if (!actor.teamId || this.resourceTeamId(resource) !== actor.teamId) throw new ForbiddenException('Team Leaders cannot assign records outside their team');
    }
    if (roles.includes(RoleType.BRANCH_MANAGER) && !roles.some((r) => ADMIN_ROLES.includes(r))) {
      if (!actor.branchId || this.resourceBranchId(resource) !== actor.branchId) throw new ForbiddenException('Branch Managers cannot assign records outside their branch');
    }
    return true;
  }

  canIssue(actor: ActorContext): boolean { const roles = actor.roles?.length ? actor.roles : [actor.role]; if (!roles.some((r) => POLICY_ISSUERS.includes(r))) throw new ForbiddenException('Only Back Office Operations and Policy Issuance Executives can issue policies'); return true; }
  canReconcile(actor: ActorContext): boolean { const roles = actor.roles?.length ? actor.roles : [actor.role]; if (!roles.some((r) => FINANCE_ROLES.includes(r))) throw new ForbiddenException('Only Finance & Accounts personnel can reconcile payments'); return true; }
  canVerifyDocument(actor: ActorContext): boolean { const roles = actor.roles?.length ? actor.roles : [actor.role]; if (!roles.some((r) => DOC_VERIFIERS.includes(r))) throw new ForbiddenException('Only Back Office Operations and Underwriters can verify documents'); return true; }

  canApprove(actor: ActorContext, resourceType: ResourceType): boolean {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (roles.some((r) => ADMIN_ROLES.includes(r))) return true;
    if (resourceType === 'QUOTATION' || resourceType === 'LEAD') { if (!roles.some((r) => QUOTE_APPROVERS.includes(r))) throw new ForbiddenException('Only Sales Managers or Branch Managers can approve quotations or leads'); return true; }
    if (resourceType === 'CLAIM') { if (!roles.some((r) => CLAIM_APPROVERS.includes(r))) throw new ForbiddenException('Only Claims Officers or Branch Managers can approve claims'); return true; }
    if (resourceType === 'POLICY') { if (!roles.some((r) => POLICY_ISSUERS.includes(r))) throw new ForbiddenException('Only Operations and Underwriters can approve policies'); return true; }
    throw new ForbiddenException(`Approval is not defined for ${resourceType}`);
  }
}
