'use client';

import { useQuery } from '@tanstack/react-query';
import { customerRepository } from '../repositories/customer.repository';
import { PaginationParams } from '../types';

export function useCustomerWorkspace(id: string) {
  const query = useQuery({ queryKey: ['customer-workspace', id], queryFn: () => customerRepository.getCustomerWorkspace(id), enabled: !!id, staleTime: 30000 });
  return { workspace: query.data, isLoading: query.isLoading, isError: query.isError, refetch: query.refetch };
}

export function useCustomers(params?: PaginationParams & { tag?: string }) {
  const query = useQuery({ queryKey: ['customers', params], queryFn: () => customerRepository.getContacts(params) });
  const raw: any = query.data;
  const list = Array.isArray(raw) ? raw : (raw?.data || raw?.items || []);
  const total = Array.isArray(raw) ? raw.length : Number(raw?.total ?? list.length);
  const page = Array.isArray(raw) ? 1 : Number(raw?.page ?? params?.page ?? 1);
  const limit = Array.isArray(raw) ? list.length || 1 : Number(raw?.limit ?? params?.limit ?? 25);
  const totalPages = Array.isArray(raw) ? 1 : Number(raw?.totalPages ?? Math.max(1, Math.ceil(total / limit)));

  return {
    customers: list,
    total,
    page,
    limit,
    totalPages,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
