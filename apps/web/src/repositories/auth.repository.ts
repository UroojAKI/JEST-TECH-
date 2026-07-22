import { apiClient } from '../lib/api-client';
import { UserSession } from '../types';

export const authRepository = {
  async login(credentials: { email: string; password: string }): Promise<{ user: UserSession; expiresIn: number }> {
    const response = await apiClient.post('/auth/login', credentials);
    return response.data;
  },

  async refresh(): Promise<{ success: boolean; expiresIn: number }> {
    const response = await apiClient.post('/auth/refresh');
    return response.data;
  },

  async logout(): Promise<{ success: boolean }> {
    const response = await apiClient.post('/auth/logout');
    return response.data;
  },
};
