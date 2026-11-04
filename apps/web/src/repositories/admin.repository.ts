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
  agentCode?: string | null;
  clientCodes?: Array<{
    id: string;
    value: string;
    codeSystem: string;
    verificationStatus: string;
    isPrimary: boolean;
  }>;
  agentProfile?: { id: string } | null;
  firstName: string;
  lastName: string;
  email: string;
  password?: string;
  role: string | { id?: string; name?: string; code?: string };
  status: 'ACTIVE' | 'LOCKED' | 'DISABLED';
  collectContacts?: boolean;
  branchName?: string;
  branchId?: string;
  teamName?: string;
  isEmailVerified: boolean;
  lastLoginAt: string | null;
  createdAt: string;
}

export interface UserWorkspaceData {
  profile: {
    id: string;
    employeeCode?: string | null;
    firstName: string;
    lastName: string;
    name: string;
    email: string;
    phone?: string | null;
    designation?: string | null;
    department?: string | null;
    status: string;
    companyId: string;
    collectContacts: boolean;
    lastLoginAt?: string | null;
    createdAt: string;
    updatedAt: string;
    role?: {
      id: string;
      name: string;
      code: string;
      type: string;
      description?: string | null;
      permissions: {
        id: string;
        code: string;
        name: string;
        category?: string;
        scope: string;
      }[];
    } | null;
    branch?: {
      id: string;
      code: string;
      name: string;
      city?: string | null;
    } | null;
    team?: {
      id: string;
      name: string;
    } | null;
    agentProfile?: {
      id: string;
      clientCodes: Array<{
        id: string;
        value: string;
        codeSystem: string;
        verificationStatus: string;
        isPrimary: boolean;
      }>;
      agencyName?: string | null;
      licenseNumber?: string | null;
      commissionTier?: string | null;
      isActive: boolean;
    } | null;
  };
  portfolio: {
    leadsCreated: number;
    leadsAssigned: number;
    leadsConverted: number;
    leadsLost: number;
    contactsCreated: number;
    customersCreated: number;
    customersManaged: number;
    policiesIssued: number;
    renewalsPending: number;
    pendingTasks: number;
    overdueTasks: number;
    quotationsCreated?: number;
    quotationsIssued?: number;
    quotationsApproved?: number;
    totalQuotationValue?: number;
    totalIssuedPremium?: number;
  };
  recentActivities: {
    id: string;
    action: string;
    entity: string;
    entityId: string;
    ipAddress?: string | null;
    createdAt: string;
    details?: any;
    source?: string;
  }[];
  recentTasks: {
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate?: string | null;
    createdAt: string;
  }[];
  recentQuotations?: {
    id: string;
    quotationCode: string;
    title?: string;
    customerName: string;
    customerPhone?: string | null;
    insurerName: string;
    productType: string;
    totalPremium: number;
    basePremium?: number;
    status: string;
    issuanceStatus: string;
    policyNumber?: string | null;
    createdAt: string;
  }[];
  recentPolicies?: {
    id: string;
    policyNumber: string;
    customerName: string;
    customerPhone?: string | null;
    insurerName: string;
    productType?: string;
    premiumAmount: number;
    status: string;
    effectiveDate: string;
    expiryDate: string;
    createdAt: string;
  }[];
  recentLeads?: {
    id: string;
    leadCode?: string;
    title?: string;
    customerName: string;
    status: string;
    currentWorkflowStep?: string;
    estimatedPremium?: number;
    createdAt: string;
  }[];
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
  city?: string;
  state?: string;
  managerName?: string;
  staffCount?: number;
  activePolicies?: number;
  monthlyGwp?: number;
  status?: string;
  isActive?: boolean;
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
  timestamp?: string;
  createdAt?: string;
  userEmail?: string;
  userRole?: string;
  module?: string;
  action: string;
  entity?: string;
  entityId: string;
  correlationId?: string;
  beforeState?: Record<string, any>;
  afterState?: Record<string, any>;
  oldValue?: Record<string, any>;
  newValue?: Record<string, any>;
  ipAddress?: string;
  user?: {
    id: string;
    firstName?: string;
    lastName?: string;
    email?: string;
    role?: string;
  };
}

