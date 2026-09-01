import { apiClient } from '../lib/api-client';
import { PaginatedResult, PaginationParams } from '../types';

export interface AccountRecord {
  id: string;
  accountCode: string;
  name: string;
  type: 'INDIVIDUAL' | 'CORPORATE' | 'SME' | 'ENTERPRISE' | 'GOVERNMENT';
  industry: string | null;
  website: string | null;
  email: string | null;
  phone: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  annualRevenue: number | null;
  employeeCount: number | null;
  description: string | null;
  status: boolean;
  kycStatus: string;
  createdAt: string;
  updatedAt: string;
}

export const accountRepository = {
  async getAccounts(params: PaginationParams): Promise<PaginatedResult<AccountRecord>> {
    const response = await apiClient.get('/accounts', { params });
    return response.data;
  },

  async createAccount(data: Partial<AccountRecord>): Promise<AccountRecord> {
    const response = await apiClient.post('/accounts', data);
    return response.data;
  },
};
