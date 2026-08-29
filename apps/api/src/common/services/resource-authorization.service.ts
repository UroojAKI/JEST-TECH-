import { Injectable, ForbiddenException } from '@nestjs/common';
import { RoleType, UserStatus } from '@prisma/client';
import { ActorContext } from '../interfaces/actor-context.interface';

export type ResourceType =
  | 'LEAD'
  | 'QUOTATION'
  | 'POLICY'
  | 'PAYMENT'
  | 'DOCUMENT'
  | 'RENEWAL_TASK'
  | 'CLAIM'
  | 'CONTACT'
  | 'ACCOUNT'
  | 'CUSTOMER_360'
  | 'REPORT';

export type ResourceAction =
  | 'READ'
  | 'CREATE'
  | 'UPDATE'
  | 'DELETE'
  | 'TRANSITION'
  | 'ASSIGN'
  | 'ISSUE'
  | 'RECONCILE'
  | 'VERIFY'
  | 'APPROVE';

export type AccessScope =
  'OWN' | 'ASSIGNED' | 'TEAM' | 'BRANCH' | 'ORGANIZATION' | 'GLOBAL';

const ADMIN_ROLES: RoleType[] = [
  RoleType.ADMIN,
  RoleType.SUPER_ADMIN,
  RoleType.MD_CEO,
  RoleType.SYSTEM_ADMINISTRATOR,
];

const BRANCH_ROLES: RoleType[] = [
  RoleType.BRANCH_MANAGER,
  RoleType.MARKETING_DIRECTOR,
];

const TEAM_ROLES: RoleType[] = [RoleType.TEAM_LEADER, RoleType.SALES_MANAGER];

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

const SALES_CREATORS: RoleType[] = [
  RoleType.SALES_AGENT,
  RoleType.SALES_EXECUTIVE,
  RoleType.SALES_MANAGER,
  RoleType.POSP_ADVISOR,
  RoleType.AGENT_MANAGER,
  RoleType.ADMIN,
  RoleType.SUPER_ADMIN,
];

const POLICY_ISSUERS: RoleType[] = [
  RoleType.OPERATIONS,
  RoleType.POLICY_ISSUANCE_EXECUTIVE,
  RoleType.UNDERWRITER,
  RoleType.ADMIN,
  RoleType.SUPER_ADMIN,
];

const FINANCE_ROLES: RoleType[] = [
  RoleType.FINANCE,
  RoleType.FINANCE_ACCOUNTS_EXECUTIVE,
  RoleType.CHIEF_FINANCE_OFFICER,
  RoleType.ADMIN,
  RoleType.SUPER_ADMIN,
];

const ASSIGNERS: RoleType[] = [
  RoleType.ADMIN,
  RoleType.SUPER_ADMIN,
  RoleType.MD_CEO,
  RoleType.SALES_MANAGER,
  RoleType.BRANCH_MANAGER,
  RoleType.TEAM_LEADER,
];

const DOC_VERIFIERS: RoleType[] = [
  RoleType.OPERATIONS,
  RoleType.POLICY_ISSUANCE_EXECUTIVE,
  RoleType.UNDERWRITER,
  RoleType.ADMIN,
  RoleType.SUPER_ADMIN,
];

const QUOTE_APPROVERS: RoleType[] = [
  RoleType.SALES_MANAGER,
  RoleType.BRANCH_MANAGER,
  RoleType.TEAM_LEADER,
  RoleType.ADMIN,
  RoleType.SUPER_ADMIN,
];

const CLAIM_APPROVERS: RoleType[] = [
  RoleType.CLAIMS_OFFICER,
  RoleType.BRANCH_MANAGER,
  RoleType.ADMIN,
  RoleType.SUPER_ADMIN,
];

