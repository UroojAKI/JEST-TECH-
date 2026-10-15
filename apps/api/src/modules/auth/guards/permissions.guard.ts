import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!user || !user.permissions) {
      throw new ForbiddenException('Access denied. No permissions assigned.');
    }

    // Older controllers used uppercase REPORT_* constants while seeded RBAC
    // grants canonical lower-case domain codes (report:read/create/export).
    // Normalize this legacy vocabulary centrally so authorization is enforced
    // consistently without weakening access for unseeded roles.
    const legacyPermissionAliases: Record<string, string[]> = {
      REPORT_VIEW: ['report:read'],
      REPORT_CREATE: ['report:create'],
      REPORT_EXECUTE: ['report:export'],
      // Scheduling is currently governed by the existing report-create grant.
      // Split this into a dedicated report:schedule permission when role grants
      // are migrated consistently across existing tenants.
    };
    const actorPermissions = new Set<string>(user.permissions);
    const isGranted = (permission: string) =>
      actorPermissions.has('*') ||
      actorPermissions.has(permission) ||
      (legacyPermissionAliases[permission] || []).some((alias) =>
        actorPermissions.has(alias),
      );

    const hasAllPermissions = requiredPermissions.every(isGranted);

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
