'use client';

import React, { useState } from 'react';
import { useRouter as useNav } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { Users, Plus, Building2, User, Loader2, X, AlertCircle } from 'lucide-react';
import { useCustomers } from '../../../hooks/useCustomer360';
import { customerRepository } from '../../../repositories/customer.repository';
import { toast } from 'sonner';

export default function CustomerRegisterPage() {
  const router = useNav();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const limit = 25;

  const { customers, total, totalPages, isLoading, isError, refetch } = useCustomers({ page, limit, search: search.trim() || undefined, sortBy: 'createdAt', sortOrder: 'desc' });
  const [formData, setFormData] = useState({ firstName: '', lastName: '', type: 'INDIVIDUAL', phone: '', email: '' });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!formData.firstName.trim() || !formData.lastName.trim()) return void toast.error('First name and last name are required');
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) return void toast.error('Enter a valid 10-digit Indian mobile number');
    setIsSubmitting(true);
    try {
      await customerRepository.createContact({ type: formData.type as 'INDIVIDUAL' | 'CORPORATE', firstName: formData.firstName.trim(), lastName: formData.lastName.trim(), phone: cleanPhone, email: formData.email.trim() || undefined });
      await refetch();
      toast.success(`Customer "${formData.firstName} ${formData.lastName}" registered successfully`);
      setShowAddModal(false); setPage(1); setFormData({ firstName: '', lastName: '', type: 'INDIVIDUAL', phone: '', email: '' });
    } catch (err: any) {
      const error = err?.response?.data?.error || err?.response?.data;
      toast.error(error?.code === 'DUPLICATE_CONTACT' ? `Duplicate contact found (${error.matchedBy?.toLowerCase() || 'identity'})` : error?.message || err?.message || 'Failed to register customer');
    } finally { setIsSubmitting(false); }
  };

  const columns = [
    { accessorKey: 'name', header: 'Customer Name', cell: ({ row }: any) => <div onClick={() => router.push(`/crm/contacts/${row.original.id}`)} className="cursor-pointer hover:text-primary font-bold flex items-center space-x-2">{row.original.type === 'CORPORATE' ? <Building2 className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-muted-foreground" />}<span>{`${row.original.firstName || ''} ${row.original.lastName || ''}`.trim()}</span></div> },
    { accessorKey: 'id', header: 'Customer ID' }, { accessorKey: 'type', header: 'Type' }, { accessorKey: 'phone', header: 'Phone' }, { accessorKey: 'email', header: 'Email' },
    { accessorKey: 'branch', header: 'Branch', cell: ({ row }: any) => row.original.branch?.name || (row.original.branchId ? row.original.branchId : '—') },
    { accessorKey: 'status', header: 'Status', cell: ({ row }: any) => row.original.status ? <span className="font-semibold">{row.original.status}</span> : <span className="text-muted-foreground">Not provided</span> },
  ];

  return (
    <AppShell>
      <div className="flex justify-between items-center"><div><h1 className="text-xl font-bold tracking-tight flex items-center gap-2"><Users className="h-5 w-5 text-primary" /> Customer Directory & Register</h1><p className="text-xs text-muted-foreground">Authoritative contacts from the server-side CRM register</p></div><button onClick={() => setShowAddModal(true)} className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow"><Plus className="h-4 w-4" /><span>+ Add New Customer</span></button></div>
      {showAddModal && <div className="p-5 rounded-2xl border bg-card shadow-lg space-y-4 text-xs"><div className="flex justify-between items-center border-b pb-3"><h3 className="font-bold text-sm flex items-center gap-2"><User className="h-4 w-4 text-primary" /> Register New Customer</h3><button onClick={() => setShowAddModal(false)} className="p-1 rounded hover:bg-accent"><X className="h-4 w-4" /></button></div><form onSubmit={handleSubmit} className="space-y-4"><div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"><div><label className="font-bold text-muted-foreground block mb-1">First Name *</label><input required value={formData.firstName} onChange={(e) => setFormData({ ...formData, firstName: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background text-xs" /></div><div><label className="font-bold text-muted-foreground block mb-1">Last Name *</label><input required value={formData.lastName} onChange={(e) => setFormData({ ...formData, lastName: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background text-xs" /></div><div><label className="font-bold text-muted-foreground block mb-1">Account Type</label><select value={formData.type} onChange={(e) => setFormData({ ...formData, type: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background text-xs"><option value="INDIVIDUAL">INDIVIDUAL</option><option value="CORPORATE">CORPORATE</option></select></div><div><label className="font-bold text-muted-foreground block mb-1">Phone Number *</label><input required inputMode="numeric" value={formData.phone} onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })} placeholder="9876543210" className="w-full p-2.5 rounded-lg border bg-background text-xs" /></div><div><label className="font-bold text-muted-foreground block mb-1">Email Address</label><input type="email" value={formData.email} onChange={(e) => setFormData({ ...formData, email: e.target.value })} className="w-full p-2.5 rounded-lg border bg-background text-xs" /></div></div><p className="text-[11px] text-muted-foreground border rounded-lg p-3">Branch and owner are determined by authenticated organizational context. They are not accepted as arbitrary client-controlled strings.</p><div className="flex justify-end space-x-2 pt-2 border-t"><button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg border">Cancel</button><button type="submit" disabled={isSubmitting} className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold flex items-center">{isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}{isSubmitting ? 'Registering...' : 'Register Customer'}</button></div></form></div>}
      {isError && <div className="p-3 border border-destructive/30 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2"><AlertCircle className="h-4 w-4" />Failed to load contacts from the server. <button onClick={() => refetch()} className="underline font-bold">Retry</button></div>}
      {isLoading ? <div className="p-10 flex justify-center"><Loader2 className="h-5 w-5 animate-spin" /></div> : <EnterpriseTable data={customers} columns={columns} totalRows={total} pageSize={limit} pageIndex={page - 1} pageCount={totalPages} manualPagination manualFiltering searchValue={search} onSearchChange={(value) => { setSearch(value); setPage(1); }} onPageChange={(nextPage) => setPage(nextPage + 1)} />}
    </AppShell>
  );
}
