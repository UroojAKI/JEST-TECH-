export type RoleType =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'BRANCH_MANAGER'
  | 'TEAM_LEADER'
  | 'UNDERWRITER'
  | 'SALES_AGENT'
  | 'CLAIMS_HANDLER'
  | 'FINANCE_OFFICER'
  | 'CUSTOMER';

export type Permission =
  | 'lead:read'
  | 'lead:create'
  | 'lead:update'
  | 'lead:delete'
  | 'policy:read'
  | 'policy:create'
  | 'policy:issue'
  | 'policy:renew'
  | 'claim:read'
  | 'claim:create'
  | 'claim:approve'
  | 'claim:pay'
  | 'finance:read'
  | 'finance:manage'
  | 'admin:read'
  | 'admin:manage'
  | 'report:read'
  | 'report:export';

export interface UserSession {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  roles: RoleType[];
  permissions: Permission[];
  branchId?: string;
  departmentId?: string;
  teamId?: string;
  avatarUrl?: string;
}

export interface AuthState {
  user: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  idleWarningVisible: boolean;
  lastActiveTimestamp: number;
}

export interface NavigationItem {
  id: string;
  title: string;
  href: string;
  icon?: string;
  roles?: RoleType[];
  permissions?: Permission[];
  featureFlag?: string;
  children?: NavigationItem[];
  badge?: string | number;
}

export interface NotificationItem {
  id: string;
  title: string;
  message: string;
  category: 'CLAIMS' | 'RENEWALS' | 'TASKS' | 'WORKFLOW' | 'FINANCE' | 'GENERAL';
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: string;
  isRead: boolean;
  linkUrl?: string;
}

export interface CustomerContextState {
  activeCustomerId: string | null;
  activeCustomerName: string | null;
  activeCustomerType: 'INDIVIDUAL' | 'CORPORATE' | null;
}

export interface PaginationParams {
  page: number;
  limit: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  search?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
