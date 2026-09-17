import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RoleType } from '@prisma/client';

import { ROLES_KEY } from '../decorators/roles.decorator';
import { ANY_AUTHENTICATED_ROLE_KEY } from '../decorators/any-authenticated.decorator';

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredRoles = this.reflector.getAllAndOverride<string[]>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );

    const anyAuthenticated = this.reflector.getAllAndOverride<boolean>(
      ANY_AUTHENTICATED_ROLE_KEY,
      [context.getHandler(), context.getClass()],
    );

    // Fail-closed: every endpoint must explicitly declare required roles OR opt-in to AnyAuthenticatedRole.
    // This prevents new endpoints from silently bypassing role enforcement.
    if ((!requiredRoles || requiredRoles.length === 0) && !anyAuthenticated) {
      throw new ForbiddenException(
        'This endpoint does not declare required roles. Apply @Roles(...) or @AnyAuthenticatedRole() explicitly.',
      );
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user) {
      return false;
    }

    // AnyAuthenticatedRole: passes all authenticated users
    if (anyAuthenticated) {
      return true;
    }

    const userRoles = (user.roles?.length ? user.roles : [user.role]).filter(
      Boolean,
    );

    // Privileged system roles are explicitly defined as global role bypasses.
    // In canonical 3-role architecture, ADMIN is the sole administrator role.
    if (userRoles.some((r: string) => r === RoleType.ADMIN || r === 'ADMIN')) {
      return true;
    }

    // Exact role matching is required. In particular, one operational or
    // sales role must never satisfy an endpoint requiring a different role.
    if (userRoles.some((r: string) => requiredRoles.includes(r))) {
      return true;
    }

    throw new ForbiddenException(
      `Access denied. Required role: ${requiredRoles.join(' | ')}`,
    );
  }
}
