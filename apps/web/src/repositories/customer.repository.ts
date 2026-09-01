import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface CustomerContact {
  id: string;
  firstName: string;
  lastName: string;
  email: string | null;
  phone: string;
  type: 'INDIVIDUAL' | 'CORPORATE';
  panNumber?: string | null;
  aadhaarNumber?: string | null;
  gstNumber?: string | null;
  branchId?: string | null;
  branch?: { id: string; name: string; code?: string } | null;
  assignedAgentId?: string | null;
  tags?: string[];
  status?: string;
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
