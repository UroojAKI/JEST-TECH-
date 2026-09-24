'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../../components/layout/app-shell';
import {
  UserCheck,
  ShieldCheck,
  Car,
  FileSpreadsheet,
  FileText,
  TrendingUp,
  Clock,
  AlertTriangle,
  Star,
  Phone,
  Mail,
  MapPin,
  CreditCard,
  Plus,
  Edit,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  ArrowLeft,
  Loader2,
  Bell,
  RefreshCw,
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { customerRepository, Customer } from '../../../../repositories/customer.repository';
import { taskRepository } from '../../../../repositories/task.repository';
import { motorQuotationRepository } from '../../../../repositories/motor-quotation.repository';
import { toast } from 'sonner';
import { NewLeadModal } from '../../../../components/leads/NewLeadModal';

export default function CustomerDetailPage() {
  const params = useParams();
  const router = useRouter();
  const queryClient = useQueryClient();
  const customerId = (params?.id as string) || '';

  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'VEHICLES' | 'QUOTATIONS' | 'POLICIES' | 'LEADS' | 'TASKS' | 'CLAIMS'>('OVERVIEW');
  const [showEditModal, setShowEditModal] = useState(false);
  const [showNewLeadModal, setShowNewLeadModal] = useState(false);

  // Edit form state
  const [editFormData, setEditFormData] = useState<Partial<Customer>>({});

  const { data: customer, isLoading, isError, refetch } = useQuery({
    queryKey: ['customer-detail', customerId],
    queryFn: () => customerRepository.getCustomerById(customerId),
    enabled: !!customerId,
    staleTime: 30_000,
  });

  // Edit customer mutation
  const updateMutation = useMutation({
    mutationFn: (data: Partial<Customer>) => customerRepository.updateCustomer(customerId, data),
    onSuccess: () => {
      toast.success('Customer profile updated successfully!');
      setShowEditModal(false);
      void queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] });
      void queryClient.invalidateQueries({ queryKey: ['customers-list'] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update customer');
    },
  });

  // Mark alert read mutation
  const readAlertMutation = useMutation({
    mutationFn: (alertId: string) => customerRepository.markAlertRead(customerId, alertId),
    onSuccess: () => {
      toast.success('Alert marked as read');
      void queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] });
    },
  });

  // Complete task mutation
  const completeTaskMutation = useMutation({
    mutationFn: (taskId: string) => taskRepository.completeTask(taskId),
    onSuccess: () => {
      toast.success('Task marked as completed');
      void queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] });
    },
  });

  // Accept quote mutation
  const acceptQuoteMutation = useMutation({
    mutationFn: (quoteId: string) => motorQuotationRepository.acceptQuotation(quoteId),
    onSuccess: (res) => {
      toast.success(res.message || 'Quotation accepted!');
      void queryClient.invalidateQueries({ queryKey: ['customer-detail', customerId] });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to accept quotation');
    },
  });

  if (isLoading) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-xs text-muted-foreground font-semibold">Loading Customer 360 Profile...</p>
        </div>
      </AppShell>
    );
  }

  if (isError || !customer) {
    return (
      <AppShell>
        <div className="p-8 text-center space-y-4">
          <AlertTriangle className="h-10 w-10 text-amber-500 mx-auto" />
          <h2 className="text-lg font-bold">Customer Not Found</h2>
          <p className="text-xs text-muted-foreground">The requested customer record does not exist or has been deleted.</p>
          <button
            onClick={() => router.push('/crm/customers')}
            className="px-4 py-2 bg-primary text-primary-foreground text-xs font-semibold rounded-lg shadow-sm"
          >
            Return to Customers
          </button>
        </div>
      </AppShell>
    );
  }

  const fullName = `${customer.firstName} ${customer.lastName || ''}`.trim();
  const unreadAlerts = (customer.alerts || []).filter((a: any) => !a.isRead);

  return (
    <AppShell>
      <div className="space-y-6 pb-12">
        {/* Navigation Breadcrumb & Back */}
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.push('/crm/customers')}
            className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground transition"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>Back to All Customers</span>
          </button>
          <button
            onClick={() => void refetch()}
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground p-1.5 rounded-lg border bg-card shadow-xs transition"
          >
            <RefreshCw className="h-3 w-3" />
            <span>Refresh 360</span>
          </button>
        </div>

        {/* 1. Master Customer Header Card */}
        <div className="rounded-2xl border bg-card p-6 shadow-xs relative overflow-hidden">
          <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
            <div className="space-y-3">
              <div className="flex items-center gap-2.5 flex-wrap">
                <span className="px-2.5 py-1 rounded-md bg-primary/10 text-primary font-mono text-xs font-bold border border-primary/20">
                  {customer.customerCode}
                </span>
                <h1 className="text-2xl font-black tracking-tight">{fullName}</h1>
                {customer.isVip && (
                  <span className="flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-600 border border-amber-500/30 text-xs font-bold">
                    <Star className="h-3 w-3 fill-amber-500" />
                    VIP Customer
                  </span>
                )}
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  Active
                </span>
              </div>

              {/* Contact Information Bar */}
              <div className="flex items-center gap-5 flex-wrap text-xs text-muted-foreground pt-1">
                <div className="flex items-center gap-1.5 font-medium">
                  <Phone className="h-3.5 w-3.5 text-primary" />
                  <span className="font-mono text-foreground font-semibold">{customer.mobile}</span>
                </div>
                {customer.email && (
                  <div className="flex items-center gap-1.5 font-medium">
                    <Mail className="h-3.5 w-3.5 text-primary" />
                    <span>{customer.email}</span>
                  </div>
                )}
                {(customer.city || customer.state) && (
                  <div className="flex items-center gap-1.5 font-medium">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    <span>{[customer.city, customer.state, customer.pincode].filter(Boolean).join(', ')}</span>
                  </div>
                )}
                {customer.panNumber && (
                  <div className="flex items-center gap-1.5 font-medium">
                    <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono uppercase text-foreground">PAN: {customer.panNumber}</span>
                  </div>
                )}
                {customer.aadhaarNumber && (
                  <div className="flex items-center gap-1.5 font-medium">
                    <UserCheck className="h-3.5 w-3.5 text-muted-foreground" />
                    <span className="font-mono text-foreground">Aadhaar: •••• {customer.aadhaarNumber.slice(-4)}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <button
                onClick={() => {
                  setEditFormData({
                    firstName: customer.firstName,
                    lastName: customer.lastName || '',
                    mobile: customer.mobile,
                    email: customer.email || '',
                    panNumber: customer.panNumber || '',
                    aadhaarNumber: customer.aadhaarNumber || '',
                    city: customer.city || '',
                    state: customer.state || '',
                    addressLine1: customer.addressLine1 || '',
                    pincode: customer.pincode || '',
                    isVip: customer.isVip,
                  });
                  setShowEditModal(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card hover:bg-accent text-xs font-semibold shadow-xs transition"
              >
                <Edit className="h-3.5 w-3.5" />
                <span>Edit Profile</span>
              </button>
              <button
                onClick={() => setShowNewLeadModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 shadow-xs transition"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Lead</span>
              </button>
            </div>
          </div>

          {/* Quick Metrics Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3 mt-6 pt-5 border-t border-border">
            <div className="p-3 rounded-xl bg-muted/40 border space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Active Policies</span>
              <div className="text-xl font-black text-foreground">{customer._count?.policies || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Vehicles</span>
              <div className="text-xl font-black text-foreground">{customer._count?.vehicles || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Quotations</span>
              <div className="text-xl font-black text-foreground">{customer._count?.quotations || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Pipeline Leads</span>
              <div className="text-xl font-black text-foreground">{customer._count?.leads || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Claims</span>
              <div className="text-xl font-black text-foreground">{customer._count?.claims || 0}</div>
            </div>
            <div className="p-3 rounded-xl bg-muted/40 border space-y-0.5">
              <span className="text-[10px] uppercase font-bold text-muted-foreground">Open Tasks</span>
              <div className="text-xl font-black text-foreground">{customer._count?.tasks || 0}</div>
            </div>
          </div>
        </div>

        {/* 2. Proactive Customer Alerts Banner (if any unread alerts) */}
        {unreadAlerts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-bold text-amber-600">
                <Bell className="h-4 w-4" />
                <span>Actionable Customer Alerts ({unreadAlerts.length})</span>
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {unreadAlerts.map((alert: any) => (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 ${
                    alert.severity === 'CRITICAL'
                      ? 'bg-rose-500/10 border-rose-500/30'
                      : alert.severity === 'HIGH'
                      ? 'bg-amber-500/10 border-amber-500/30'
                      : 'bg-primary/5 border-primary/20'
                  }`}
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                        alert.severity === 'CRITICAL'
                          ? 'bg-rose-600 text-white'
                          : alert.severity === 'HIGH'
                          ? 'bg-amber-600 text-white'
                          : 'bg-primary text-primary-foreground'
                      }`}>
                        {alert.alertType.replace('_', ' ')}
                      </span>
                      <h4 className="font-bold text-xs">{alert.title}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">{alert.message}</p>
                    <span className="text-[10px] text-muted-foreground">
                      {new Date(alert.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <button
                    onClick={() => readAlertMutation.mutate(alert.id)}
                    className="text-[10px] font-bold px-2 py-1 rounded border bg-card hover:bg-accent shadow-xs whitespace-nowrap"
                  >
                    Mark Read
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 3. Tabbed Navigation */}
        <div className="flex items-center gap-2 border-b border-border overflow-x-auto pb-2">
          {[
            { id: 'OVERVIEW', label: 'Overview', icon: <TrendingUp className="h-3.5 w-3.5" /> },
            { id: 'VEHICLES', label: 'Vehicles', icon: <Car className="h-3.5 w-3.5" />, count: customer.vehicles?.length },
            { id: 'QUOTATIONS', label: 'Quotations', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, count: customer.quotations?.length },
            { id: 'POLICIES', label: 'Policies', icon: <ShieldCheck className="h-3.5 w-3.5" />, count: customer.policies?.length },
            { id: 'LEADS', label: 'Leads', icon: <TrendingUp className="h-3.5 w-3.5" />, count: customer.leads?.length },
            { id: 'TASKS', label: 'Tasks', icon: <Clock className="h-3.5 w-3.5" />, count: customer.tasks?.length },
            { id: 'CLAIMS', label: 'Claims', icon: <FileText className="h-3.5 w-3.5" />, count: customer.claims?.length },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground font-bold shadow-xs'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent/60'
              }`}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {tab.count !== undefined && tab.count > 0 && (
                <span className={`px-1.5 py-0.2 rounded-full text-[10px] ${
                  activeTab === tab.id ? 'bg-primary-foreground/20 text-white' : 'bg-muted text-muted-foreground font-bold'
                }`}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* 4. Tab Content */}
        {activeTab === 'OVERVIEW' && (
          <div className="space-y-6">
            {/* Quick Leads & Active Policies in 2 Columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Active Pipeline Leads */}
              <div className="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-primary" />
                    <span>Pipeline Leads</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('LEADS')}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    View all <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                {(!customer.leads || customer.leads.length === 0) ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No active leads in pipeline.</p>
                ) : (
                  <div className="space-y-2.5">
                    {customer.leads.slice(0, 3).map((lead: any) => (
                      <div
                        key={lead.id}
                        onClick={() => router.push(`/crm/leads/${lead.id}`)}
                        className="p-3 rounded-lg border bg-muted/20 hover:bg-accent/40 cursor-pointer flex items-center justify-between gap-3 transition"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-bold text-foreground">{lead.leadCode || lead.title}</span>
                            <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-primary/10 text-primary">
                              {lead.status}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground truncate">{lead.title}</p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-muted-foreground shrink-0" />
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Registered Vehicles */}
              <div className="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-sm flex items-center gap-2">
                    <Car className="h-4 w-4 text-primary" />
                    <span>Vehicles on Record</span>
                  </h3>
                  <button
                    onClick={() => setActiveTab('VEHICLES')}
                    className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                  >
                    View all <ChevronRight className="h-3 w-3" />
                  </button>
                </div>
                {(!customer.vehicles || customer.vehicles.length === 0) ? (
                  <p className="text-xs text-muted-foreground py-4 text-center">No vehicles registered yet.</p>
                ) : (
                  <div className="space-y-2.5">
                    {customer.vehicles.slice(0, 3).map((v: any) => (
                      <div
                        key={v.id}
                        className="p-3 rounded-lg border bg-muted/20 flex items-center justify-between gap-3"
                      >
                        <div className="space-y-0.5 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-mono text-xs font-black tracking-wider px-2 py-0.5 rounded bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900">
                              {v.registrationNumber}
                            </span>
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase bg-blue-500/10 text-blue-600">
                              {v.vehicleCategory || v.category || 'VEHICLE'}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground">
                            {[v.make, v.model, v.variant, v.manufactureYear].filter(Boolean).join(' ')}
                          </p>
                        </div>
                        <button
                          onClick={() => router.push(`/sales/quotations/new?vehicleId=${v.id}&customerId=${customer.id}`)}
                          className="px-2.5 py-1 rounded bg-primary/10 text-primary text-[11px] font-bold hover:bg-primary/20 transition"
                        >
                          Quote
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Recent Quotations Comparison */}
            <div className="rounded-xl border bg-card p-5 space-y-4 shadow-xs">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-sm flex items-center gap-2">
                  <FileSpreadsheet className="h-4 w-4 text-primary" />
                  <span>Recent Motor Quotations</span>
                </h3>
                <button
                  onClick={() => setActiveTab('QUOTATIONS')}
                  className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
                >
                  View all <ChevronRight className="h-3 w-3" />
                </button>
              </div>
              {(!customer.quotations || customer.quotations.length === 0) ? (
                <p className="text-xs text-muted-foreground py-6 text-center">No motor quotations generated yet.</p>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {customer.quotations.slice(0, 3).map((q: any) => (
                    <div key={q.id} className="p-4 rounded-xl border bg-muted/10 space-y-2.5">
                      <div className="flex items-center justify-between">
                        <span className="font-mono text-xs font-bold">{q.quotationNumber}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                          q.status === 'ACCEPTED'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {q.status}
                        </span>
                      </div>
                      <div>
                        <h4 className="font-bold text-sm">{q.insurerName}</h4>
                        <span className="text-[11px] text-muted-foreground">{q.policyType} Plan</span>
                      </div>
                      <div className="flex items-center justify-between pt-2 border-t border-border">
                        <span className="text-xs text-muted-foreground">Final Premium</span>
                        <span className="text-base font-black text-foreground">₹{Number(q.finalPremium).toLocaleString('en-IN')}</span>
                      </div>
                      {q.status === 'SHARED' && (
                        <button
                          onClick={() => acceptQuoteMutation.mutate(q.id)}
                          className="w-full py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition"
                        >
                          Accept Quotation
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 5. Vehicles Tab (8-Category Motor Domain) */}
        {activeTab === 'VEHICLES' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Registered Motor Vehicles</h3>
                <p className="text-xs text-muted-foreground">8-category fleet supporting Bike, Private Car, GCV, Tractor, Auto, Taxi, Bus & Misc.</p>
              </div>
              <button
                onClick={() => setShowNewLeadModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Add Vehicle / Lead</span>
              </button>
            </div>

            {(!customer.vehicles || customer.vehicles.length === 0) ? (
              <div className="p-12 text-center rounded-xl border bg-card space-y-2">
                <Car className="h-8 w-8 text-muted-foreground mx-auto" />
                <h4 className="font-bold text-sm">No Vehicles Registered</h4>
                <p className="text-xs text-muted-foreground">This customer does not have any motor vehicles on record.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {customer.vehicles.map((v: any) => (
                  <div key={v.id} className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-black tracking-widest px-2.5 py-1 rounded bg-zinc-900 text-zinc-100 dark:bg-zinc-100 dark:text-zinc-900 border">
                        {v.registrationNumber}
                      </span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-blue-500/10 text-blue-600">
                        {v.vehicleCategory || v.category || 'MOTOR'}
                      </span>
                    </div>

                    <div className="space-y-1">
                      <h4 className="font-bold text-sm text-foreground">
                        {[v.make, v.model].filter(Boolean).join(' ') || 'Motor Vehicle'}
                      </h4>
                      <p className="text-xs text-muted-foreground">
                        {[v.variant, v.fuelType, v.manufactureYear].filter(Boolean).join(' • ')}
                      </p>
                    </div>

                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border text-muted-foreground">
                      <div>
                        <span className="block text-[10px] uppercase font-bold">RTO</span>
                        <span className="font-semibold text-foreground">{v.rto || '—'}</span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold">Engine / Chassis</span>
                        <span className="font-mono text-[11px] text-foreground truncate block">
                          {v.engineNumber || v.chassisNumber ? `${v.engineNumber || ''} / ${v.chassisNumber || ''}` : '—'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t border-border flex items-center gap-2">
                      <button
                        onClick={() => router.push(`/sales/quotations/new?vehicleId=${v.id}&customerId=${customer.id}`)}
                        className="flex-1 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition text-center"
                      >
                        Generate Quote
                      </button>
                      <button
                        onClick={() => router.push(`/sales/quotations?vehicleId=${v.id}`)}
                        className="px-3 py-1.5 rounded-lg border bg-card hover:bg-accent text-xs font-semibold transition"
                      >
                        Quotes
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 6. Quotations Tab */}
        {activeTab === 'QUOTATIONS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Motor Quotations</h3>
                <p className="text-xs text-muted-foreground">Multi-insurer comparison quotes generated for this customer.</p>
              </div>
            </div>

            {(!customer.quotations || customer.quotations.length === 0) ? (
              <div className="p-12 text-center rounded-xl border bg-card space-y-2">
                <FileSpreadsheet className="h-8 w-8 text-muted-foreground mx-auto" />
                <h4 className="font-bold text-sm">No Quotations Found</h4>
                <p className="text-xs text-muted-foreground">Generate a quotation from an active lead or registered vehicle.</p>
              </div>
            ) : (
              <div className="rounded-xl border bg-card overflow-hidden shadow-xs">
                <table className="w-full text-xs text-left">
                  <thead className="bg-muted/50 border-b border-border text-muted-foreground font-semibold">
                    <tr>
                      <th className="px-4 py-3">Quote #</th>
                      <th className="px-4 py-3">Insurer & Plan</th>
                      <th className="px-4 py-3">Type</th>
                      <th className="px-4 py-3">Agent Code</th>
                      <th className="px-4 py-3">Final Premium</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {customer.quotations.map((q: any) => (
                      <tr key={q.id} className="hover:bg-muted/20">
                        <td className="px-4 py-3 font-mono font-bold text-foreground">{q.quotationNumber}</td>
                        <td className="px-4 py-3">
                          <span className="font-bold text-foreground block">{q.insurerName}</span>
                          <span className="text-[11px] text-muted-foreground">{q.planName || 'Standard'}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary">
                            {q.policyType}
                          </span>
                        </td>
                        <td className="px-4 py-3 font-mono text-[11px] text-muted-foreground">
                          {q.agentCodeSnapshot || '—'}
                        </td>
                        <td className="px-4 py-3 font-bold text-foreground">
                          ₹{Number(q.finalPremium).toLocaleString('en-IN')}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                            q.status === 'ACCEPTED'
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-primary/10 text-primary'
                          }`}>
                            {q.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          {q.status === 'SHARED' && (
                            <button
                              onClick={() => acceptQuoteMutation.mutate(q.id)}
                              className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[11px]"
                            >
                              Accept
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* 7. Policies Tab */}
        {activeTab === 'POLICIES' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-base">Active & Historical Policies</h3>
              <p className="text-xs text-muted-foreground">Issued insurance policies under this customer's account.</p>
            </div>

            {(!customer.policies || customer.policies.length === 0) ? (
              <div className="p-12 text-center rounded-xl border bg-card space-y-2">
                <ShieldCheck className="h-8 w-8 text-muted-foreground mx-auto" />
                <h4 className="font-bold text-sm">No Policies Issued</h4>
                <p className="text-xs text-muted-foreground">Policies appear here once approved and issued by the back-office.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {customer.policies.map((p: any) => (
                  <div key={p.id} className="rounded-xl border bg-card p-4 space-y-3 shadow-xs">
                    <div className="flex items-center justify-between">
                      <span className="font-mono text-xs font-bold text-foreground">{p.policyNumber || 'POLICY-PENDING'}</span>
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600">
                        {p.status || 'ACTIVE'}
                      </span>
                    </div>
                    <div>
                      <h4 className="font-bold text-sm">{p.insurerName || 'Insurer'}</h4>
                      <span className="text-xs text-muted-foreground">{p.planName || 'Comprehensive Motor Policy'}</span>
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs pt-2 border-t border-border text-muted-foreground">
                      <div>
                        <span className="block text-[10px] uppercase font-bold">Policy Period</span>
                        <span>
                          {p.startDate ? new Date(p.startDate).toLocaleDateString() : '—'} to{' '}
                          {p.endDate ? new Date(p.endDate).toLocaleDateString() : '—'}
                        </span>
                      </div>
                      <div>
                        <span className="block text-[10px] uppercase font-bold">Total Premium</span>
                        <span className="font-bold text-foreground">
                          ₹{Number(p.finalPremium || p.premiumAmount || 0).toLocaleString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 8. Leads Tab */}
        {activeTab === 'LEADS' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Pipeline Opportunities & Leads</h3>
                <p className="text-xs text-muted-foreground">Track lead progression through the finite state lifecycle.</p>
              </div>
              <button
                onClick={() => setShowNewLeadModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary text-primary-foreground text-xs font-bold"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>New Lead</span>
              </button>
            </div>

            {(!customer.leads || customer.leads.length === 0) ? (
              <div className="p-12 text-center rounded-xl border bg-card space-y-2">
                <TrendingUp className="h-8 w-8 text-muted-foreground mx-auto" />
                <h4 className="font-bold text-sm">No Leads in Pipeline</h4>
                <p className="text-xs text-muted-foreground">Create a new lead to begin quotation and conversion.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customer.leads.map((l: any) => (
                  <div
                    key={l.id}
                    onClick={() => router.push(`/crm/leads/${l.id}`)}
                    className="p-4 rounded-xl border bg-card hover:bg-accent/30 cursor-pointer flex items-center justify-between gap-4 transition shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">{l.leadCode || 'LEAD'}</span>
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase bg-primary/10 text-primary">
                          {l.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm">{l.title}</h4>
                      <p className="text-xs text-muted-foreground">Created on {new Date(l.createdAt).toLocaleDateString()}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 9. Tasks Tab */}
        {activeTab === 'TASKS' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-base">Operational Tasks & Follow-ups</h3>
              <p className="text-xs text-muted-foreground">Tasks linked to this customer account across renewals, inspections, and follow-ups.</p>
            </div>

            {(!customer.tasks || customer.tasks.length === 0) ? (
              <div className="p-12 text-center rounded-xl border bg-card space-y-2">
                <Clock className="h-8 w-8 text-muted-foreground mx-auto" />
                <h4 className="font-bold text-sm">No Pending Tasks</h4>
                <p className="text-xs text-muted-foreground">All operational tasks for this customer are up to date.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customer.tasks.map((t: any) => (
                  <div
                    key={t.id}
                    className="p-4 rounded-xl border bg-card flex items-center justify-between gap-4 shadow-xs"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-foreground">{t.taskCode}</span>
                        <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${
                          t.priority === 'URGENT'
                            ? 'bg-rose-500/10 text-rose-600'
                            : t.priority === 'HIGH'
                            ? 'bg-amber-500/10 text-amber-600'
                            : 'bg-muted text-muted-foreground'
                        }`}>
                          {t.priority}
                        </span>
                        <span className="px-2 py-0.5 rounded text-[9px] font-black uppercase bg-primary/10 text-primary">
                          {t.status}
                        </span>
                      </div>
                      <h4 className="font-bold text-sm">{t.title}</h4>
                      {t.description && <p className="text-xs text-muted-foreground">{t.description}</p>}
                    </div>

                    {t.status !== 'COMPLETED' && (
                      <button
                        onClick={() => completeTaskMutation.mutate(t.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card hover:bg-emerald-50 text-xs font-bold text-emerald-700 transition"
                      >
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        <span>Complete</span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 10. Claims Tab */}
        {activeTab === 'CLAIMS' && (
          <div className="space-y-4">
            <div>
              <h3 className="font-bold text-base">Insurance Claims History</h3>
              <p className="text-xs text-muted-foreground">All motor and general claims filed under this customer.</p>
            </div>

            {(!customer.claims || customer.claims.length === 0) ? (
              <div className="p-12 text-center rounded-xl border bg-card space-y-2">
                <FileText className="h-8 w-8 text-muted-foreground mx-auto" />
                <h4 className="font-bold text-sm">No Claims Recorded</h4>
                <p className="text-xs text-muted-foreground">Zero claims filed under this customer account.</p>
              </div>
            ) : (
              <div className="space-y-3">
                {customer.claims.map((c: any) => (
                  <div key={c.id} className="p-4 rounded-xl border bg-card flex items-center justify-between gap-4 shadow-xs">
                    <div>
                      <span className="font-mono text-xs font-bold">{c.claimNumber}</span>
                      <h4 className="font-bold text-sm mt-1">{c.reason || 'Motor Claim'}</h4>
                      <p className="text-xs text-muted-foreground">Incident Date: {c.incidentDate ? new Date(c.incidentDate).toLocaleDateString() : '—'}</p>
                    </div>
                    <div className="text-right">
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-primary/10 text-primary">
                        {c.status}
                      </span>
                      <div className="text-sm font-bold mt-1">₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Edit Customer Profile Modal */}
        {showEditModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
            <div className="w-full max-w-lg rounded-2xl border bg-card p-6 shadow-xl space-y-5 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-lg font-bold">Edit Customer Profile</h3>
                  <p className="text-xs text-muted-foreground">Update permanent record for {customer.customerCode}</p>
                </div>
                <button
                  onClick={() => setShowEditModal(false)}
                  className="p-1 rounded-lg hover:bg-muted text-muted-foreground"
                >
                  ✕
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="font-semibold block mb-1">First Name *</label>
                  <input
                    type="text"
                    value={editFormData.firstName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, firstName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-background"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Last Name</label>
                  <input
                    type="text"
                    value={editFormData.lastName || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, lastName: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-background"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">Mobile (10 digits) *</label>
                  <input
                    type="text"
                    value={editFormData.mobile || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, mobile: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                    className="w-full px-3 py-2 rounded-lg border bg-background font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Email</label>
                  <input
                    type="email"
                    value={editFormData.email || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, email: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-background"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">PAN Number</label>
                  <input
                    type="text"
                    value={editFormData.panNumber || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, panNumber: e.target.value.toUpperCase() })}
                    className="w-full px-3 py-2 rounded-lg border bg-background font-mono uppercase"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Aadhaar Number</label>
                  <input
                    type="text"
                    value={editFormData.aadhaarNumber || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, aadhaarNumber: e.target.value.replace(/\D/g, '').slice(0, 12) })}
                    className="w-full px-3 py-2 rounded-lg border bg-background font-mono"
                  />
                </div>

                <div className="col-span-2">
                  <label className="font-semibold block mb-1">Address Line</label>
                  <input
                    type="text"
                    value={editFormData.addressLine1 || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, addressLine1: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-background"
                  />
                </div>

                <div>
                  <label className="font-semibold block mb-1">City</label>
                  <input
                    type="text"
                    value={editFormData.city || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-background"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Pincode</label>
                  <input
                    type="text"
                    value={editFormData.pincode || ''}
                    onChange={(e) => setEditFormData({ ...editFormData, pincode: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border bg-background font-mono"
                  />
                </div>

                <div className="col-span-2 flex items-center gap-2 pt-2">
                  <input
                    type="checkbox"
                    id="vip-check"
                    checked={editFormData.isVip || false}
                    onChange={(e) => setEditFormData({ ...editFormData, isVip: e.target.checked })}
                    className="rounded border-border"
                  />
                  <label htmlFor="vip-check" className="font-semibold cursor-pointer select-none">
                    Mark as VIP Customer (Priority Processing)
                  </label>
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-border">
                <button
                  onClick={() => setShowEditModal(false)}
                  className="px-4 py-2 rounded-lg border text-xs font-semibold hover:bg-muted"
                >
                  Cancel
                </button>
                <button
                  onClick={() => updateMutation.mutate(editFormData)}
                  disabled={updateMutation.isPending || !editFormData.firstName || !editFormData.mobile}
                  className="px-5 py-2 rounded-lg bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 disabled:opacity-50"
                >
                  {updateMutation.isPending ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
      {showNewLeadModal && (
        <NewLeadModal
          isOpen={true}
          onClose={() => setShowNewLeadModal(false)}
          defaultContactId={customer?.id}
          defaultName={fullName}
          defaultPhone={customer?.mobile || ''}
        />
      )}
    </AppShell>
  );
}
