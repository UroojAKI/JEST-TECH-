'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { financeRepository } from '../repositories/finance.repository';
import { toast } from 'sonner';

export function useFinanceDashboard() {
  return useQuery({
    queryKey: ['finance-dashboard'],
    queryFn: () => financeRepository.getDashboardMetrics(),
  });
}

export function useReceipts(status?: string) {
  return useQuery({
    queryKey: ['finance-receipts', status],
    queryFn: () => financeRepository.getReceipts(status),
  });
}

export function usePayments(type?: string) {
  return useQuery({
    queryKey: ['finance-payments', type],
    queryFn: () => financeRepository.getPayments(type),
  });
}

export function useLedgerEntries() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['finance-ledger'],
    queryFn: () => financeRepository.getLedgerEntries(),
  });

  const postJournalMutation = useMutation({
    mutationFn: (data: any) => financeRepository.postJournalEntry(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-ledger'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      toast.success('Journal entry posted successfully!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to post journal entry');
    },
  });

  return {
    ledgerEntries: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    postJournalEntry: postJournalMutation.mutate,
    isPosting: postJournalMutation.isPending,
  };
}

export function useCommissions() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['finance-commissions'],
    queryFn: () => financeRepository.getCommissions(),
  });

  const approveMutation = useMutation({
    mutationFn: (id: string) => financeRepository.approveCommission(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-commissions'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      toast.success('Commission payout approved!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to approve commission');
    },
  });

  return {
    commissions: query.data || [],
    isLoading: query.isLoading,
    isError: query.isError,
    approveCommission: approveMutation.mutate,
    isApproving: approveMutation.isPending,
  };
}

export function useSettlements() {
  return useQuery({
    queryKey: ['finance-settlements'],
    queryFn: () => financeRepository.getSettlements(),
  });
}

export function useIncentives() {
  return useQuery({
    queryKey: ['finance-incentives'],
    queryFn: () => financeRepository.getIncentives(),
  });
}
