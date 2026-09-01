'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { Building2, Plus, X, Loader2, AlertCircle } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { accountRepository, AccountRecord } from '../../../repositories/account.repository';
import { toast } from 'sonner';

export default function CorporateAccountsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [form, setForm] = useState({ name: '', type: 'CORPORATE', industry: '', email: '', phone: '' });
  const limit = 25;

  const accountsQuery = useQuery({
    queryKey: ['accounts', page, search],
    queryFn: () => accountRepository.getAccounts({ page, limit, search: search.trim() || undefined, sortBy: 'createdAt', sortOrder: 'desc' }),
  });

  const raw: any = accountsQuery.data;
  const accounts: AccountRecord[] = Array.isArray(raw) ? raw : (raw?.data || raw?.items || []);
  const total = Array.isArray(raw) ? accounts.length : Number(raw?.total ?? accounts.length);
  const totalPages = Array.isArray(raw) ? 1 : Number(raw?.totalPages ?? Math.max(1, Math.ceil(total / limit)));

  const createMutation = useMutation({
    mutationFn: accountRepository.createAccount,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['accounts'] });
      setIsModalOpen(false);
      setPage(1);
      setForm({ name: '', type: 'CORPORATE', industry: '', email: '', phone: '' });
      toast.success('Corporate account created successfully');
    },
    onError: (err: any) => toast.error(err?.response?.data?.message || 'Failed to create account'),
  });

  const columns = [
    { accessorKey: 'name', header: 'Account Name', cell: ({ row }: any) => <div className="font-bold flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" /><span>{row.original.name}</span></div> },
    { accessorKey: 'accountCode', header: 'Account ID' },
    { accessorKey: 'industry', header: 'Industry', cell: ({ row }: any) => row.original.industry || '—' },
    { accessorKey: 'employeeCount', header: 'Employees', cell: ({ row }: any) => typeof row.original.employeeCount === 'number' ? row.original.employeeCount.toLocaleString('en-IN') : '—' },
    { accessorKey: 'annualRevenue', header: 'Annual Revenue', cell: ({ row }: any) => typeof row.original.annualRevenue === 'number' ? `₹${row.original.annualRevenue.toLocaleString('en-IN')}` : '—' },
    { accessorKey: 'kycStatus', header: 'KYC' },
    { accessorKey: 'status', header: 'Status', cell: ({ row }: any) => row.original.status ? 'ACTIVE' : 'INACTIVE' },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return void toast.error('Account name is required');
    createMutation.mutate({ name: form.name.trim(), type: form.type as any, industry: form.industry.trim() || null, email: form.email.trim() || null, phone: form.phone.trim() || null });
  };

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div><h1 className="text-xl font-bold tracking-tight flex items-center gap-2"><Building2 className="h-5 w-5 text-primary" /> Corporate Accounts Register</h1><p className="text-xs text-muted-foreground">Live accounts from the authoritative API</p></div>
        <button onClick={() => setIsModalOpen(true)} className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground shadow"><Plus className="h-4 w-4" />Add Account</button>
      </div>

      {accountsQuery.isError && <div className="p-3 border border-destructive/30 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2"><AlertCircle className="h-4 w-4" />Failed to load accounts. <button onClick={() => accountsQuery.refetch()} className="underline font-bold">Retry</button></div>}
      {accountsQuery.isLoading ? <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : <EnterpriseTable data={accounts} columns={columns} totalRows={total} pageSize={limit} pageIndex={page - 1} pageCount={totalPages} manualPagination manualFiltering searchValue={search} onSearchChange={(value) => { setSearch(value); setPage(1); }} onPageChange={(nextPage) => setPage(nextPage + 1)} />}

      {isModalOpen && <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4"><div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl text-xs"><div className="p-4 border-b flex justify-between items-center"><h2 className="font-bold text-sm flex items-center gap-2"><Building2 className="h-4 w-4 text-primary" />Create Corporate Account</h2><button onClick={() => setIsModalOpen(false)}><X className="h-4 w-4" /></button></div><form onSubmit={handleSubmit} className="p-5 space-y-3"><div><label className="font-bold block mb-1">Account Name *</label><input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background" /></div><div><label className="font-bold block mb-1">Industry</label><input value={form.industry} onChange={(e) => setForm({ ...form, industry: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background" /></div><div><label className="font-bold block mb-1">Email</label><input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background" /></div><div><label className="font-bold block mb-1">Phone</label><input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background" /></div><div className="flex justify-end gap-2 pt-3 border-t"><button type="button" onClick={() => setIsModalOpen(false)} className="px-4 py-2 rounded-lg border">Cancel</button><button type="submit" disabled={createMutation.isPending} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold flex items-center">{createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}{createMutation.isPending ? 'Creating...' : 'Create Account'}</button></div></form></div></div>}
    </AppShell>
  );
}
