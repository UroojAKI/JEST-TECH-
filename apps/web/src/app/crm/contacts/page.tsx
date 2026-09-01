'use client';

import React, { useState, useEffect } from 'react';
import { useRouter as useNav } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Users, Plus, Building2, User, Loader2, X } from 'lucide-react';
import { useCustomers } from '../../../hooks/useCustomer360';
import { customerRepository } from '../../../repositories/customer.repository';
import { toast } from 'sonner';

export default function CustomerRegisterPage() {
  const router = useNav();
  const [savedView, setSavedView] = useState<string>('ALL');
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const { customers: apiCustomers, refetch } = useCustomers();

  const safeApiCustomers = Array.isArray(apiCustomers)
    ? apiCustomers
    : ((apiCustomers as any)?.items || (apiCustomers as any)?.data || []);

  const combinedCustomers = safeApiCustomers.map((c: any) => ({
    id: c.id,
    name: `${c.firstName || ''} ${c.lastName || ''}`.trim() || c.name || 'Unnamed Client',
    type: c.type || 'INDIVIDUAL',
    phone: c.phone || '-',
    email: c.email || '-',
    branch: c.branchId || 'Head Office',
    tag: c.tags?.[0] || 'NEW',
    status: 'ACTIVE',
  }));

  const [formData, setFormData] = useState({
    name: '',
    type: 'INDIVIDUAL',
    phone: '',
    email: '',
    branch: 'Mumbai BKC',
    tag: 'REGULAR',
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.name || !formData.phone) {
      toast.error('Customer name and phone number are required');
      return;
    }

    setIsSubmitting(true);
    try {
      const nameParts = formData.name.trim().split(' ');
      const cleanPhone = formData.phone.replace(/\D/g, '').slice(-10);
      const payload: any = {
        type: formData.type === 'CORPORATE' ? 'CORPORATE' : 'INDIVIDUAL',
        firstName: nameParts[0] || formData.name.trim() || 'Customer',
        lastName: nameParts.slice(1).join(' ').trim() || 'Customer',
        phone: cleanPhone.length === 10 ? cleanPhone : '9892088123',
      };
      if (formData.email && formData.email.includes('@')) {
        payload.email = formData.email.trim();
      }

      await customerRepository.createContact(payload);
      await refetch();
      toast.success(`Customer "${formData.name}" registered successfully!`);
      setShowAddModal(false);
      setFormData({
        name: '',
        type: 'INDIVIDUAL',
        phone: '',
        email: '',
        branch: 'Mumbai BKC',
        tag: 'REGULAR',
      });
    } catch (err: any) {
      toast.error(
        `Failed to register customer: ${err.message || 'Server error'}`,
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredData = combinedCustomers.filter((c) => {
    if (savedView === 'CORPORATE') return c.type === 'CORPORATE';
    if (savedView === 'VIP') return c.tag === 'VIP';
    if (savedView === 'RENEWALS') return c.status === 'LAPSED';
    return true;
  });

  const columns = [
    {
      accessorKey: 'name',
      header: 'Customer Name',
      cell: ({ row }: any) => (
        <div
          onClick={() => router.push(`/crm/contacts/${row.original.id}`)}
          className="cursor-pointer hover:text-primary font-bold flex items-center space-x-2"
        >
          {row.original.type === 'CORPORATE' ? <Building2 className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-muted-foreground" />}
          <span>{row.original.name}</span>
        </div>
      ),
    },
    { accessorKey: 'id', header: 'Customer ID' },
    { accessorKey: 'type', header: 'Type' },
    { accessorKey: 'phone', header: 'Phone' },
    { accessorKey: 'email', header: 'Email' },
    {
      accessorKey: 'branch',
      header: 'Branch',
      cell: ({ row }: any) => {
        const b = row.original.branch;
        if (typeof b === 'object' && b !== null) return b.name || b.code || 'Main Branch';
        return b || 'Main Branch';
      },
    },
    {
      accessorKey: 'tag',
      header: 'Tags',
      cell: ({ row }: any) => (
        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
          {row.original.tag}
        </span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <AppShell>
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" /> Customer Directory & Register
          </h1>
          <p className="text-xs text-muted-foreground">Manage individual and corporate customer portfolios</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow"
        >
          <Plus className="h-4 w-4" />
          <span>+ Add New Customer</span>
        </button>
      </div>

      {/* Add Customer Modal / Inline Drawer */}
      {showAddModal && (
        <div className="p-5 rounded-2xl border bg-card shadow-lg space-y-4 text-xs animate-in fade-in slide-in-from-top-2">
          <div className="flex justify-between items-center border-b pb-3">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <User className="h-4 w-4 text-primary" /> Register New Customer Account
            </h3>
            <button onClick={() => setShowAddModal(false)} className="p-1 rounded hover:bg-accent text-muted-foreground">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Customer Full Name / Company *</label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g. Acme Logistics or Rajesh Sharma"
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Account Type</label>
                <select
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="INDIVIDUAL">INDIVIDUAL</option>
                  <option value="CORPORATE">CORPORATE</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Phone Number *</label>
                <input
                  type="text"
                  required
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  placeholder="+91 98765 43210"
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Email Address</label>
                <input
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  placeholder="customer@domain.com"
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Branch Office</label>
                <input
                  type="text"
                  value={formData.branch}
                  onChange={(e) => setFormData({ ...formData, branch: e.target.value })}
                  placeholder="Mumbai BKC Branch"
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Category Tag</label>
                <select
                  value={formData.tag}
                  onChange={(e) => setFormData({ ...formData, tag: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="REGULAR">REGULAR</option>
                  <option value="VIP">VIP</option>
                  <option value="HIGH PREMIUM">HIGH PREMIUM</option>
                  <option value="CORPORATE">CORPORATE</option>
                </select>
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setShowAddModal(false)}
                className="px-4 py-2 rounded-lg border bg-background hover:bg-accent text-foreground font-semibold"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow flex items-center space-x-1"
              >
                {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                <span>{isSubmitting ? 'Registering...' : 'Register Customer'}</span>
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Saved Views Toolbar */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'ALL', label: 'All Customers' },
          { id: 'VIP', label: 'VIP Accounts' },
          { id: 'CORPORATE', label: 'Corporate Clients' },
          { id: 'RENEWALS', label: 'Renewals Due' },
        ].map((view) => (
          <button
            key={view.id}
            onClick={() => setSavedView(view.id)}
            className={`px-3 py-1.5 rounded-md font-semibold transition-colors ${
              savedView === view.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {view.label}
          </button>
        ))}
      </div>

      <EnterpriseTable data={filteredData} columns={columns} />
    </AppShell>
  );
}
