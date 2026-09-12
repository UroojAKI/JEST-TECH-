'use client';

import React, { useEffect, useState } from 'react';
import { useRouter as useNav, useSearchParams } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { Users, Plus, Building2, User, Loader2, X, AlertCircle, ShieldCheck } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useCustomers } from '../../../hooks/useCustomer360';
import { customerRepository } from '../../../repositories/customer.repository';
import { adminRepository } from '../../../repositories/admin.repository';
import { toast } from 'sonner';

export default function CustomerRegisterPage() {
  const router = useNav();
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState('');

  const { data: dbBranches = [] } = useQuery({
    queryKey: ['branches-list'],
    queryFn: () => adminRepository.getBranches(),
    staleTime: 5 * 60 * 1000,
  });

  const { data: dbUsers = [] } = useQuery({
    queryKey: ['users-list-contacts'],
    queryFn: () => adminRepository.getUsers(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (searchParams.get('create') === '1') setShowAddModal(true);
  }, [searchParams]);

  const { customers, total, totalPages, isLoading, isError, refetch } = useCustomers({
    page,
    limit,
    search: search.trim() || undefined,
    sortBy: 'createdAt',
    sortOrder: 'desc',
  });

  const [duplicateDialog, setDuplicateDialog] = useState<{
    isOpen: boolean;
    existingContactId: string;
    matchedBy: string;
    contactCode?: string;
    customerName?: string;
  } | null>(null);

  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    type: 'INDIVIDUAL',
    phone: '',
    email: '',
    branchId: '',
    agentCode: '',
  });

  // Default to primary branch once branches load
  useEffect(() => {
    if (dbBranches.length > 0 && !formData.branchId) {
      setFormData((prev) => ({ ...prev, branchId: dbBranches[0].id }));
    }
  }, [dbBranches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = formData.phone.replace(/\D/g, '');
    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      return void toast.error('First name and last name are required');
    }
    if (!/^[6-9]\d{9}$/.test(cleanPhone)) {
      return void toast.error('Enter a valid 10-digit Indian mobile number');
    }
    setIsSubmitting(true);
    try {
      await customerRepository.createContact({
        type: formData.type as 'INDIVIDUAL' | 'CORPORATE',
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        phone: cleanPhone,
        email: formData.email.trim() || undefined,
        branchId: formData.branchId || undefined,
        agentCode: formData.agentCode.trim() || undefined,
      } as any);
      await refetch();
      toast.success(`Customer "${formData.firstName} ${formData.lastName}" registered successfully`);
      setShowAddModal(false);
      setPage(1);
      setFormData({
        firstName: '',
        lastName: '',
        type: 'INDIVIDUAL',
        phone: '',
        email: '',
        branchId: dbBranches[0]?.id || '',
        agentCode: '',
      });
      router.replace('/crm/contacts');
    } catch (err: any) {
      const errData = err?.response?.data?.error || err?.response?.data;
      if (err?.response?.status === 409 || errData?.code === 'DUPLICATE_CONTACT') {
        setShowAddModal(false);
        setDuplicateDialog({
          isOpen: true,
          existingContactId: errData?.existingContactId || '',
          matchedBy: errData?.matchedBy || (errData?.message?.toLowerCase().includes('email') ? 'EMAIL' : 'PHONE'),
          contactCode: errData?.contactCode || 'CONT-EXISTING',
          customerName: errData?.customerName || `${formData.firstName} ${formData.lastName}`.trim(),
        });
        return;
      }
      toast.error(errData?.message || err?.message || 'Failed to register customer');
    } finally {
      setIsSubmitting(false);
    }
  };

  const columns = [
    {
      accessorKey: 'name',
      header: 'Customer Name',
      cell: ({ row }: any) => (
        <div
          onClick={() => router.push(`/crm/contacts/${row.original.id}`)}
          className="cursor-pointer hover:text-primary font-bold flex items-center space-x-2"
        >
          {row.original.type === 'CORPORATE' ? (
            <Building2 className="h-4 w-4 text-primary" />
          ) : (
            <User className="h-4 w-4 text-muted-foreground" />
          )}
          <span>{`${row.original.firstName || ''} ${row.original.lastName || ''}`.trim()}</span>
        </div>
      ),
    },
    {
      accessorKey: 'contactCode',
      header: 'Customer ID',
      cell: ({ row }: any) => (
        <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
          {row.original.contactCode || (row.original.id ? `CUST-${row.original.id.slice(0, 6).toUpperCase()}` : '—')}
        </span>
      ),
    },
    { accessorKey: 'type', header: 'Type' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'branch',
      header: 'Branch',
      cell: ({ row }: any) => row.original.branch?.name || (row.original.branchId ? row.original.branchId : '—'),
    },
    {
      accessorKey: 'agent',
      header: 'Assigned Agent',
      cell: ({ row }: any) => {
        const code = row.original.agentCode || row.original.agent;
        return code ? (
          <span className="font-mono text-xs font-bold text-primary px-2 py-0.5 rounded bg-primary/10 border border-primary/20">
            {code}
          </span>
        ) : (
          <span className="text-muted-foreground text-xs italic">Unassigned</span>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => {
        const isAct = row.original.status !== 'INACTIVE' && !row.original.deletedAt;
        return (
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              isAct
                ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20'
                : 'bg-rose-500/10 text-rose-600 border border-rose-500/20'
            }`}
            title={isAct ? 'Active Contact in Good Standing (No Deletions or Lapses)' : 'Inactive Profile'}
          >
            <span className={`h-1.5 w-1.5 rounded-full ${isAct ? 'bg-emerald-500' : 'bg-rose-500'}`} />
            {isAct ? 'ACTIVE' : 'INACTIVE'}
          </span>
        );
      },
    },
  ];

  return (
    <AppShell>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Customer Directory & Register
          </h1>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
            <span>Authoritative customer register · Status reflects active CRM standing with zero compliance lapses</span>
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow"
        >
          <Plus className="h-4 w-4" />
          <span>+ Add New Customer</span>
        </button>
      </div>

      {showAddModal && (
        <div className="p-5 rounded-2xl border bg-card shadow-lg space-y-4 text-xs">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-bold text-sm flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Register New Customer
            </h3>
            <button
              onClick={() => {
                setShowAddModal(false);
                router.replace('/crm/contacts');
              }}
              className="p-1 rounded hover:bg-accent"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">First Name *</label>
                <input
                  required
                  value={formData.firstName}
                  onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                  placeholder="e.g. Rahul"
                  className="w-full p-2.5 rounded-lg border bg-background text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Last Name *</label>
                <input
                  required
                  value={formData.lastName}
                  onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                  placeholder="e.g. Sharma"
                  className="w-full p-2.5 rounded-lg border bg-background text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Account Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-xs"
                >
                  <option value="INDIVIDUAL">INDIVIDUAL</option>
                  <option value="CORPORATE">CORPORATE</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Phone Number *</label>
                <input
                  required
                  inputMode="numeric"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="9876543210"
                  className="w-full p-2.5 rounded-lg border bg-background text-xs font-mono"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="rahul.sharma@example.com"
                  className="w-full p-2.5 rounded-lg border bg-background text-xs"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Branch Office</label>
                <select
                  value={formData.branchId}
                  onChange={(e) => setFormData({ ...formData, branchId: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-xs"
                >
                  <option value="">Select Branch (or use default assigned)...</option>
                  {dbBranches.map((b: any) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Assigned Agent Code</label>
                <input
                  value={formData.agentCode}
                  onChange={(e) => setFormData({ ...formData, agentCode: e.target.value.toUpperCase() })}
                  placeholder="Enter Agent Code (e.g. AGT-001)"
                  className="w-full p-2.5 rounded-lg border bg-background text-xs font-mono uppercase"
                />
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground border rounded-lg p-3 bg-muted/20">
              Customer Code (CUST-XXXXXX) is sequentially generated by the server. Active status is provisioned upon registration.
            </p>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  router.replace('/crm/contacts');
                }}
                className="px-4 py-2 rounded-lg border hover:bg-accent"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold flex items-center disabled:opacity-50"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                {isSubmitting ? 'Registering...' : 'Register Customer'}
              </button>
            </div>
          </form>
        </div>
      )}

      {duplicateDialog?.isOpen && (
        <div className="fixed inset-0 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4 z-50">
          <div className="bg-card border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-in fade-in zoom-in duration-150">
            <div className="flex items-center gap-3 text-amber-600">
              <div className="h-10 w-10 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">Customer Already Exists</h3>
                <p className="text-xs text-muted-foreground">
                  A customer with this {duplicateDialog.matchedBy?.toUpperCase() === 'EMAIL' ? 'email address' : 'phone number'} is already registered in the system.
                </p>
              </div>
            </div>

            <div className="p-4 rounded-xl bg-muted/40 border text-xs space-y-2">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Customer Name:</span>
                <span className="font-bold text-foreground">{duplicateDialog.customerName}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Customer ID:</span>
                <span className="font-mono font-bold text-primary px-1.5 py-0.5 rounded bg-primary/10 border border-primary/20">
                  {duplicateDialog.contactCode}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Matched By:</span>
                <span className="font-medium text-foreground">
                  {duplicateDialog.matchedBy?.toUpperCase() === 'EMAIL' ? 'Email Address' : 'Phone Number'}
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  const id = duplicateDialog.existingContactId;
                  setDuplicateDialog(null);
                  if (id) router.push(`/crm/contacts/${id}`);
                }}
                className="w-full py-2.5 px-4 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:opacity-90 transition-all flex items-center justify-center gap-1.5"
              >
                View Existing Customer
              </button>
              <button
                type="button"
                onClick={() => {
                  const id = duplicateDialog.existingContactId;
                  setDuplicateDialog(null);
                  if (id) router.push(`/crm/contacts/${id}`);
                }}
                className="w-full py-2 px-4 rounded-xl border bg-secondary/50 hover:bg-secondary text-secondary-foreground font-bold text-xs transition-all"
              >
                Use Existing Customer
              </button>
              <button
                type="button"
                onClick={() => setDuplicateDialog(null)}
                className="w-full py-2 px-4 rounded-xl text-muted-foreground hover:text-foreground font-medium text-xs transition-all"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {isError && (
        <div className="p-3 border border-destructive/30 rounded-lg bg-destructive/10 text-destructive text-xs flex items-center gap-2">
          <AlertCircle className="h-4 w-4" />
          Failed to load contacts from the server.{' '}
          <button onClick={() => refetch()} className="underline font-bold">
            Retry
          </button>
        </div>
      )}

      {isLoading ? (
        <div className="p-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <EnterpriseTable
          data={customers}
          columns={columns}
          totalRows={total}
          pageSize={limit}
          pageIndex={page - 1}
          pageCount={totalPages}
          manualPagination
          manualFiltering
          searchValue={search}
          onSearchChange={(value) => {
            setSearch(value);
            setPage(1);
          }}
          onPageChange={(nextPage) => setPage(nextPage + 1)}
          onPageSizeChange={(newSize) => {
            setLimit(newSize);
            setPage(1);
          }}
        />
      )}
    </AppShell>
  );
}

