import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface TaskItem {
  id: string;
  taskCode: string;
  title: string;
  description?: string | null;
  type: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  dueDate?: string | null;
  completedAt?: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string; email: string } | null;
  customer?: { id: string; customerCode: string; firstName: string; lastName?: string; mobile: string } | null;
  lead?: { id: string; leadCode: string; title: string; status: string } | null;
  vehicle?: { id: string; registrationNumber: string; category: string } | null;
  createdAt: string;
}

export interface TodayTasksSummary {
  dueTodayCount: number;
  overdueCount: number;
  completedTodayCount: number;
  tasksToday: TaskItem[];
  overdueTasks: TaskItem[];
}

export interface BackOfficeQueueItem {
  id: string;
  taskCode: string;
  taskType: string;
  priority: 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
  status: 'PENDING' | 'IN_REVIEW' | 'VERIFIED' | 'REJECTED' | 'COMPLETED';
  verificationNotes?: string | null;
  rejectedReason?: string | null;
  resolvedAt?: string | null;
  assignedTo?: { id: string; firstName: string; lastName: string; email: string } | null;
  lead?: {
    id: string;
    leadCode: string;
    title: string;
    status: string;
    customer?: { id: string; customerCode: string; firstName: string; lastName?: string; mobile: string };
    agent?: { id: string; agentCode: string; agencyName?: string };
  };
  motorQuotation?: {
    id: string;
    quotationNumber: string;
    insurerName: string;
    planName?: string;
    finalPremium: number;
    vehicle?: { id: string; registrationNumber: string; make?: string; model?: string };
  };
  createdAt: string;
}

export const taskRepository = {
  async getTasksToday(): Promise<TodayTasksSummary> {
    const response = await apiClient.get('/tasks/today');
    return response.data;
  },

  async getTasks(params?: PaginationParams & { status?: string; priority?: string; type?: string; assignedToId?: string; customerId?: string }): Promise<PaginatedResult<TaskItem>> {
    const response = await apiClient.get('/tasks', { params });
    return response.data;
  },

  async getTaskById(id: string): Promise<TaskItem> {
    const response = await apiClient.get(`/tasks/${id}`);
    return response.data;
  },

  async createTask(data: Partial<TaskItem>): Promise<TaskItem> {
    const response = await apiClient.post('/tasks', data);
    return response.data;
  },

  async updateTask(id: string, data: Partial<TaskItem>): Promise<TaskItem> {
    const response = await apiClient.patch(`/tasks/${id}`, data);
    return response.data;
  },

  async completeTask(id: string): Promise<TaskItem> {
    const response = await apiClient.patch(`/tasks/${id}/complete`);
    return response.data;
  },

  // ?? Back Office Queue ??
  async getBackOfficeQueue(params?: { status?: string; assignedToId?: string }): Promise<{ total: number; queue: BackOfficeQueueItem[] }> {
    const response = await apiClient.get('/tasks/back-office/queue', { params });
    return response.data;
  },

  async getBackOfficeTaskById(id: string): Promise<BackOfficeQueueItem> {
    const response = await apiClient.get(`/tasks/back-office/${id}`);
    return response.data;
  },

  async assignBackOfficeTask(id: string, assignedToId: string): Promise<BackOfficeQueueItem> {
    const response = await apiClient.patch(`/tasks/back-office/${id}/assign`, { assignedToId });
    return response.data;
  },

  async resolveBackOfficeTask(id: string, data: { status: string; verificationNotes?: string; rejectedReason?: string }): Promise<BackOfficeQueueItem> {
    const response = await apiClient.patch(`/tasks/back-office/${id}/resolve`, data);
    return response.data;
  },
};
