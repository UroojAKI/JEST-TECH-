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
    if (!user) {
      return false;
    }

    // Super Admin, Admin, System Administrator, and MD/CEO bypass role restrictions
    if (['SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMINISTRATOR', 'MD_CEO'].includes(user.role)) {
      return true;
    }

    if (requiredRoles.includes(user.role)) {
      return true;
    }

    // Grant internal staff access to general employee endpoints across departments
    const employeeRoles = [
      'BRANCH_MANAGER', 'TEAM_LEADER', 'SALES_AGENT', 'OPERATIONS',
      'UNDERWRITER', 'CLAIMS_OFFICER', 'FINANCE', 'SUPPORT',
      'CHIEF_FINANCE_OFFICER', 'SALES_MANAGER', 'SALES_EXECUTIVE',
      'POLICY_ISSUANCE_EXECUTIVE', 'RENEWAL_EXECUTIVE',
      'CUSTOMER_SERVICE_EXECUTIVE', 'FINANCE_ACCOUNTS_EXECUTIVE',
      'POSP_ADVISOR', 'AGENT_MANAGER', 'MARKETING_DIRECTOR', 'RENEWAL_AGENT', 'CRM_AGENT',
    ];

    const allowsAnyEmployee = requiredRoles.some((r) => employeeRoles.includes(r));
    const userIsEmployee = employeeRoles.includes(user.role);

    if (allowsAnyEmployee && userIsEmployee) {
      return true;
    }

    throw new ForbiddenException(
      `Access denied. Required role: ${requiredRoles.join(' | ')}`,
    );
  }
}
