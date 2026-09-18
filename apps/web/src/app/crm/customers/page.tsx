'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import {
  UserCheck,
  Plus,
  Search,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
  Car,
  FileText,
  Star,
  Phone,
  Mail,
  Loader2,
  X,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  customerRepository,
  Customer,
} from '../../../repositories/customer.repository';
import { toast } from 'sonner';

export default function CustomersPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [showAddModal, setShowAddModal] = useState(false);

  // Form State
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    mobile: '',
    email: '',
    panNumber: '',
    aadhaarNumber: '',
    city: '',
    state: '',
    isVip: false,
  });

  // Soft Duplicate Checking
  const [checkingDuplicates, setCheckingDuplicates] = useState(false);
  const [duplicateMatches, setDuplicateMatches] = useState<any[]>([]);

  // Fetch Customers
  const { data, isLoading } = useQuery({
    queryKey: ['customers-list', page, search],
    queryFn: () =>
      customerRepository.getCustomers({
        page,
        limit: 20,
        search: search.trim() || undefined,
      }),
    staleTime: 30_000,
  });

  const customers = data?.data || [];
  const total = (data as any)?.meta?.total ?? data?.total ?? 0;
  const totalPages = (data as any)?.meta?.totalPages ?? data?.totalPages ?? 1;

  // Debounced soft duplicate check
  useEffect(() => {
    const cleanMobile = formData.mobile.replace(/\D/g, '');
    if (cleanMobile.length === 10 || (formData.email && formData.email.includes('@'))) {
      setCheckingDuplicates(true);
      const timer = setTimeout(async () => {
        try {
          const res = await customerRepository.checkDuplicate({
            mobile: cleanMobile.length === 10 ? cleanMobile : undefined,
            email: formData.email.trim() || undefined,
          });
          setDuplicateMatches(res.matches || []);
        } catch {
          // ignore soft check error
        } finally {
          setCheckingDuplicates(false);
        }
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setDuplicateMatches([]);
    }
  }, [formData.mobile, formData.email]);

  // Create Mutation
  const createMutation = useMutation({
    mutationFn: (acknowledge: boolean) =>
      customerRepository.createCustomer({
        ...formData,
        mobile: formData.mobile.replace(/\D/g, ''),
        acknowledgeDuplicate: acknowledge,
      }),
    onSuccess: (res) => {
      if (res.duplicateWarning && !res.customer) {
        toast.warning(res.message || 'Duplicate detected. Please acknowledge to proceed.');
        setDuplicateMatches(res.matches || []);
      } else {
        const code = res.customer?.customerCode || '';
        toast.success("Customer " + code + " created successfully!");
        setShowAddModal(false);
        setFormData({
          firstName: '',
          lastName: '',
          mobile: '',
          email: '',
          panNumber: '',
          aadhaarNumber: '',
          city: '',
          state: '',
          isVip: false,
        });
        setDuplicateMatches([]);
        queryClient.invalidateQueries({ queryKey: ['customers-list'] });
        if (res.customer?.id) {
          router.push("/crm/customers/" + res.customer.id);
        }
      }
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create customer');
    },
  });

  const handleSubmit = (e: React.FormEvent, forceAcknowledge = false) => {
    e.preventDefault();
    if (!formData.firstName.trim()) {
      return toast.error('First name is required');
    }
    const cleanMobile = formData.mobile.replace(/\D/g, '');
    if (!/^[6-9]\d{9}$/.test(cleanMobile)) {
      return toast.error('Please enter a valid 10-digit Indian mobile number (6-9)');
    }
    createMutation.mutate(forceAcknowledge);
  };

  return (
    <AppShell>
      <div className="space-y-6 p-6">
        {/* Header */}
        <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900 flex items-center gap-2">
              <UserCheck className="h-6 w-6 text-primary-600" />
              Customer Directory
            </h1>
            <p className="text-sm text-slate-500">
              Permanent customer records, soft deduplication signals, and cross-portfolio views
            </p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center gap-2 rounded-lg bg-primary-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-primary-700 transition"
          >
            <Plus className="h-4 w-4" />
            Add Customer
          </button>
        </div>

        {/* Filter Bar */}
        <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <Search className="h-5 w-5 text-slate-400 ml-2" />
          <input
            type="text"
            placeholder="Search by customer name, code (CUST-XXXXXX), phone, email, or city..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="text-xs text-slate-400 hover:text-slate-600 px-2 py-1"
            >
              Clear
            </button>
          )}
        </div>

        {/* Customer Table */}
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
          <table className="w-full text-left text-sm text-slate-600">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wider text-slate-500">
              <tr>
                <th className="px-6 py-3.5">Customer Code</th>
                <th className="px-6 py-3.5">Name</th>
                <th className="px-6 py-3.5">Contact Details</th>
                <th className="px-6 py-3.5">Location</th>
                <th className="px-6 py-3.5 text-center">Portfolio</th>
                <th className="px-6 py-3.5 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary-600 mb-2" />
                    Loading customers...
                  </td>
                </tr>
              ) : customers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400">
                    No customer records found. Click &quot;Add Customer&quot; to create one.
                  </td>
                </tr>
              ) : (
                customers.map((c: Customer) => (
                  <tr
                    key={c.id}
                    onClick={() => router.push("/crm/customers/" + c.id)}
                    className="cursor-pointer transition hover:bg-slate-50/80"
                  >
                    <td className="px-6 py-4 font-mono font-medium text-primary-600">
                      {c.customerCode}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">
                          {c.firstName} {c.lastName || ''}
                        </span>
                        {c.isVip && (
                          <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 border border-amber-200">
                            <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                            VIP
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="space-y-0.5">
                        <div className="flex items-center gap-1.5 text-xs text-slate-700">
                          <Phone className="h-3.5 w-3.5 text-slate-400" />
                          +91 {c.mobile}
                        </div>
                        {c.email && (
                          <div className="flex items-center gap-1.5 text-xs text-slate-500">
                            <Mail className="h-3.5 w-3.5 text-slate-400" />
                            {c.email}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-600">
                      {c.city ? (c.city + (c.state ? ", " + c.state : '')) : '?'}
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center justify-center gap-2 text-xs">
                        <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 px-2 py-1 font-medium text-blue-700">
                          <FileText className="h-3 w-3" />
                          {c._count?.leads || 0} Leads
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 px-2 py-1 font-medium text-emerald-700">
                          <ShieldCheck className="h-3 w-3" />
                          {c._count?.policies || 0} Policies
                        </span>
                        <span className="inline-flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 font-medium text-purple-700">
                          <Car className="h-3 w-3" />
                          {c._count?.vehicles || 0} Vehicles
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          router.push("/crm/customers/" + c.id);
                        }}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-primary-600 hover:text-primary-800"
                      >
                        View 360
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between border-t border-slate-200 px-6 py-3 bg-slate-50 text-xs text-slate-500">
              <span>
                Showing Page {page} of {totalPages} ({total} Total Customers)
              </span>
              <div className="flex gap-2">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  className="rounded border border-slate-300 px-2.5 py-1 hover:bg-white disabled:opacity-50"
                >
                  Previous
                </button>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded border border-slate-300 px-2.5 py-1 hover:bg-white disabled:opacity-50"
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Add Customer Modal with Soft Duplicate Intelligence */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-xl rounded-2xl bg-white p-6 shadow-2xl">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute right-4 top-4 text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>

            <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
              <UserCheck className="h-5 w-5 text-primary-600" />
              Add Customer
            </h2>
            <p className="mt-1 text-xs text-slate-500">
              Creates a permanent customer entity with real-time soft duplicate detection
            </p>

            <form onSubmit={(e) => handleSubmit(e, false)} className="mt-5 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">First Name *</label>
                  <input
                    type="text"
                    required
                    value={formData.firstName}
                    onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
                    placeholder="e.g. Rajesh"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Last Name</label>
                  <input
                    type="text"
                    value={formData.lastName}
                    onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
                    placeholder="e.g. Sharma"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">
                    Mobile Number * (10 Digits)
                    {checkingDuplicates && (
                      <Loader2 className="inline ml-2 h-3 w-3 animate-spin text-slate-400" />
                    )}
                  </label>
                  <input
                    type="text"
                    required
                    maxLength={10}
                    value={formData.mobile}
                    onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                    placeholder="e.g. 9876543210"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">Email Address</label>
                  <input
                    type="email"
                    value={formData.email}
                    onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                    placeholder="e.g. rajesh@example.com"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700">City</label>
                  <input
                    type="text"
                    value={formData.city}
                    onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                    placeholder="e.g. Mumbai"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700">State</label>
                  <input
                    type="text"
                    value={formData.state}
                    onChange={(e) => setFormData({ ...formData, state: e.target.value })}
                    placeholder="e.g. Maharashtra"
                    className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-primary-500 focus:outline-none"
                  />
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="isVip"
                  checked={formData.isVip}
                  onChange={(e) => setFormData({ ...formData, isVip: e.target.checked })}
                  className="h-4 w-4 rounded border-slate-300 text-primary-600 focus:ring-primary-500"
                />
                <label htmlFor="isVip" className="text-xs font-medium text-slate-700 cursor-pointer">
                  Mark as High-Priority / VIP Customer
                </label>
              </div>

              {/* Soft Duplicate Warning Card */}
              {duplicateMatches.length > 0 && (
                <div className="rounded-xl border border-amber-300 bg-amber-50/80 p-4 space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
                    <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                    Existing Customer Match Detected
                  </div>
                  <p className="text-xs text-amber-800">
                    The mobile or email matches existing database records. You can open the existing profile or proceed with creation:
                  </p>
                  <div className="space-y-1.5">
                    {duplicateMatches.map((m) => (
                      <div
                        key={m.id}
                        className="flex items-center justify-between rounded-lg bg-white p-2.5 border border-amber-200 text-xs"
                      >
                        <div>
                          <span className="font-semibold text-slate-900">{m.firstName} {m.lastName || ''}</span>
                          <span className="ml-2 font-mono text-slate-500">({m.customerCode})</span>
                          <div className="text-[11px] text-slate-500">
                            {m.activePoliciesCount} Policies | {m.activeLeadsCount} Leads | {m.city || 'No city'}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setShowAddModal(false);
                            router.push("/crm/customers/" + m.id);
                          }}
                          className="inline-flex items-center gap-1 rounded bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800 hover:bg-amber-200"
                        >
                          Open Profile
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  Cancel
                </button>
                {duplicateMatches.length > 0 ? (
                  <button
                    type="button"
                    disabled={createMutation.isPending}
                    onClick={(e) => handleSubmit(e, true)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-amber-600 px-4 py-2 text-xs font-semibold text-white hover:bg-amber-700"
                  >
                    {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Confirm &amp; Create As Distinct Customer
                  </button>
                ) : (
                  <button
                    type="submit"
                    disabled={createMutation.isPending}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-primary-600 px-4 py-2 text-xs font-semibold text-white hover:bg-primary-700"
                  >
                    {createMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                    Save Customer
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}
