'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { quotationsRepository } from '../repositories/quotations.repository';
import { PaginationParams } from '../types';
import { toast } from 'sonner';

export function useQuotations(params?: PaginationParams & { status?: string }) {
  const query = useQuery({
    queryKey: ['quotations', params],
    queryFn: () => quotationsRepository.getQuotations(params),
  });

  return {
    quotations: query.data?.data || [],
    total: query.data?.total || 0,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}

export function useQuotationWorkspace(id: string) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['quotation-workspace', id],
    queryFn: () => quotationsRepository.getQuotationById(id),
    enabled: !!id,
  });

  const convertMutation = useMutation({
    mutationFn: (quoteId: string) => quotationsRepository.convertQuotation(quoteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Quotation converted to Proposal successfully');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to convert quotation');
    },
  });

  return {
    quotation: query.data,
    isLoading: query.isLoading,
    isError: query.isError,
    convertQuotation: convertMutation.mutate,
    isConverting: convertMutation.isPending,
  };
}
