'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { EnterpriseTable } from '../../../components/table/enterprise-table';
import { StatusBadge } from '../../../components/ui/status-badge';
import { Building2, Plus, Download, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface AccountItem {
  id: string;
  name: string;
  industry: string;
  contactsCount: number;
  activePolicies: number;
  totalAnnualPremium: string;
  relationshipManager: string;
  status: string;
}

const INITIAL_ACCOUNTS: AccountItem[] = [
  { id: 'ACC-00101', name: 'Acme Logistics Pvt Ltd', industry: 'Logistics & Supply Chain', contactsCount: 14, activePolicies: 3, totalAnnualPremium: '₹14,50,000', relationshipManager: 'Rajesh Sharma', status: 'ACTIVE' },
  { id: 'ACC-00102', name: 'TechCorp Solutions Ltd', industry: 'Information Technology', contactsCount: 28, activePolicies: 5, totalAnnualPremium: '₹32,00,000', relationshipManager: 'Sunil Verma', status: 'ACTIVE' },
  { id: 'ACC-00103', name: 'Global Manufacturing Corp', industry: 'Industrial Manufacturing', contactsCount: 42, activePolicies: 8, totalAnnualPremium: '₹85,00,000', relationshipManager: 'Priya Mehta', status: 'ACTIVE' },
  { id: 'ACC-00104', name: 'Apex Healthcare Services', industry: 'Healthcare & Pharma', contactsCount: 19, activePolicies: 2, totalAnnualPremium: '₹18,20,000', relationshipManager: 'Rajesh Sharma', status: 'LAPSED' },
];

export default function CorporateAccountsPage() {
  const [accounts, setAccounts] = useState<AccountItem[]>(INITIAL_ACCOUNTS);
  const [savedView, setSavedView] = useState<string>('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [form, setForm] = useState({
    name: '',
    industry: 'Information Technology',
    relationshipManager: 'Rajesh Sharma',
  });

  const filteredData = accounts.filter((acc) => {
    if (savedView === 'ACTIVE') return acc.status === 'ACTIVE';
    if (savedView === 'LAPSED') return acc.status === 'LAPSED';
    return true;
  });

  const handleExportCSV = () => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      ['Account ID,Account Name,Industry,Policies,Premium,RM,Status']
        .concat(
          accounts.map(
            (a) => `${a.id},"${a.name}","${a.industry}",${a.activePolicies},"${a.totalAnnualPremium}","${a.relationshipManager}",${a.status}`
          )
        )
        .join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'Corporate_Accounts_Register.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success('Corporate Accounts CSV exported!');
  };

  const handleCreateAccount = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name) {
      toast.error('Account Name is required');
      return;
    }

    setIsSubmitting(true);
    setTimeout(() => {
      const newAcc: AccountItem = {
        id: `ACC-0010${accounts.length + 1}`,
        name: form.name,
        industry: form.industry,
        contactsCount: 1,
        activePolicies: 1,
        totalAnnualPremium: '₹12,00,000',
        relationshipManager: form.relationshipManager,
        status: 'ACTIVE',
      };
      setAccounts([newAcc, ...accounts]);
      toast.success(`Corporate Account "${newAcc.name}" created successfully!`);
      setForm({ name: '', industry: 'Information Technology', relationshipManager: 'Rajesh Sharma' });
      setIsSubmitting(false);
      setIsModalOpen(false);
    }, 400);
  };

  const columns = [
    {
      accessorKey: 'name',
      header: 'Account Name',
      cell: ({ row }: any) => (
        <div className="font-bold flex items-center space-x-2 text-primary hover:underline cursor-pointer">
          <Building2 className="h-4 w-4" />
          <span>{row.original.name}</span>
        </div>
      ),
    },
    { accessorKey: 'id', header: 'Account ID' },
    { accessorKey: 'industry', header: 'Industry' },
    { accessorKey: 'contactsCount', header: 'Key Contacts' },
    { accessorKey: 'activePolicies', header: 'Policies' },
    {
      accessorKey: 'totalAnnualPremium',
      header: 'Annual Premium',
      cell: ({ row }: any) => <span className="font-extrabold text-emerald-600">{row.original.totalAnnualPremium}</span>,
    },
    { accessorKey: 'relationshipManager', header: 'RM' },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }: any) => <StatusBadge status={row.original.status} />,
    },
  ];

  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Building2 className="h-5 w-5 text-primary" /> Corporate Accounts Register
          </h1>
          <p className="text-xs text-muted-foreground">Manage enterprise B2B accounts, group policies, and relationship managers</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleExportCSV}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-md border bg-card hover:bg-accent transition-colors"
          >
            <Download className="h-3.5 w-3.5" />
            <span>Export Register</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow"
          >
            <Plus className="h-4 w-4" />
            <span>Add Account</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Total Corporate Premium</span>
          <div className="font-extrabold text-emerald-600 text-sm">₹1.49 Cr</div>
        </div>
        <div className="p-3 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Active Enterprise Clients</span>
          <div className="font-extrabold text-foreground text-sm">{accounts.length} Accounts</div>
        </div>
        <div className="p-3 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Avg Policies per Account</span>
          <div className="font-extrabold text-primary text-sm">4.2 Policies</div>
        </div>
        <div className="p-3 rounded-xl border bg-card space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase font-bold">Group Health Lives Covered</span>
          <div className="font-extrabold text-indigo-600 text-sm">12,450 Lives</div>
        </div>
      </div>

      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-lg border space-x-1">
        {[
          { id: 'ALL', label: 'All Accounts' },
          { id: 'ACTIVE', label: 'Active B2B Clients' },
          { id: 'LAPSED', label: 'Lapsed / Renewal Due' },
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

      {/* Add Account Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-4 border-b flex justify-between items-center">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" /> Create Corporate B2B Account
              </h2>
              <button onClick={() => setIsModalOpen(false)} className="p-1 rounded text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleCreateAccount} className="p-5 space-y-3">
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Company / Account Name *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Infosys Technologies Ltd"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                />
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Industry Vertical</label>
                <select
                  value={form.industry}
                  onChange={(e) => setForm({ ...form, industry: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="Information Technology">Information Technology</option>
                  <option value="Logistics & Supply Chain">Logistics & Supply Chain</option>
                  <option value="Industrial Manufacturing">Industrial Manufacturing</option>
                  <option value="Healthcare & Pharma">Healthcare & Pharma</option>
                  <option value="Financial Services">Financial Services</option>
                </select>
              </div>
              <div>
                <label className="font-bold text-muted-foreground block mb-1">Relationship Manager (RM)</label>
                <select
                  value={form.relationshipManager}
                  onChange={(e) => setForm({ ...form, relationshipManager: e.target.value })}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs focus:ring-1 focus:ring-primary"
                >
                  <option value="Rajesh Sharma">Rajesh Sharma</option>
                  <option value="Sunil Verma">Sunil Verma</option>
                  <option value="Priya Mehta">Priya Mehta</option>
                </select>
              </div>
              <div className="pt-3 flex justify-end space-x-2 border-t mt-4">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-lg border bg-background font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow flex items-center space-x-1"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  <span>{isSubmitting ? 'Creating...' : 'Create Account'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </AppShell>
  );
}

