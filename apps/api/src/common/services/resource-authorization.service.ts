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
  | 'CUSTOMER'
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

export type AccessScope = 'OWN' | 'ASSIGNED' | 'ORGANIZATION' | 'ALL';

@Injectable()
export class ResourceAuthorizationService {
  authorize(
    actor: ActorContext,
    resourceType: ResourceType,
    action: ResourceAction,
    resource?: any,
  ): boolean {
    if (!actor?.userId || !actor.organizationId) {
      throw new ForbiddenException('Actor organizational context is required');
    }
    if (
      actor.status === UserStatus.SUSPENDED ||
      actor.status === UserStatus.INACTIVE
    ) {
      throw new ForbiddenException(
        `User account is ${actor.status.toLowerCase()}`,
      );
    }

    if (resource) {
      this.assertSameOrganization(actor, resource);
    }

    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (roles.includes(RoleType.ADMIN) || actor.permissions?.includes('*')) {
      // Admin has universal role-level access (domain invariants enforced separately)
      return true;
    }

    switch (action) {
      case 'READ':
        return this.canRead(actor, resource, resourceType);
      case 'CREATE':
        return this.canCreate(actor, resourceType);
      case 'UPDATE':
      case 'TRANSITION':
        return this.canUpdate(actor, resource, resourceType);
      case 'DELETE':
        return this.canDelete(actor);
      case 'ASSIGN':
        return this.canAssign(actor, resource);
      case 'ISSUE':
        return this.canIssue(actor);
      case 'RECONCILE':
        return this.canReconcile(actor);
      case 'VERIFY':
        return this.canVerifyDocument(actor);
      case 'APPROVE':
        return this.canApprove(actor, resourceType);
      default:
        throw new ForbiddenException('Unsupported authorization action');
    }
  }

  assertSameOrganization(actor: ActorContext, resource: any): void {
    if (actor.permissions?.includes('*')) {
      return; // Universal super-admin transcends single-organization scope
    }

    const resourceOrg =
      resource.companyId ??
      resource.organizationId ??
      resource.createdBy?.companyId ??
      resource.createdBy?.organizationId ??
      resource.createdBy?.branch?.zone?.region?.company?.id ??
      resource.assignedTo?.companyId ??
      resource.assignedTo?.organizationId ??
      resource.assignedTo?.branch?.zone?.region?.company?.id ??
      resource.contact?.companyId ??
      resource.contact?.branch?.zone?.region?.company?.id ??
      resource.agent?.companyId ??
      resource.agent?.branch?.zone?.region?.company?.id;

    if (!resourceOrg) {
      if (resource?.id) {
        throw new ForbiddenException(
          'Resource organizational context could not be verified',
        );
      }
      return;
    }

    const actorOrg = actor.companyId || actor.organizationId;
    if (resourceOrg !== actorOrg) {
      throw new ForbiddenException(
        'Cross-organization access is strictly prohibited',
      );
    }
  }

  canRead(
    actor: ActorContext,
    resource: any,
    resourceType: ResourceType,
  ): boolean {
    if (!resource) {
      throw new ForbiddenException('Resource is required for authorization');
    }

    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (roles.includes(RoleType.ADMIN)) return true;

    // Back Office: Organization-wide access within tenant
    if (roles.includes(RoleType.BACK_OFFICE)) {
      return true;
    }

    // Agent: Scope OWN or ASSIGNED only
    const isOwnerOrAssigned =
      resource.createdById === actor.userId ||
      resource.assignedToId === actor.userId ||
      resource.userId === actor.userId ||
      (actor.agentId && (resource.agentId === actor.agentId || resource.agent?.id === actor.agentId)) ||
      resource.agent?.userId === actor.userId ||
      resource.agentId === actor.userId ||
      (actor.agentId && resource.policy?.agentId === actor.agentId) ||
      resource.policy?.agent?.userId === actor.userId ||
      resource.lead?.assignedToId === actor.userId ||
      resource.lead?.createdById === actor.userId ||
      resource.quotation?.createdById === actor.userId ||
      resource.policy?.createdById === actor.userId;

    if (isOwnerOrAssigned) return true;

    throw new ForbiddenException(
      `You do not have permission to access this ${resourceType.toLowerCase()}`,
    );
  }

  canCreate(actor: ActorContext, resourceType: ResourceType): boolean {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (roles.includes(RoleType.ADMIN)) return true;

    switch (resourceType) {
      case 'QUOTATION':
      case 'LEAD':
      case 'CONTACT':
      case 'CLAIM':
        return roles.includes(RoleType.BACK_OFFICE) || roles.includes(RoleType.AGENT);
      case 'POLICY':
        // Issuance is Back Office operations or Admin only
        return roles.includes(RoleType.BACK_OFFICE);
      case 'PAYMENT':
        return roles.includes(RoleType.BACK_OFFICE) || roles.includes(RoleType.AGENT);
      default:
        return roles.includes(RoleType.BACK_OFFICE);
    }
  }

  canUpdate(
    actor: ActorContext,
    resource: any,
    resourceType: ResourceType,
  ): boolean {
    return this.canRead(actor, resource, resourceType);
  }

  canDelete(actor: ActorContext): boolean {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    // In canonical 3-role architecture, DELETE is strictly Admin-only
    if (!roles.includes(RoleType.ADMIN)) {
      throw new ForbiddenException('Only Administrators can delete records');
    }
    return true;
  }

  canAssign(actor: ActorContext, resource?: any): boolean {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    // Admin and Back Office can assign records; Agents cannot
    if (!roles.includes(RoleType.ADMIN) && !roles.includes(RoleType.BACK_OFFICE)) {
      throw new ForbiddenException(
        'Only Back Office and Administrators can assign records',
      );
    }
    return true;
  }

  canIssue(actor: ActorContext): boolean {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (!roles.includes(RoleType.ADMIN) && !roles.includes(RoleType.BACK_OFFICE)) {
      throw new ForbiddenException(
        'User role is not authorized to issue policies',
      );
    }
    return true;
  }

  canReconcile(actor: ActorContext): boolean {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (!roles.includes(RoleType.ADMIN) && !roles.includes(RoleType.BACK_OFFICE)) {
      throw new ForbiddenException(
        'Only Finance & Back Office personnel can reconcile payments',
      );
    }
    return true;
  }

  canVerifyDocument(actor: ActorContext): boolean {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (!roles.includes(RoleType.ADMIN) && !roles.includes(RoleType.BACK_OFFICE)) {
      throw new ForbiddenException(
        'Only Back Office personnel can verify documents',
      );
    }
    return true;
  }

  canApprove(actor: ActorContext, resourceType: ResourceType): boolean {
    const roles = actor.roles?.length ? actor.roles : [actor.role];
    if (!roles.includes(RoleType.ADMIN) && !roles.includes(RoleType.BACK_OFFICE)) {
      throw new ForbiddenException(
        `Only Back Office and Administrators can approve ${resourceType.toLowerCase()}s`,
      );
    }
    return true;
  }
}
