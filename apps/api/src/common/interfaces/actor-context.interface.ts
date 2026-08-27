import { RoleType, UserStatus } from '@prisma/client';

/**
 * Universal ActorContext representing the authenticated user's
 * complete identity, organizational hierarchy, permissions, and scoping boundaries.
 *
 * Invariant: Dashboard ≠ Role ≠ User ≠ Data Scope
 */
export interface ActorContext {
  userId: string;
  email: string;
  employeeCode?: string;
  firstName: string;
  lastName: string;
  organizationId: string;
  companyId: string;
  branchId?: string;
  branchCode?: string;
  departmentId?: string;
  departmentCode?: string;
  teamId?: string;
  role: RoleType;
  roles: RoleType[];
  permissions: string[];
  workspaces: string[];
  status: UserStatus;
  delegations?: {
    delegatorUserId: string;
    validUntil: Date;
    permissions: string[];
  }[];
}
