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
import { apiClient } from '../../../lib/api-client';
import { useAuthStore } from '../../../store/auth-store';
import { toast } from 'sonner';

export default function CustomerRegisterPage() {
  const router = useNav();
  const searchParams = useSearchParams();
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(search);
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  const user = useAuthStore((s) => s.user);
  const userRoles = (user?.roles?.length ? user.roles : [user?.role || ''])
    .filter(Boolean)
    .map((r) => r.toUpperCase());
  const isAdminOrBackOffice = userRoles.some((r) =>
    ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMINISTRATOR', 'BACK_OFFICE', 'OPERATIONS'].includes(r)
  );

  const { data: dbBranches = [] } = useQuery({
    queryKey: ['branches-list'],
    queryFn: () => adminRepository.getBranches(),
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (searchParams.get('create') === '1') setShowAddModal(true);
  }, [searchParams]);

  const { customers, total, totalPages, isLoading, isFetching, isError, refetch } = useCustomers({
    page,
    limit,
    search: debouncedSearch.trim() || undefined,
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
    agentCodeSystem: '',
    isOldCustomer: false,
  });


  const { data: currentUser } = useQuery({
    queryKey: ['current-user-contact-preference'],
    queryFn: adminRepository.getCurrentUser,
  });

  const { data: availableUsers = [], isLoading: isLoadingAgents } = useQuery({
    queryKey: ['available-agents-directory'],
    queryFn: async () => {
      const result = await adminRepository.getUsers({ status: 'ACTIVE', limit: 100 });
      return Array.isArray(result) ? result : (result as any)?.data || (result as any)?.items || [];
    },
    staleTime: 60 * 1000,
  });

  const availableAgents = React.useMemo(() => {
    if (!Array.isArray(availableUsers)) return [];
    return availableUsers.filter((u: any) => {
      const roleCode = typeof u.role === 'string' ? u.role : u.role?.code;
      return String(roleCode || '').toUpperCase() === 'AGENT';
    });
  }, [availableUsers]);

  const selectedAgent = React.useMemo(() => {
    if (!formData.agentCode) return null;
    const searchCode = formData.agentCode.trim().toUpperCase();
    return (
      availableUsers.find((u: any) => {
        return (
          String(u.employeeCode || '').toUpperCase() === searchCode ||
          String(u.agentCode || '').toUpperCase() === searchCode ||
          (u.clientCodes || []).some((code: any) => String(code.value || '').toUpperCase() === searchCode) ||
          String(u.id || '').toUpperCase() === searchCode
        );
      }) || null
    );
  }, [availableUsers, formData.agentCode]);

  const externalAgentLookup = useQuery({
    queryKey: ['external-agent-code-resolution', formData.agentCode.trim(), formData.agentCodeSystem.trim().toUpperCase()],
    queryFn: async () => (await apiClient.get('/agents/external-codes/resolve', {
      params: {
        identifier: formData.agentCode.trim(),
        identifierType: 'EXTERNAL_CODE',
        codeSystem: formData.agentCodeSystem.trim().toUpperCase(),
      },
    })).data,
    enabled: false,
    retry: false,
  });

  const effectiveContactCollection = selectedAgent
    ? Boolean(selectedAgent.collectContacts)
    : Boolean(currentUser?.collectContacts ?? user?.collectContacts);

  // Default to primary branch once branches load
  useEffect(() => {
    if (dbBranches.length > 0 && !formData.branchId) {
      setFormData((prev) => ({ ...prev, branchId: dbBranches[0].id }));
    }
  }, [dbBranches]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanPhone = formData.phone.replace(/\D/g, '');
    const cleanFirstName = formData.firstName.trim();
    const cleanLastName = formData.lastName.trim();

    if (!cleanFirstName || !cleanLastName) {
      return void toast.error('First name and last name are required');
    }
    if (effectiveContactCollection && !cleanPhone) {
      return void toast.error('Mobile number is required when contact collection is enabled for this agent');
    }
    if (cleanPhone && !/^[6-9]\d{9}$/.test(cleanPhone)) {
      return void toast.error('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9');
    }

    const payload: any = {
      type: formData.type as 'INDIVIDUAL' | 'CORPORATE',
      firstName: cleanFirstName,
      lastName: cleanLastName,
      isOldCustomer: formData.isOldCustomer,
      ...(cleanPhone ? { phone: cleanPhone } : {}),
    };

    if (formData.email.trim()) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(formData.email.trim())) {
        return void toast.error('Please enter a valid email address (e.g. name@example.com)');
      }
      payload.email = formData.email.trim().toLowerCase();
    }

    if (formData.branchId) {
      payload.branchId = formData.branchId;
    }

    if (formData.agentCode.trim()) {
      payload.agentCode = formData.agentCode.trim();
      if (formData.agentCodeSystem.trim()) {
        if (!externalAgentLookup.data?.agent?.id) {
          return void toast.error('Resolve this external Agent code before registering the contact');
        }
        payload.agentCodeSystem = formData.agentCodeSystem.trim().toUpperCase();
      }
    } else if (formData.agentCodeSystem.trim()) {
      return void toast.error('Enter an external Agent code for the selected code system');
    }

    setIsSubmitting(true);
    try {
      await customerRepository.createContact(payload);
      await refetch();
      toast.success(`Customer "${cleanFirstName} ${cleanLastName}" registered successfully`);
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
        agentCodeSystem: '',
        isOldCustomer: false,
      });
      router.replace('/crm/contacts');
    } catch (err: any) {
      const errData = err?.response?.data?.error || err?.response?.data;
      if (err?.response?.status === 409 || errData?.code === 'DUPLICATE_CONTACT') {
        setShowAddModal(false);
        setDuplicateDialog({
          isOpen: true,
          existingContactId: errData?.existingContactId || '',
          matchedBy: errData?.matchedBy || (String(errData?.message || '').toLowerCase().includes('email') ? 'EMAIL' : 'PHONE'),
          contactCode: errData?.contactCode || 'CONT-EXISTING',
          customerName: errData?.customerName || `${cleanFirstName} ${cleanLastName}`.trim(),
        });
        return;
      }
      const rawMessage = errData?.message || err?.message;
      const displayMsg = Array.isArray(rawMessage) ? rawMessage.join(', ') : (rawMessage || 'Failed to register customer');
      toast.error(displayMsg);
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" /> Customer Directory & Register
            </h1>
            <span
              className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium border ${
                effectiveContactCollection
                  ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20'
                  : 'bg-muted/70 text-muted-foreground border-border/80'
              }`}
            >
              <span
                className={`h-1.5 w-1.5 rounded-full ${
                  effectiveContactCollection ? 'bg-emerald-500' : 'bg-muted-foreground/60'
                }`}
              />
              {effectiveContactCollection
                ? 'Contact collection enabled (Phone number required)'
                : 'Contact collection optional (Phone number optional)'}
            </span>
          </div>
          <p className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
            <span>Authoritative customer register · Status reflects active CRM standing with zero compliance lapses</span>
          </p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1.5 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow transition-colors shrink-0 self-start sm:self-center"
        >
          <Plus className="h-4 w-4" />
          <span>Add New Customer</span>
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
                <label className="font-bold text-muted-foreground block mb-1">
                  Phone Number {effectiveContactCollection ? <span className="text-red-500">*</span> : <span className="text-muted-foreground/60 font-normal">(Optional)</span>}
                </label>
                <input
                  inputMode="numeric"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="9876543210"
                  className={`w-full p-2.5 rounded-lg border bg-background text-xs font-mono ${effectiveContactCollection && !formData.phone ? 'border-red-400' : ''}`}
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
                <label className="font-bold text-muted-foreground block mb-1">
                  Client Agent Code <span className="text-muted-foreground/60 font-normal">(Optional)</span>
                </label>
                <input
                  list="registered-agent-codes"
                  value={formData.agentCode}
                  onChange={(e) => {
                    const value = e.target.value;
                    const matches = availableAgents.flatMap((agent: any) => agent.clientCodes || [])
                      .filter((code: any) => code.value === value);
                    setFormData({
                      ...formData,
                      agentCode: value,
                      agentCodeSystem: matches.length === 1 ? matches[0].codeSystem : '',
                    });
                  }}
                  disabled={isLoadingAgents}
                  placeholder="Choose an Agent or enter an external code"
                  className="w-full p-2.5 rounded-lg border bg-background text-xs"
                />
                <datalist id="registered-agent-codes">
                  {availableAgents.map((ag: any) => {
                    const fullName = `${ag.firstName || ''} ${ag.lastName || ''}`.trim() || ag.email;
                    return (
                      <React.Fragment key={ag.id}>
                        {(ag.clientCodes || []).filter((code: any) => code.verificationStatus === 'VERIFIED').map((code: any) => (
                          <option key={`${ag.id}:${code.id}`} value={code.value} label={`${fullName} (${code.codeSystem})`} />
                        ))}
                        {!ag.clientCodes?.length && <option value={ag.agentCode || ''} label={`${fullName} (client code not registered)`} />}
                      </React.Fragment>
                    );
                  })}
                </datalist>
                <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2 mt-2">
                  <input
                    value={formData.agentCodeSystem}
                    onChange={(e) => setFormData({ ...formData, agentCodeSystem: e.target.value.toUpperCase() })}
                    placeholder="Client code system"
                    className="w-full p-2.5 rounded-lg border bg-background text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => externalAgentLookup.refetch()}
                    disabled={!formData.agentCode.trim() || !formData.agentCodeSystem.trim() || externalAgentLookup.isFetching}
                    className="rounded-lg border px-3 py-2 text-xs font-semibold hover:bg-accent disabled:opacity-50"
                  >
                    {externalAgentLookup.isFetching ? 'Resolving…' : 'Resolve code'}
                  </button>
                </div>
                <span className="text-[10px] text-muted-foreground mt-1 block">
                  {externalAgentLookup.data?.agent
                    ? `Verified client code: ${externalAgentLookup.data.agent.name} · ${externalAgentLookup.data.identifier.value} (${externalAgentLookup.data.identifier.codeSystem})`
                    : externalAgentLookup.isError
                      ? 'Code was not found, is inactive, or still needs verification.'
                      : selectedAgent
                    ? `Assigned to: ${selectedAgent.firstName || ''} ${selectedAgent.lastName || ''} (${selectedAgent.agentCode || 'client code not registered'})`
                    : 'Select a registered Agent or enter an external code and namespace. Leave blank to use the authenticated Agent where applicable.'}
                </span>
              </div>
            </div>

            <div className="space-y-0.5 pt-1">
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="contactIsOldCustomer"
                  checked={formData.isOldCustomer}
                  onChange={(e) => setFormData({ ...formData, isOldCustomer: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary focus:ring-primary/50"
                />
                <label htmlFor="contactIsOldCustomer" className="text-xs font-bold text-muted-foreground cursor-pointer">
                  Old Customer
                </label>
              </div>
              <p className="pl-6 text-[11px] text-muted-foreground">
                Marks this customer as an existing / old customer on their profile (tick Old Customer on Motor Quotation Step 1 to skip expired-policy inspection).
              </p>
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
                  setDuplicateDialog(null);
                  setShowAddModal(true);
                }}
                className="w-full py-2 px-4 rounded-xl border bg-secondary/50 hover:bg-secondary text-secondary-foreground font-bold text-xs transition-all flex items-center justify-center gap-1.5"
              >
                <span>Edit Phone / Email & Try Again</span>
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

      {isLoading && customers.length === 0 ? (
        <div className="p-10 flex justify-center">
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        </div>
      ) : (
        <div className={isFetching ? 'opacity-60 pointer-events-none transition-opacity' : 'transition-opacity'}>
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
        </div>
      )}
    </AppShell>
  );
}

