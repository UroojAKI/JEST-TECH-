import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleType } from '@prisma/client';
import { WORKSPACE_KEY, WorkspaceCode } from '../decorators/require-workspace.decorator';
import { ActorContext } from '../interfaces/actor-context.interface';

export const WORKSPACE_ROLE_MATRIX: Record<WorkspaceCode, RoleType[]> = {
  SALES: [
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.MD_CEO,
    RoleType.SALES_MANAGER,
    RoleType.SALES_EXECUTIVE,
    RoleType.SALES_AGENT,
    RoleType.POSP_ADVISOR,
    RoleType.AGENT_MANAGER,
    RoleType.TEAM_LEADER,
    RoleType.BRANCH_MANAGER,
  ],
  FINANCE: [
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.MD_CEO,
    RoleType.CHIEF_FINANCE_OFFICER,
    RoleType.FINANCE,
    RoleType.FINANCE_ACCOUNTS_EXECUTIVE,
  ],
  BACK_OFFICE: [
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.MD_CEO,
    RoleType.OPERATIONS,
    RoleType.POLICY_ISSUANCE_EXECUTIVE,
    RoleType.UNDERWRITER,
  ],
  RENEWALS: [
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.MD_CEO,
    RoleType.RENEWAL_EXECUTIVE,
    RoleType.SALES_MANAGER,
    RoleType.SALES_EXECUTIVE,
    RoleType.SALES_AGENT,
  ],
  CLAIMS: [
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.MD_CEO,
    RoleType.CLAIMS_OFFICER,
    RoleType.SUPPORT,
    RoleType.CUSTOMER_SERVICE_EXECUTIVE,
  ],
  MANAGEMENT: [
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.MD_CEO,
    RoleType.CHIEF_FINANCE_OFFICER,
    RoleType.SALES_MANAGER,
    RoleType.BRANCH_MANAGER,
    RoleType.MARKETING_DIRECTOR,
  ],
  ADMINISTRATION: [
    RoleType.SUPER_ADMIN,
    RoleType.ADMIN,
    RoleType.SYSTEM_ADMINISTRATOR,
  ],
  PORTAL: [
    RoleType.CUSTOMER,
    RoleType.POSP_ADVISOR,
    RoleType.SALES_AGENT,
  ],
};

/**
 * Resolves all permitted workspaces for a given ActorContext.
 */
export function resolvePermittedWorkspaces(actor: ActorContext): WorkspaceCode[] {
  if (
    actor.roles?.includes(RoleType.SUPER_ADMIN) ||
    actor.role === RoleType.SUPER_ADMIN ||
    actor.permissions?.includes('*')
  ) {
    return [
      'SALES',
      'FINANCE',
      'BACK_OFFICE',
      'RENEWALS',
      'CLAIMS',
      'MANAGEMENT',
      'ADMINISTRATION',
    ];
  }

  const actorRoles = actor.roles || [actor.role];
  const workspaces: WorkspaceCode[] = [];

  for (const [workspace, roles] of Object.entries(WORKSPACE_ROLE_MATRIX) as [WorkspaceCode, RoleType[]][]) {
    const hasRole = actorRoles.some((r) => roles.includes(r));
    const hasPerm = actor.permissions?.includes(`workspace.${workspace.toLowerCase()}`);
    if (hasRole || hasPerm) {
      workspaces.push(workspace);
    }
  }

  return workspaces;
}

@Injectable()
export class WorkspaceAccessGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredWorkspace = this.reflector.getAllAndOverride<WorkspaceCode>(
      WORKSPACE_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredWorkspace) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const actor: ActorContext = request.user;

    if (!actor || !actor.userId) {
      throw new ForbiddenException('Actor context required for workspace access');
    }

    // Super Admin has universal workspace access
    if (
      actor.roles?.includes(RoleType.SUPER_ADMIN) ||
      actor.role === RoleType.SUPER_ADMIN
    ) {
      return true;
    }

    const allowedRoles = WORKSPACE_ROLE_MATRIX[requiredWorkspace] || [];
    const actorRoles = actor.roles || [actor.role];

    const hasRoleAccess = actorRoles.some((r) => allowedRoles.includes(r));
    const hasPermissionOverride =
      actor.permissions?.includes('*') ||
      actor.permissions?.includes(`workspace.${requiredWorkspace.toLowerCase()}`);

    if (!hasRoleAccess && !hasPermissionOverride) {
      throw new ForbiddenException(
        `User ${actor.email} (${actor.role}) does not have access to the '${requiredWorkspace}' workspace`,
      );
    }

    return true;
  }
}
