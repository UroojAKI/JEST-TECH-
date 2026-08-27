import { apiClient } from '../lib/api-client';
import { WorkspaceData, NavigationItem } from '../types';

export const workspaceRepository = {
  async getWorkspace(): Promise<WorkspaceData> {
    const response = await apiClient.get('/workspace');
    return response.data;
  },

  async getNavigation(): Promise<NavigationItem[]> {
    const response = await apiClient.get('/workspace/navigation');
    return response.data;
  },

  async getWidgets(): Promise<any[]> {
    const response = await apiClient.get('/workspace/widgets');
    return response.data;
  },

  async getDashboard(): Promise<any> {
    const response = await apiClient.get('/workspace/dashboard');
    return response.data;
  },

  async getProfile(): Promise<any> {
    const response = await apiClient.get('/workspace/profile');
    return response.data;
  },

  async getUserWorkspaces(): Promise<Array<{ code: string; title: string; href: string; icon: string; description: string }>> {
    const response = await apiClient.get('/workspace/user-workspaces');
    return response.data;
  },
};
