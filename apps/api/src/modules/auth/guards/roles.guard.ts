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
      [
        context.getHandler(), // method-level decorator wins
        context.getClass(), // fallback to class-level decorator
      ],
    );

    // No @Roles() applied — route is accessible to any authenticated user
    if (!requiredRoles) {
      return true;
    }

    const { user } = context.switchToHttp().getRequest();

    if (!requiredRoles.includes(user.role)) {
      throw new ForbiddenException(
        `Access denied. Required role: ${requiredRoles.join(' | ')}`,
      );
    }

    return true;
  }
}
