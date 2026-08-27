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

export function useLedgerEntries(params?: { search?: string; referenceType?: string; page?: number }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['finance-ledger', params],
    queryFn: () => financeRepository.getLedgerEntries(params),
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

  const raw = query.data;
  const entries = Array.isArray(raw) ? raw : raw?.data || [];
  const meta = raw?.meta || { total: entries.length };

  return {
    ledgerEntries: entries,
    meta,
    isLoading: query.isLoading,
    isError: query.isError,
    postJournalEntry: postJournalMutation.mutateAsync,
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

export function useReconciliationQueue(params?: { status?: string; search?: string; page?: number; limit?: number }) {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ['finance-reconciliation-queue', params],
    queryFn: () => financeRepository.getReconciliationQueue(params),
  });

  const reconcileMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      financeRepository.reconcilePayment(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-reconciliation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      toast.success('Payment successfully reconciled with bank statement!');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to reconcile payment');
    },
  });

  const discrepancyMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      financeRepository.flagDiscrepancy(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['finance-reconciliation-queue'] });
      queryClient.invalidateQueries({ queryKey: ['finance-dashboard'] });
      toast.success('Discrepancy flagged and recorded.');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to flag discrepancy');
    },
  });

  return {
    data: query.data?.data || [],
    meta: query.data?.meta,
    summary: query.data?.summary,
    isLoading: query.isLoading,
    isError: query.isError,
    reconcilePayment: reconcileMutation.mutate,
    isReconciling: reconcileMutation.isPending,
    flagDiscrepancy: discrepancyMutation.mutate,
    isFlagging: discrepancyMutation.isPending,
  };
}
