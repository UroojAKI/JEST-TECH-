import { apiClient } from '../lib/api-client';

export interface AdminDashboardMetrics {
  activeUsersCount: number;
  loggedInUsersCount: number;
  branchesCount: number;
  departmentsCount: number;
  teamsCount: number;
  apiHealth: string;
  queueDepth: number;
  redisStatus: string;
  storageUsage: string;
  auditEventsToday: number;
}

export interface UserItem {
  id: string;
  employeeCode: string;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: string;
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED';
  branchName: string;
  teamName: string;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface RolePermissionItem {
  roleId: string;
  roleName: string;
  description: string;
  permissions: {
    module: string;
    view: boolean;
    create: boolean;
    update: boolean;
    delete: boolean;
    approve: boolean;
    export: boolean;
  }[];
}

export interface BranchItem {
  id: string;
  code: string;
  name: string;
  city: string;
  state: string;
  managerName: string;
  staffCount: number;
  activePolicies: number;
  monthlyGwp: number;
  status: 'ACTIVE' | 'INACTIVE';
}

export interface LookupItem {
  id: string;
  type: string;
  code: string;
  name: string;
  category?: string;
  isActive: boolean;
  metadata?: Record<string, any>;
}

export interface NumberSeriesItem {
  id: string;
  entityType: string;
  prefix: string;
  suffix?: string;
  currentSequence: number;
  paddingDigits: number;
  financialYearReset: boolean;
  previewSample: string;
}

export interface SystemConfigItem {
  companyName: string;
  gstin: string;
  financialYear: string;
  defaultBranch: string;
  timezone: string;
  currency: string;
  sessionTimeoutMinutes: number;
}

export interface FeatureFlagItem {
  id: string;
  key: string;
  name: string;
  description: string;
  isEnabled: boolean;
  environment: 'PRODUCTION' | 'STAGING' | 'DEVELOPMENT';
  rolloutPercentage: number;
}

export interface AuditLogItem {
  id: string;
  timestamp: string;
  userEmail: string;
  userRole: string;
  module: string;
  action: string;
  entityId: string;
  correlationId: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  ipAddress: string;
}

export interface HealthStatusItem {
  status: 'ok' | 'error';
  info: {
    database: { status: 'up' };
    redis: { status: 'up' };
    storage: { status: 'up'; provider: string };
    queue: { status: 'up'; activeJobs: number; waitingJobs: number };
  };
  error: Record<string, any>;
  details: Record<string, any>;
}

export const adminRepository = {
  async getDashboardMetrics(): Promise<AdminDashboardMetrics> {
    const response = await apiClient.get('/admin/config/metrics');
    return response.data;
  },

  async getUsers(params?: { status?: string; role?: string; search?: string }): Promise<UserItem[]> {
    const response = await apiClient.get('/users', { params });
    // Handle both flat array and paginated { items/data: [], total, page } responses
    const raw = response.data;
    if (Array.isArray(raw)) return raw;
    if (Array.isArray(raw?.items)) return raw.items;
    if (Array.isArray(raw?.data)) return raw.data;
    return [];
  },

  async createUser(data: Partial<UserItem>): Promise<UserItem> {
    const response = await apiClient.post('/users', data);
    return response.data;
  },

  async updateUserStatus(id: string, status: string): Promise<UserItem> {
    const response = status === 'LOCKED' 
      ? await apiClient.post(`/users/${id}/lock`)
      : await apiClient.post(`/users/${id}/unlock`);
    return response.data;
  },

  async resetUserPassword(id: string, newPassword?: string): Promise<{ success: boolean; message: string; newPassword?: string }> {
    const response = await apiClient.post(`/users/${id}/reset-password`, { newPassword });
    return response.data;
  },

  async changePassword(newPassword: string, currentPassword?: string): Promise<{ success: boolean; message: string }> {
    const response = await apiClient.post('/users/change-password', { currentPassword, newPassword });
    return response.data;
  },

  async getRoles(): Promise<RolePermissionItem[]> {
    const response = await apiClient.get('/users/roles');
    return response.data;
  },

  async getBranches(): Promise<BranchItem[]> {
    const response = await apiClient.get('/admin/organization/branches');
    return response.data;
  },

  async getLookups(type?: string): Promise<LookupItem[]> {
    const response = type ? await apiClient.get(`/admin/lookups/${type}`) : await apiClient.get('/admin/lookups');
    return response.data;
  },

  async getNumberSeries(): Promise<NumberSeriesItem[]> {
    const response = await apiClient.get('/admin/config/numbering');
    return response.data;
  },

  async getSystemConfig(): Promise<SystemConfigItem> {
    const response = await apiClient.get('/admin/config');
    return response.data;
  },

  async updateSystemConfig(data: Partial<SystemConfigItem>): Promise<SystemConfigItem> {
    const response = await apiClient.put('/admin/config', data);
    return response.data;
  },

  async getFeatureFlags(): Promise<FeatureFlagItem[]> {
    const response = await apiClient.get('/admin/config/flags');
    return response.data;
  },

  async toggleFeatureFlag(id: string, isEnabled: boolean): Promise<FeatureFlagItem> {
    const response = await apiClient.patch(`/admin/config/flags/${id}`, { isEnabled });
    return response.data;
  },

  async getAuditLogs(params?: { search?: string; module?: string }): Promise<AuditLogItem[]> {
    const response = await apiClient.get('/audit', { params });
    return response.data;
  },

  async getSystemHealth(): Promise<HealthStatusItem> {
    const response = await apiClient.get('/health');
    return response.data;
  },
};
