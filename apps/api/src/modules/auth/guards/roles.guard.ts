import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import { ROLES_KEY } from '../decorators/roles.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    // A route without an explicit role requirement is intentionally available
    // to any already-authenticated user. Authentication and permission guards
    // remain responsible for protecting such routes.
    if (!requiredRoles || requiredRoles.length === 0) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return false;
    }

    // Privileged system roles are explicitly defined as global role bypasses.
    // Do not extend this list based on a generic "employee" classification.
    if (
      ['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMINISTRATOR', 'MD_CEO'].includes(
        user.role,
      )
    ) {
      return true;
    }

    // Exact role matching is required. In particular, one operational or
    // sales role must never satisfy an endpoint requiring a different role.
    if (requiredRoles.includes(user.role)) {
      return true;
    }

    throw new ForbiddenException(
      `Access denied. Required role: ${requiredRoles.join(' | ')}`,
    );
  }
}