@Injectable()
export class ResourceAuthorizationService {
  authorize(
    actor: ActorContext,
    resourceType: ResourceType,
    action: ResourceAction,
    resource?: any,
  ): boolean {
    if (!actor || !actor.userId) {
      throw new ForbiddenException('Unauthenticated actor context');
    }

    if (
      actor.status === UserStatus.SUSPENDED ||
      actor.status === UserStatus.INACTIVE
    ) {
      throw new ForbiddenException(
        `User account is ${actor.status.toLowerCase()}`,
      );
    }

    if (
      actor.roles?.includes(RoleType.SUPER_ADMIN) ||
      actor.role === RoleType.SUPER_ADMIN ||
      actor.permissions?.includes('*')
    ) {
      return true;
    }

    if (
      resource &&
      resource.organizationId &&
      actor.organizationId &&
      resource.organizationId !== actor.organizationId &&
      resource.organizationId !== 'DEFAULT_ORG' &&
      actor.organizationId !== 'DEFAULT_ORG'
    ) {
      throw new ForbiddenException(
        'Cross-organization access is strictly prohibited',
      );
    }

    switch (action) {
      case 'READ':
        return this.canRead(actor, resource, resourceType);
      case 'CREATE':
        return this.canCreate(actor, resourceType);
      case 'UPDATE':
        return this.canUpdate(actor, resource, resourceType);
      case 'DELETE':
        return this.canDelete(actor, resource, resourceType);
      case 'ASSIGN':
        return this.canAssign(actor, resource, resourceType);
      case 'ISSUE':
        return this.canIssue(actor, resource);
      case 'RECONCILE':
        return this.canReconcile(actor, resource);
      case 'VERIFY':
        return this.canVerifyDocument(actor, resource);
      case 'APPROVE':
        return this.canApprove(actor, resource, resourceType);
      case 'TRANSITION':
        return this.canTransition(actor, resource, resourceType);
      default:
        return this.canRead(actor, resource, resourceType);
    }
  }

  canRead(
    actor: ActorContext,
    resource: any,
    resourceType: ResourceType,
  ): boolean {
    if (!resource) return true;

    const actorRoles: RoleType[] = actor.roles || [actor.role];

    if (actorRoles.some((r) => ADMIN_ROLES.includes(r))) {
      return true;
    }

    if (actorRoles.some((r) => BRANCH_ROLES.includes(r))) {
      if (!actor.branchId || !resource.branchId) return true;
      if (actor.branchId === resource.branchId) return true;
      throw new ForbiddenException('Resource belongs to another branch');
    }

    if (actorRoles.some((r) => TEAM_ROLES.includes(r))) {
      if (!actor.teamId || !resource.teamId) return true;
      if (actor.teamId === resource.teamId) return true;
      if (
        actor.branchId &&
        resource.branchId &&
        actor.branchId === resource.branchId
      )
        return true;
      throw new ForbiddenException('Resource belongs to another sales team');
    }

    if (actorRoles.some((r) => OPERATIONAL_ROLES.includes(r))) {
      return true;
    }

    const isOwner =
      resource.createdById === actor.userId ||
      resource.assignedToId === actor.userId ||
      resource.agentId === actor.userId ||
      resource.userId === actor.userId ||
      (resource.lead &&
        (resource.lead.assignedToId === actor.userId ||
          resource.lead.createdById === actor.userId)) ||
      (resource.quotation && resource.quotation.createdById === actor.userId) ||
      (resource.policy && resource.policy.createdById === actor.userId);

    if (isOwner) {
      return true;
    }

    throw new ForbiddenException(
      `You do not have permission to access this ${resourceType.toLowerCase()}`,
    );
  }

  canCreate(actor: ActorContext, resourceType: ResourceType): boolean {
    const actorRoles: RoleType[] = actor.roles || [actor.role];

    switch (resourceType) {
      case 'QUOTATION':
      case 'LEAD':
        return actorRoles.some((r) => SALES_CREATORS.includes(r));

      case 'POLICY':
        return actorRoles.some((r) => POLICY_ISSUERS.includes(r));

      case 'PAYMENT':
        return actorRoles.some((r) =>
          [
            ...FINANCE_ROLES,
            RoleType.SALES_AGENT,
            RoleType.SALES_EXECUTIVE,
          ].includes(r),
        );

      case 'CLAIM':
        return true;

      default:
        return true;
    }
  }

  canUpdate(
    actor: ActorContext,
    resource: any,
    resourceType: ResourceType,
  ): boolean {
    return this.canRead(actor, resource, resourceType);
  }