export interface PaginatedAuditResponse {
  data: AuditLogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface HealthStatusItem {
  status: 'ok' | 'error' | 'degraded' | 'down';
  httpStatus?: number;
  clientLatencyMs?: number;
  endpoint?: string;
  timestamp?: string;
  uptime?: number;
  checks?: {
    database?: { status: string; latencyMs?: number };
    redis?: {
      status: string;
      latencyMs?: number;
      configurationState?: 'DISABLED' | 'CONFIGURED' | 'CONFIG_ERROR';
      message?: string;
    };
    outbox?: {
      status: string;
      pendingEvents?: number;
      failedEvents?: number;
      oldestAgeSeconds?: number;
    };
    memory?: { status: string; heapUsedMB?: number; heapLimitMB?: number };
    disk?: {
      status: string;
      freeDiskGB?: number;
      totalDiskGB?: number;
      message?: string;
    };
  };
  info?: {
    database?: { status: string };
    redis?: { status: string };
    storage?: { status: string; provider: string };
    queue?: { status: string; activeJobs: number; waitingJobs: number };
  };
  error?: Record<string, any>;
  details?: Record<string, any>;
}


export interface UserActivityMetrics {
  userId: string;
  userName: string;
  email: string;
  role: string;
  creates: number;
  updates: number;
  deletes: number;
  approvals: number;
  rejections: number;
  logins: number;
  logouts: number;
  totalActions: number;
  lastActive: string | null;
}

export interface AuditSummaryResponse {
  totals: {
    totalEvents: number;
    creates: number;
    updates: number;
    deletes: number;
    approvals: number;
    rejections: number;
    logins: number;
    logouts: number;
  };
  userBreakdown: UserActivityMetrics[];
}

export interface UserSessionItem {
  sessionId: string;
  userId: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  loginTime: string;
  logoutTime: string | null;
  durationMinutes: number | null;
  durationFormatted: string;
  status: 'ENDED' | 'ACTIVE' | 'EXPIRED';
  ipAddress: string | null;
  userAgent: string | null;
}

export interface PaginatedSessionsResponse {
  data: UserSessionItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  disclaimer: string;
}

export interface UserTimelineItem {
  id: string;
  timestamp: string;
  action: string;
  entity: string;
  entityId: string;
  module?: string;
  correlationId?: string;
  ipAddress?: string;
  userAgent?: string;
  description: string;
  user: {
    id: string;
    name: string;
    email: string;
    role: string;
  };
  hasDiff: boolean;
  oldValue?: any;
  newValue?: any;
  metadata?: any;
}

export interface PaginatedTimelineResponse {
  data: UserTimelineItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export const adminRepository = {
  async getDashboardMetrics(): Promise<AdminDashboardMetrics> {
    const response = await apiClient.get('/admin/config/metrics');
    return response.data;
  },

  async getCurrentUser(): Promise<UserItem> {
    const response = await apiClient.get('/users/me');
    return response.data;
  },


  async getUserCommissions(userId: string): Promise<any[]> {
    const response = await apiClient.get(`/admin/users/${userId}/commissions`);
    return Array.isArray(response.data) ? response.data : [];
  },

  async getUserIncentives(userId: string): Promise<any[]> {
    const response = await apiClient.get(`/admin/users/${userId}/incentives`);
    return Array.isArray(response.data) ? response.data : [];
  },

  async getUserWorkspace(id: string): Promise<UserWorkspaceData> {
    const response = await apiClient.get(`/users/${id}/workspace`);
    return response.data;
  },

  async getUsers(params?: { status?: string; role?: string; search?: string; limit?: number; page?: number }): Promise<UserItem[]> {
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

  async updateUser(id: string, data: Partial<UserItem> & { collectContacts?: boolean }): Promise<UserItem> {
    const response = await apiClient.patch(`/users/${id}`, data);
    return response.data;
  },

  async updateUserStatus(id: string, status: string, reason?: string): Promise<UserItem> {
    const dbStatus = status === 'LOCKED' ? 'SUSPENDED' : status === 'DISABLED' ? 'INACTIVE' : status;
    const response = await apiClient.patch(`/users/${id}/status`, { status: dbStatus, reason });
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

  async getRoles(): Promise<any[]> {
    const response = await apiClient.get('/admin/roles');
    return Array.isArray(response.data) ? response.data : (response.data.data || []);
  },

  async getRolePermissions(roleId: string): Promise<any> {
    const response = await apiClient.get(`/admin/roles/${roleId}/permissions`);
    return response.data;
  },

  async updateRolePermissions(roleId: string, permissions: any[]): Promise<any> {
    const response = await apiClient.put(`/admin/roles/${roleId}/permissions`, { permissions });
    return response.data;
  },

  async getBranches(): Promise<BranchItem[]> {
    const response = await apiClient.get('/admin/organization/branches?limit=100');
    return Array.isArray(response.data) ? response.data : (response.data.data || []);
  },

  async getZones(): Promise<any[]> {
    const response = await apiClient.get('/admin/organization/zones');
    return Array.isArray(response.data) ? response.data : (response.data.data || []);
  },

  async createBranch(data: { name: string; code: string; city: string; state?: string; address?: string; zoneId?: string }): Promise<BranchItem> {
    const response = await apiClient.post('/admin/organization/branches', data);
    return response.data;
  },

  async getLookups(type?: string): Promise<LookupItem[]> {
    const response = type ? await apiClient.get(`/admin/lookups/${type}`) : await apiClient.get('/admin/lookups');
    return response.data;
  },

  async createLookupValue(categoryCode: string, data: { code: string; name: string; description?: string }): Promise<any> {
    const response = await apiClient.post(`/admin/lookups/${categoryCode}/values`, data);
    return response.data;
  },

  async updateLookupValue(categoryCode: string, id: string, data: { name?: string; description?: string; isActive?: boolean }): Promise<any> {
    const response = await apiClient.put(`/admin/lookups/${categoryCode}/values/${id}`, data);
    return response.data;
  },

  async deleteLookupValue(categoryCode: string, id: string): Promise<any> {
    const response = await apiClient.delete(`/admin/lookups/${categoryCode}/values/${id}`);
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

  async getAuditLogs(params?: {
    search?: string;
    entity?: string;
    action?: string;
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedAuditResponse> {
    const response = await apiClient.get('/audit', { params });
    if (response.data && response.data.meta && Array.isArray(response.data.data)) {
      return response.data;
    }
    if (Array.isArray(response.data)) {
      return {
        data: response.data,
        meta: {
          page: 1,
          limit: response.data.length,
          total: response.data.length,
          totalPages: 1,
        },
      };
    }
    return {
      data: (response.data as any)?.data || [],
      meta: (response.data as any)?.meta || {
        page: 1,
        limit: 50,
        total: 0,
        totalPages: 1,
      },
    };
  },

  async exportAuditLogs(params?: {
    format?: 'csv' | 'json';
    entity?: string;
    action?: string;
    userId?: string;
    search?: string;
    startDate?: string;
    endDate?: string;
  }): Promise<Blob> {
    const response = await apiClient.get('/audit/export', {
      params: { ...params, format: params?.format || 'csv' },
      responseType: 'blob',
    });
    return response.data;
  },

  async getAuditSummary(params?: {
    startDate?: string;
    endDate?: string;
  }): Promise<AuditSummaryResponse> {
    const response = await apiClient.get('/audit/summary', { params });
    return response.data;
  },

  async getUserSessions(params?: {
    userId?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedSessionsResponse> {
    const response = await apiClient.get('/audit/sessions', { params });
    return response.data;
  },

  async getActivityTimeline(params?: {
    userId?: string;
    action?: string;
    entity?: string;
    startDate?: string;
    endDate?: string;
    page?: number;
    limit?: number;
  }): Promise<PaginatedTimelineResponse> {
    const response = await apiClient.get('/audit/timeline', { params });
    return response.data;
  },

  async getSystemHealth(): Promise<HealthStatusItem> {
    const startTime = Date.now();
    try {
      const response = await apiClient.get('/health');
      const clientLatencyMs = Date.now() - startTime;
      return {
        ...response.data,
        httpStatus: response.status,
        clientLatencyMs,
        endpoint: '/health',
      };
    } catch (err: any) {
      const clientLatencyMs = Date.now() - startTime;
      const httpStatus = err?.response?.status || 503;
      const data = err?.response?.data || {};
      return {
        status: 'down',
        ...data,
        httpStatus,
        clientLatencyMs,
        endpoint: '/health',
        error: { message: err?.message || 'Failed to reach health endpoint' },
      };
    }
  },
};
