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

    const PERMISSION_ALIASES: Record<string, string[]> = {
      'REPORT_VIEW': ['report:read', 'report:view', 'REPORT_VIEW'],
      'report:read': ['REPORT_VIEW', 'report:read', 'report:view'],
      'REPORT_CREATE': ['report:create', 'REPORT_CREATE'],
      'report:create': ['REPORT_CREATE', 'report:create'],
      'REPORT_EXECUTE': ['report:export', 'report:execute', 'REPORT_EXECUTE'],
      'report:export': ['REPORT_EXECUTE', 'report:export', 'report:execute'],
      'report:execute': ['REPORT_EXECUTE', 'report:execute', 'report:export'],
      'REPORT_SCHEDULE': ['report:create', 'report:schedule', 'REPORT_SCHEDULE'],
      'report:schedule': ['REPORT_SCHEDULE', 'report:create', 'report:schedule'],
    };

    const hasAllPermissions = requiredPermissions.every((required) => {
      const aliases = PERMISSION_ALIASES[required] || [required];
      return aliases.some((p) => user.permissions.includes(p));
    });

    if (!hasAllPermissions) {
      throw new ForbiddenException(
        `Access denied. Required permissions: ${requiredPermissions.join(', ')}`,
      );
    }

    return true;
  }
}
