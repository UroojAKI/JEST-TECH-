'use client';

import { useQuery } from '@tanstack/react-query';
import { customerRepository } from '../repositories/customer.repository';
import { PaginationParams } from '../types';

export function useCustomerWorkspace(id: string) {
  const query = useQuery({
    queryKey: ['customer-workspace', id],
    queryFn: () => customerRepository.getCustomerWorkspace(id),
    enabled: !!id,
    staleTime: 30000,
  });

  return {
    workspace: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}

export function useCustomers(params?: PaginationParams & { tag?: string }) {
  const query = useQuery({
    queryKey: ['customers', params],
    queryFn: () => customerRepository.getContacts(params),
  });

  return {
    customers: query.data?.data || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
