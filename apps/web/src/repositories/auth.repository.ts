import { apiClient } from '../lib/api-client';
import { UserSession } from '../types';

export const authRepository = {
  async login(credentials: { email: string; password: string }): Promise<{
    user: UserSession;
    expiresIn: number | string;
    workspaces?: string[];
    landingWorkspace?: string;
  }> {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data?.data || response.data;
  },

  async refresh(): Promise<{
    success: boolean;
    expiresIn: number | string;
    user?: UserSession;
    workspaces?: string[];
    landingWorkspace?: string;
  }> {
    const response = await apiClient.post('/auth/refresh');
    return response.data?.data || response.data;
  },

  async logout(): Promise<{ success: boolean }> {
    const response = await apiClient.post('/auth/logout');
    return response.data?.data || response.data;
  },
};
