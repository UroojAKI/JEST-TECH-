import { apiClient } from '../lib/api-client';
import { DepartmentItem, JobRoleItem } from '../types';

export const organizationRepository = {
  async getDepartments(): Promise<DepartmentItem[]> {
    const response = await apiClient.get('/organization/departments');
    return response.data;
  },

  async getJobRoles(): Promise<JobRoleItem[]> {
    const response = await apiClient.get('/organization/job-roles');
    return response.data;
  },

  async getHierarchy(): Promise<any[]> {
    const response = await apiClient.get('/organization/hierarchy');
    return response.data;
  },

  async createDepartment(data: Partial<DepartmentItem>): Promise<DepartmentItem> {
    const response = await apiClient.post('/organization/departments', data);
    return response.data;
  },

  async createJobRole(data: Partial<JobRoleItem>): Promise<JobRoleItem> {
    const response = await apiClient.post('/organization/job-role', data);
    return response.data;
  },
};
