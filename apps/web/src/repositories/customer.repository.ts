import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface CustomerContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  type: 'INDIVIDUAL' | 'CORPORATE';
  panNumber?: string;
  aadhaarNumber?: string;
  gstNumber?: string;
  branchId?: string;
  assignedAgentId?: string;
  tags?: string[];
  createdAt: string;
}

export const customerRepository = {
  async getContacts(params?: PaginationParams & { tag?: string }): Promise<PaginatedResult<CustomerContact>> {
    const response = await apiClient.get('/contacts', { params });
    return response.data;
  },

  async getContactById(id: string): Promise<CustomerContact> {
    const response = await apiClient.get(`/contacts/${id}`);
    return response.data;
  },

  async getCustomerWorkspace(id: string): Promise<any> {
    const response = await apiClient.get(`/customer-360/${id}`);
    return response.data;
  },

  async createContact(data: Partial<CustomerContact>): Promise<CustomerContact> {
    const response = await apiClient.post('/contacts', data);
    return response.data;
  },
};
