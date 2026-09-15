import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleType } from '@prisma/client';
import {
  WORKSPACE_KEY,
  WorkspaceCode,
} from '../decorators/require-workspace.decorator';
import { ActorContext } from '../interfaces/actor-context.interface';

export const WORKSPACE_ROLE_MATRIX: Record<WorkspaceCode, RoleType[]> = {
  SALES: [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT],
  FINANCE: [RoleType.ADMIN, RoleType.BACK_OFFICE],
  BACK_OFFICE: [RoleType.ADMIN, RoleType.BACK_OFFICE],
  RENEWALS: [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT],
  CLAIMS: [RoleType.ADMIN, RoleType.BACK_OFFICE, RoleType.AGENT],
  MANAGEMENT: [RoleType.ADMIN],
  ADMINISTRATION: [RoleType.ADMIN],
  PORTAL: [RoleType.AGENT],
};

/**
 * Resolves all permitted workspaces for a given ActorContext.
 */
export function resolvePermittedWorkspaces(
  actor: ActorContext,
): WorkspaceCode[] {
  if (
    actor.roles?.includes(RoleType.ADMIN) ||
    actor.role === RoleType.ADMIN ||
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

  for (const [workspace, roles] of Object.entries(WORKSPACE_ROLE_MATRIX) as [
    WorkspaceCode,
    RoleType[],
  ][]) {
    const hasRole = actorRoles.some((r) => roles.includes(r));
    const hasPerm = actor.permissions?.includes(
      `workspace.${workspace.toLowerCase()}`,
    );
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
      throw new ForbiddenException(
        'Actor context required for workspace access',
      );
    }

    // Company-branch hierarchy enforcement
    const targetBranchId =
      request.query?.branchId ||
      request.body?.branchId ||
      request.params?.branchId;
    const targetCompanyId =
      request.query?.companyId ||
      request.body?.companyId ||
      request.params?.companyId;

    const actorRoles = actor.roles || [actor.role];
    const GLOBAL_ROLES: RoleType[] = [RoleType.ADMIN];
    const isGlobalActor = actorRoles.some((r) => GLOBAL_ROLES.includes(r));

    if (!isGlobalActor) {
      if (
        targetCompanyId &&
        actor.companyId &&
        targetCompanyId !== actor.companyId
      ) {
        throw new ForbiddenException(
          `Cross-company access denied: Actor company (${actor.companyId}) does not match target company (${targetCompanyId})`,
        );
      }
      if (
        targetBranchId &&
        actor.branchId &&
        targetBranchId !== actor.branchId
      ) {
        throw new ForbiddenException(
          `Cross-branch access denied: Actor branch (${actor.branchId}) does not match target branch (${targetBranchId})`,
        );
      }
    }

    // Admin has universal workspace access
    if (
      actor.roles?.includes(RoleType.ADMIN) ||
      actor.role === RoleType.ADMIN
    ) {
      return true;
    }

    const allowedRoles = WORKSPACE_ROLE_MATRIX[requiredWorkspace] || [];

    const hasRoleAccess = actorRoles.some((r) => allowedRoles.includes(r));
    const hasPermissionOverride =
      actor.permissions?.includes('*') ||
      actor.permissions?.includes(
        `workspace.${requiredWorkspace.toLowerCase()}`,
      );

    if (!hasRoleAccess && !hasPermissionOverride) {
      throw new ForbiddenException(
        `User ${actor.email} (${actor.role}) does not have access to the '${requiredWorkspace}' workspace`,
      );
    }

    return true;
  }
}
