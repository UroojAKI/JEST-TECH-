import { apiClient } from '../lib/api-client';

export interface WorkflowDefinition {
  id: string;
  name: string;
  module: 'LEADS' | 'PROPOSALS' | 'POLICIES' | 'CLAIMS' | 'ENDORSEMENTS' | 'RENEWALS' | 'FINANCE';
  version: number;
  isActive: boolean;
  states: {
    id: string;
    name: string;
    assignedRole: string;
    currentQueueCount: number;
    avgTimeSpent: string;
    slaHours: number;
    escalatesTo: string;
  }[];
  transitions: {
    id: string;
    fromState: string;
    toState: string;
    name: string;
    allowedRoles: string[];
    slaHours?: number;
  }[];
}

export interface WorkflowInstance {
  id: string;
  workflowId: string;
  workflowName: string;
  entityType: string;
  entityId: string;
  entityNumber: string;
  customerName: string;
  currentState: string;
  previousStates: string[];
  assignedApprover: string;
  slaDueDate: string;
  isOverdue: boolean;
  timeSpent: string;
  createdAt: string;
  timeline: {
    state: string;
    action: string;
    performedBy: string;
    timestamp: string;
    comments?: string;
  }[];
}

export interface ApprovalItem {
  id: string;
  instanceId: string;
  module: string;
  entityNumber: string;
  title: string;
  requestorName: string;
  customerName: string;
  amount?: number;
  currentState: string;
  slaDueDate: string;
  isOverdue: boolean;
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  createdAt: string;
}

export interface SlaMetrics {
  approvalsDueToday: number;
  overdueApprovals: number;
  escalatedCount: number;
  avgApprovalDurationHours: number;
  fastestDepartment: string;
  slowestDepartment: string;
  bottleneckStage: string;
}

export const workflowsRepository = {
  async getWorkflows(): Promise<WorkflowDefinition[]> {
    const response = await apiClient.get('/workflow');
    return response.data;
  },

  async getWorkflowInstances(): Promise<WorkflowInstance[]> {
    const response = await apiClient.get('/workflow/instances');
    return response.data;
  },

  async getApprovals(params?: { status?: string; module?: string }): Promise<ApprovalItem[]> {
    const response = await apiClient.get('/workflow/approvals', { params });
    return response.data;
  },

  async executeApprovalAction(id: string, action: 'APPROVE' | 'REJECT' | 'REQUEST_CHANGES' | 'ESCALATE', comments?: string): Promise<any> {
    const response = await apiClient.post(`/workflow/approvals/${id}/action`, { action, comments });
    return response.data;
  },

  async bulkApprovalActions(ids: string[], action: 'APPROVE' | 'REJECT' | 'ESCALATE'): Promise<any> {
    const response = await apiClient.post('/workflow/approvals/bulk', { ids, action });
    return response.data;
  },

  async getSlaMetrics(): Promise<SlaMetrics> {
    const response = await apiClient.get('/workflow/sla/metrics');
    return response.data;
  },
};
