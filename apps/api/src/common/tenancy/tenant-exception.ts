import { ForbiddenException } from '@nestjs/common';

/**
 * Thrown when an actor attempts to access a resource that belongs to a different company.
 * This is the canonical cross-tenant access violation exception for JEST Policy CRM.
 *
 * NOTE: Do NOT expose the resourceCompanyId or actorCompanyId in production error messages
 * to prevent information leakage. The caller decides the user-facing message.
 */
export class CrossTenantException extends ForbiddenException {
  constructor(message = 'Access denied: resource does not belong to your organization') {
    super(message);
    this.name = 'CrossTenantException';
  }
}

/**
 * Thrown when an actor attempts to access a resource outside their assigned branch scope.
 */
export class CrossBranchException extends ForbiddenException {
  constructor(message = 'Access denied: resource does not belong to your branch') {
    super(message);
    this.name = 'CrossBranchException';
  }
}
