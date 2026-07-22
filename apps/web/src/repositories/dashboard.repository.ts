import { apiClient } from '../lib/api-client';
import { DashboardFilterParams } from '../types/dashboard';

export const dashboardRepository = {
  async getDashboardData(params?: DashboardFilterParams): Promise<any> {
    const response = await apiClient.get('/dashboard', { params });
    return response.data;
  },

  async getSuperAdminDashboard(params?: DashboardFilterParams): Promise<any> {
    const response = await apiClient.get('/dashboard/super-admin', { params });
    return response.data;
  },

  async getAdminDashboard(params?: DashboardFilterParams): Promise<any> {
    const response = await apiClient.get('/dashboard/admin', { params });
    return response.data;
  },

  async getManagerDashboard(params?: DashboardFilterParams): Promise<any> {
    const response = await apiClient.get('/dashboard/manager', { params });
    return response.data;
  },

  async getAgentDashboard(params?: DashboardFilterParams): Promise<any> {
    const response = await apiClient.get('/dashboard/agent', { params });
    return response.data;
  },

  async getCustomer360(customerId: string): Promise<any> {
    const response = await apiClient.get(`/customer-360/${customerId}`);
    return response.data;
  },
};
