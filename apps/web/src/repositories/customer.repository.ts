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
  agent?: string | null;
  agentCode?: string | null;
  tags?: string[];
  status?: string;
  createdAt: string;
}

export interface Customer {
  id: string;
  customerCode: string;
  firstName: string;
  lastName?: string | null;
  mobile: string;
  email?: string | null;
  panNumber?: string | null;
  aadhaarNumber?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  pincode?: string | null;
  isVip: boolean;
  contactId?: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: {
    leads: number;
    policies: number;
    vehicles: number;
    quotations: number;
    claims: number;
    tasks?: number;
    alerts?: number;
  };
  leads?: any[];
  vehicles?: any[];
  quotations?: any[];
  policies?: any[];
  claims?: any[];
  tasks?: any[];
  alerts?: any[];
}

export interface DuplicateCheckResult {
  hasDuplicate: boolean;
  matchCount: number;
  matches: Array<{
    id: string;
    customerCode: string;
    firstName: string;
    lastName: string | null;
    mobile: string;
    email: string | null;
    city?: string | null;
    state?: string | null;
    isVip: boolean;
    activeLeadsCount: number;
    activePoliciesCount: number;
    vehiclesCount: number;
    createdAt: string;
  }>;
}

export const customerRepository = {
  // ── First-Class Customer Entity APIs ──
  async getCustomers(params?: PaginationParams & { isVip?: boolean; mobile?: string; email?: string }): Promise<PaginatedResult<Customer>> {
    const response = await apiClient.get('/customers', { params });
    return response.data;
  },

  async getCustomerById(id: string): Promise<Customer> {
    const response = await apiClient.get(`/customers/${id}`);
    return response.data;
  },

  async checkDuplicate(params: { mobile?: string; email?: string }): Promise<DuplicateCheckResult> {
    const response = await apiClient.get('/customers/check-duplicate', { params });
    return response.data;
  },

  async createCustomer(data: Partial<Customer> & { acknowledgeDuplicate?: boolean }): Promise<{ duplicateWarning: boolean; message?: string; matches?: any[]; customer?: Customer }> {
    const response = await apiClient.post('/customers', data);
    return response.data;
  },

  async updateCustomer(id: string, data: Partial<Customer>): Promise<Customer> {
    const response = await apiClient.patch(`/customers/${id}`, data);
    return response.data;
  },

  async getCustomerAlerts(id: string): Promise<any[]> {
    const response = await apiClient.get(`/customers/${id}/alerts`);
    return response.data;
  },

  async markAlertRead(customerId: string, alertId: string): Promise<any> {
    const response = await apiClient.patch(`/customers/${customerId}/alerts/${alertId}/read`);
    return response.data;
  },

  // ── Legacy Contact Compatibility APIs ──
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