  canDelete(
    actor: ActorContext,
    _resource: any,
    _resourceType: ResourceType,
  ): boolean {
    const actorRoles: RoleType[] = actor.roles || [actor.role];
    const isAdmin = actorRoles.some((r) => ADMIN_ROLES.includes(r));
    if (!isAdmin) {
      throw new ForbiddenException('Only Administrators can delete records');
    }
    return true;
  }

  canAssign(
    actor: ActorContext,
    resource: any,
    _resourceType: ResourceType,
  ): boolean {
    const actorRoles: RoleType[] = actor.roles || [actor.role];
    const canAssign = actorRoles.some((r) => ASSIGNERS.includes(r));
    if (!canAssign) {
      throw new ForbiddenException(
        'Only Managers and Administrators can assign records',
      );
    }

    // Cross-team assignment restriction for Team Leaders
    if (
      actorRoles.includes(RoleType.TEAM_LEADER) &&
      !actorRoles.some(
        (r) => ADMIN_ROLES.includes(r) || r === RoleType.BRANCH_MANAGER,
      )
    ) {
      if (
        resource &&
        resource.teamId &&
        actor.teamId &&
        resource.teamId !== actor.teamId
      ) {
        throw new ForbiddenException(
          'Team Leaders cannot assign records outside their team',
        );
      }
    }

    // Cross-branch assignment restriction for Branch Managers
    if (
      actorRoles.includes(RoleType.BRANCH_MANAGER) &&
      !actorRoles.some((r) => ADMIN_ROLES.includes(r))
    ) {
      if (
        resource &&
        resource.branchId &&
        actor.branchId &&
        resource.branchId !== actor.branchId
      ) {
        throw new ForbiddenException(
          'Branch Managers cannot assign records outside their branch',
        );
      }
    }

    return true;
  }

  canIssue(actor: ActorContext, _resource: any): boolean {
    const actorRoles: RoleType[] = actor.roles || [actor.role];
    const canIssue = actorRoles.some((r) => POLICY_ISSUERS.includes(r));
    if (!canIssue) {
      throw new ForbiddenException(
        'Only Back Office Operations and Policy Issuance Executives can issue policies',
      );
    }
    return true;
  }

  canReconcile(actor: ActorContext, _payment: any): boolean {
    const actorRoles: RoleType[] = actor.roles || [actor.role];
    const canRecon = actorRoles.some((r) => FINANCE_ROLES.includes(r));
    if (!canRecon) {
      throw new ForbiddenException(
        'Only Finance & Accounts personnel can reconcile payments',
      );
    }
    return true;
  }

  canVerifyDocument(actor: ActorContext, _doc: any): boolean {
    const actorRoles: RoleType[] = actor.roles || [actor.role];
    const canVerify = actorRoles.some((r) => DOC_VERIFIERS.includes(r));
    if (!canVerify) {
      throw new ForbiddenException(
        'Only Back Office Operations and Underwriters can verify documents',
      );
    }
    return true;
  }

  canApprove(
    actor: ActorContext,
    _resource: any,
    resourceType: ResourceType,
  ): boolean {
    const actorRoles: RoleType[] = actor.roles || [actor.role];
    const isAdmin = actorRoles.some((r) => ADMIN_ROLES.includes(r));
    if (isAdmin) return true;

    switch (resourceType) {
      case 'QUOTATION':
      case 'LEAD':
        if (!actorRoles.some((r) => QUOTE_APPROVERS.includes(r))) {
          throw new ForbiddenException(
            'Only Sales Managers or Branch Managers can approve quotations or leads',
          );
        }
        return true;

      case 'CLAIM':
        if (!actorRoles.some((r) => CLAIM_APPROVERS.includes(r))) {
          throw new ForbiddenException(
            'Only Claims Officers or Branch Managers can approve claims',
          );
        }
        return true;

      case 'POLICY':
        if (!actorRoles.some((r) => POLICY_ISSUERS.includes(r))) {
          throw new ForbiddenException(
            'Only Operations and Underwriters can approve policies',
          );
        }
        return true;

      default:
        return true;
    }
  }

  canTransition(
    actor: ActorContext,
    resource: any,
    resourceType: ResourceType,
  ): boolean {
    return this.canUpdate(actor, resource, resourceType);
  }
}
