'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { toast } from 'sonner';
import { AppShell } from '../../../components/layout/app-shell';
import {
  Users,
  Building2,
  PlusCircle,
  ShieldCheck,
  Power,
  Edit,
  Search,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Filter,
  FileText,
  BadgeCheck,
  Eye,
  ChevronRight,
  UserCheck,
  Percent,
  Briefcase,
  MapPin,
  RefreshCw,
  Clock,
  ExternalLink,
} from 'lucide-react';

export default function PosPartnerManagementPage() {
  const queryClient = useQueryClient();

  // Search & Filter State
  const [search, setSearch] = useState('');
  const [partnerTypeFilter, setPartnerTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedPartnerId, setSelectedPartnerId] = useState<string | null>(null);

  // Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailTab, setDetailTab] = useState<'overview' | 'agreements' | 'documents' | 'history'>('overview');

  // Form State - Registration
  const [partnerType, setPartnerType] = useState<'INDIVIDUAL' | 'CORPORATE'>('INDIVIDUAL');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [posCode, setPosCode] = useState('');
  const [panNumber, setPanNumber] = useState('');
  const [aadhaarNumber, setAadhaarNumber] = useState('');
  const [gstin, setGstin] = useState('');
  const [contactPersonName, setContactPersonName] = useState('');
  const [contactPersonPhone, setContactPersonPhone] = useState('');

  // Structured Address
  const [addressLine1, setAddressLine1] = useState('');
  const [addressLine2, setAddressLine2] = useState('');
  const [city, setCity] = useState('');
  const [stateName, setStateName] = useState('');
  const [pincode, setPincode] = useState('');

  // Insurer Mapping (1:1 locked per DEC-03)
  const [selectedInsurerId, setSelectedInsurerId] = useState('');
  const [insurerPartnerCode, setInsurerPartnerCode] = useState('');
  const [insurerPospId, setInsurerPospId] = useState('');

  // Commercial Agreement (DEC-05)
  const [productType, setProductType] = useState('MOTOR');
  const [commissionType, setCommissionType] = useState<'PERCENTAGE' | 'FIXED'>('PERCENTAGE');
  const [commissionRate, setCommissionRate] = useState('15');
  const [fixedAmount, setFixedAmount] = useState('0');

  // Remapping state
  const [showRemapModal, setShowRemapModal] = useState(false);
  const [remapInsurerId, setRemapInsurerId] = useState('');
  const [remapReason, setRemapReason] = useState('');

  // 1. Fetch Partner List
  const {
    data: partnerData,
    isLoading,
    isError,
    refetch,
  } = useQuery({
    queryKey: ['admin-pos-partners', search, partnerTypeFilter, statusFilter],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (search) params.append('search', search);
      if (partnerTypeFilter) params.append('partnerType', partnerTypeFilter);
      if (statusFilter) params.append('status', statusFilter);
      const res = await apiClient.get(`/pos-partners?${params.toString()}`);
      return res.data;
    },
  });

  // 2. Fetch Insurers Master for Mapping
  const { data: insurersList = [] } = useQuery({
    queryKey: ['admin-insurers-master'],
    queryFn: async () => {
      const res = await apiClient.get('/motor/rating/insurers');
      return Array.isArray(res.data) ? res.data : [];
    },
  });

  // 3. Fetch Selected Partner Detail
  const { data: partnerDetail, isLoading: isDetailLoading } = useQuery({
    queryKey: ['admin-pos-partner-detail', selectedPartnerId],
    queryFn: async () => {
      if (!selectedPartnerId) return null;
      const res = await apiClient.get(`/pos-partners/${selectedPartnerId}`);
      return res.data;
    },
    enabled: !!selectedPartnerId,
  });

  // 4. Fetch KPIs
  const { data: kpis } = useQuery({
    queryKey: ['admin-pos-kpis'],
    queryFn: async () => {
      const res = await apiClient.get('/pos-partners/kpis');
      return res.data || { total: 0, active: 0, suspended: 0, pendingVerification: 0 };
    },
  });

  // 5. Create Partner Mutation
  const createPartnerMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await apiClient.post('/pos-partners', payload);
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pos-partners'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pos-kpis'] });
      toast.success(`POS Partner '${data.name}' (${data.posCode}) registered and activated!`);
      setShowCreateModal(false);
      resetForm();
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to register POS partner');
    },
  });

  // 6. Update Status (Suspend / Reactivate)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, reason }: { id: string; status: string; reason?: string }) => {
      const res = await apiClient.patch(`/pos-partners/${id}/status`, { status, reason });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-pos-partners'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pos-kpis'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pos-partner-detail', data.id] });
      toast.success(`Partner status updated to ${data.status}`);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to update partner status');
    },
  });

  // 7. Remap Insurer Mutation
  const remapInsurerMutation = useMutation({
    mutationFn: async ({ id, insurerId, reason }: { id: string; insurerId: string; reason: string }) => {
      const res = await apiClient.patch(`/pos-partners/${id}/insurer-mapping`, {
        insurerId,
        reason,
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pos-partners'] });
      queryClient.invalidateQueries({ queryKey: ['admin-pos-partner-detail', selectedPartnerId] });
      toast.success('Partner remapped to new insurer successfully!');
      setShowRemapModal(false);
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to remap partner insurer');
    },
  });

  const resetForm = () => {
    setName('');
    setPhone('');
    setEmail('');
    setPosCode('');
    setPanNumber('');
    setAadhaarNumber('');
    setGstin('');
    setContactPersonName('');
    setContactPersonPhone('');
    setAddressLine1('');
    setAddressLine2('');
    setCity('');
    setStateName('');
    setPincode('');
    setSelectedInsurerId('');
    setInsurerPartnerCode('');
    setInsurerPospId('');
    setCommissionRate('15');
    setFixedAmount('0');
  };

  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) return toast.error('Partner Name is required');
    if (!phone.trim() || phone.trim().length !== 10) return toast.error('Valid 10-digit mobile number is required');
    if (!email.trim() || !email.includes('@')) return toast.error('Valid email address is required');
    if (!selectedInsurerId) return toast.error('Please select an Insurer (Mandatory DEC-03)');
    if (!addressLine1.trim() || !city.trim() || !stateName.trim() || !pincode.trim()) {
      return toast.error('Complete structured address is required');
    }
    if (pincode.replace(/\D/g, '').length !== 6) {
      return toast.error('Valid 6-digit Indian PIN code is required');
    }

    const payload: any = {
      partnerType,
      name: name.trim(),
      mobile: phone.trim(),
      email: email.trim(),
      posCode: posCode.trim() || undefined,
      panNumber: panNumber.trim().toUpperCase() || undefined,
      aadhaarNumber: partnerType === 'INDIVIDUAL' ? aadhaarNumber.trim() || undefined : undefined,
      gstNumber: partnerType === 'CORPORATE' ? gstin.trim().toUpperCase() || undefined : undefined,
      authorizedPersonName: partnerType === 'CORPORATE' ? contactPersonName.trim() || undefined : undefined,
      address: {
        addressLine1: addressLine1.trim(),
        addressLine2: addressLine2.trim() || undefined,
        city: city.trim(),
        state: stateName.trim(),
        pincode: pincode.trim(),
        country: 'India',
      },
      insurerId: selectedInsurerId,
      insurerPartnerCode: insurerPartnerCode.trim() || undefined,
      insurerPospId: insurerPospId.trim() || undefined,
      initialAgreement: {
        productType,
        commissionType,
        commissionRate: commissionType === 'PERCENTAGE' ? Number(commissionRate) : undefined,
        fixedAmount: commissionType === 'FIXED' ? Number(fixedAmount) : undefined,
      },
    };

    createPartnerMutation.mutate(payload);
  };

  const partners = partnerData?.items || partnerData?.data || [];
  const meta = partnerData?.meta || { total: partners.length };

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-emerald-500/10 via-teal-500/5 to-transparent border flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase font-bold text-emerald-600 dark:text-emerald-400 tracking-wider">
              Distribution Channels • Point of Sales Operations
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
              POS Partner Management
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-2xl leading-relaxed">
              Register and manage Individual & Corporate Point of Sales (POS) partners, enforce 1:1 insurer associations (DEC-03), record commercial terms, and monitor mandatory policy attribution (DEC-02).
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={() => refetch()}
              className="p-2.5 rounded-xl border bg-card hover:bg-muted text-muted-foreground transition-all"
              title="Refresh List"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
            <button
              onClick={() => {
                resetForm();
                setShowCreateModal(true);
              }}
              className="px-4 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold flex items-center space-x-1.5 shadow-sm hover:bg-emerald-700 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Register New POS Partner</span>
            </button>
          </div>
        </div>

        {/* KPI Cards Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-muted-foreground uppercase">Total POS Partners</div>
              <div className="text-2xl font-black text-foreground mt-0.5">{kpis?.total ?? meta.total ?? 0}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-primary/10 text-primary">
              <Users className="h-5 w-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase">Active Partners</div>
              <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">{kpis?.active ?? 0}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <BadgeCheck className="h-5 w-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-amber-600 dark:text-amber-400 uppercase">Suspended Partners</div>
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 mt-0.5">{kpis?.suspended ?? 0}</div>
            </div>
            <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertTriangle className="h-5 w-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl border bg-card/60 backdrop-blur-xs flex items-center justify-between">
            <div>
              <div className="text-[10px] font-bold text-blue-600 dark:text-blue-400 uppercase">Verified KYC</div>
              <div className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-0.5">
                {partners.filter((p: any) => p.verificationStatus === 'VERIFIED').length}
              </div>
            </div>
            <div className="p-2.5 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
              <ShieldCheck className="h-5 w-5" />
            </div>
          </div>
        </div>

        {/* Filter & Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-2xl border bg-card">
          <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[280px]">
            <div className="relative max-w-xs w-full">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-muted-foreground" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search POS code, name, phone, email..."
                className="w-full pl-8.5 pr-3 py-1.5 text-xs rounded-xl border bg-background focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            <select
              value={partnerTypeFilter}
              onChange={(e) => setPartnerTypeFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border bg-background focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">All Types</option>
              <option value="INDIVIDUAL">Individual</option>
              <option value="CORPORATE">Corporate</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs rounded-xl border bg-background focus:ring-1 focus:ring-emerald-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">Active</option>
              <option value="SUSPENDED">Suspended</option>
              <option value="TERMINATED">Terminated</option>
            </select>
          </div>

          <div className="text-xs font-medium text-muted-foreground">
            Showing <span className="font-bold text-foreground">{partners.length}</span> partners
          </div>
        </div>

        {/* Partners Table */}
        <div className="border rounded-2xl bg-card overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground animate-pulse">
              Loading POS Partners Registry...
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-xs text-rose-500">
              Failed to load POS partners. Please try again.
            </div>
          ) : partners.length === 0 ? (
            <div className="p-16 text-center space-y-3">
              <Users className="h-10 w-10 text-muted-foreground mx-auto" />
              <h3 className="text-sm font-bold text-foreground">No POS Partners Found</h3>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                No Point of Sales partners match your current filters. Register an Individual or Corporate partner to begin.
              </p>
              <button
                onClick={() => {
                  resetForm();
                  setShowCreateModal(true);
                }}
                className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
              >
                Register First Partner
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-muted/50 border-b text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                  <tr>
                    <th className="py-3 px-4">Partner Code & Name</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Contact</th>
                    <th className="py-3 px-4">Mapped Insurer (1:1)</th>
                    <th className="py-3 px-4">Address</th>
                    <th className="py-3 px-4">KYC Status</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {partners.map((partner: any) => {
                    const insurer = partner.insurerMapping?.insurer;
                    const isSuspended = partner.status === 'SUSPENDED';

                    return (
                      <tr key={partner.id} className="hover:bg-muted/30 transition-colors">
                        <td className="py-3.5 px-4">
                          <div className="flex items-center space-x-2">
                            <div className="font-mono font-bold text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded text-[11px]">
                              {partner.posCode}
                            </div>
                            <span className="font-bold text-foreground">{partner.name}</span>
                          </div>
                          {partner.panNumber && (
                            <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                              PAN: {partner.panNumber}
                            </div>
                          )}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              partner.partnerType === 'CORPORATE'
                                ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20'
                                : 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                            }`}
                          >
                            {partner.partnerType === 'CORPORATE' ? (
                              <Building2 className="h-3 w-3 mr-1" />
                            ) : (
                              <Users className="h-3 w-3 mr-1" />
                            )}
                            {partner.partnerType}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <div className="font-medium text-foreground">{partner.phone}</div>
                          <div className="text-[11px] text-muted-foreground truncate max-w-[150px]">
                            {partner.email}
                          </div>
                        </td>

                        <td className="py-3.5 px-4">
                          {insurer ? (
                            <div>
                              <div className="font-bold text-foreground flex items-center space-x-1">
                                <span>{insurer.name}</span>
                              </div>
                              <div className="text-[10px] text-muted-foreground font-mono">
                                Code: {insurer.code}
                                {partner.insurerMapping.insurerPartnerCode && (
                                  <span> • P-Code: {partner.insurerMapping.insurerPartnerCode}</span>
                                )}
                              </div>
                            </div>
                          ) : (
                            <span className="text-[10px] font-bold text-rose-500 bg-rose-500/10 px-2 py-0.5 rounded">
                              Unmapped
                            </span>
                          )}
                        </td>

                        <td className="py-3.5 px-4 text-muted-foreground">
                          {partner.city}, {partner.state} {partner.pincode && `• ${partner.pincode}`}
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              partner.verificationStatus === 'VERIFIED'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : partner.verificationStatus === 'REJECTED'
                                ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                            }`}
                          >
                            {partner.verificationStatus}
                          </span>
                        </td>

                        <td className="py-3.5 px-4">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              partner.status === 'ACTIVE'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                                : partner.status === 'SUSPENDED'
                                ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                                : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                            }`}
                          >
                            <span
                              className={`h-1.5 w-1.5 rounded-full mr-1.5 ${
                                partner.status === 'ACTIVE'
                                  ? 'bg-emerald-500'
                                  : partner.status === 'SUSPENDED'
                                  ? 'bg-amber-500'
                                  : 'bg-slate-500'
                              }`}
                            />
                            {partner.status}
                          </span>
                        </td>

                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end space-x-1.5">
                            <button
                              onClick={() => {
                                setSelectedPartnerId(partner.id);
                                setShowDetailModal(true);
                              }}
                              className="p-1.5 rounded-lg border hover:bg-muted text-foreground transition-all"
                              title="View Partner Portfolio & Agreements"
                            >
                              <Eye className="h-3.5 w-3.5" />
                            </button>

                            <button
                              onClick={() => {
                                const nextStatus = isSuspended ? 'ACTIVE' : 'SUSPENDED';
                                const reason = isSuspended
                                  ? 'Reactivated by administrator'
                                  : 'Suspended by administrator via governance workbench';
                                updateStatusMutation.mutate({ id: partner.id, status: nextStatus, reason });
                              }}
                              className={`p-1.5 rounded-lg border transition-all ${
                                isSuspended
                                  ? 'text-emerald-600 hover:bg-emerald-500/10 border-emerald-500/20'
                                  : 'text-amber-600 hover:bg-amber-500/10 border-amber-500/20'
                              }`}
                              title={isSuspended ? 'Reactivate Partner' : 'Suspend Partner'}
                            >
                              <Power className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── CREATE PARTNER MODAL ── */}
        {showCreateModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card border rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
              <div className="flex items-center justify-between border-b pb-4">
                <div>
                  <h3 className="text-base font-bold text-foreground">Register New POS Partner</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Individual or Corporate POS partner with 1:1 insurer association & structured address
                  </p>
                </div>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateSubmit} className="space-y-6">
                {/* Section A: Type & Basic Info */}
                <div className="space-y-3">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    Section A • Partner Classification (DEC-01)
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setPartnerType('INDIVIDUAL')}
                      className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition-all ${
                        partnerType === 'INDIVIDUAL'
                          ? 'border-emerald-500 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Users className="h-5 w-5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">Individual POSP</div>
                        <div className="text-[10px] opacity-80">Certified Individual Agent</div>
                      </div>
                    </button>

                    <button
                      type="button"
                      onClick={() => setPartnerType('CORPORATE')}
                      className={`p-3 rounded-2xl border text-left flex items-center space-x-3 transition-all ${
                        partnerType === 'CORPORATE'
                          ? 'border-purple-500 bg-purple-500/10 text-purple-600 dark:text-purple-400 font-bold'
                          : 'border-border text-muted-foreground hover:bg-muted'
                      }`}
                    >
                      <Building2 className="h-5 w-5 shrink-0" />
                      <div>
                        <div className="text-xs font-bold">Corporate POSP</div>
                        <div className="text-[10px] opacity-80">Franchise / Corporate Entity</div>
                      </div>
                    </button>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-foreground">
                        {partnerType === 'CORPORATE' ? 'Corporate Entity Name *' : 'Full Name (as per PAN) *'}
                      </label>
                      <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={partnerType === 'CORPORATE' ? 'ABC Motors Pvt Ltd' : 'Rajesh Kumar'}
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-foreground">Custom POS Code (Optional)</label>
                      <input
                        type="text"
                        value={posCode}
                        onChange={(e) => setPosCode(e.target.value.toUpperCase())}
                        placeholder="Auto-generated if blank (e.g. POS-IND-100001)"
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-foreground">Mobile Phone (10 digits) *</label>
                      <input
                        type="tel"
                        maxLength={10}
                        value={phone}
                        onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                        placeholder="9876543210"
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-foreground">Email Address *</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="partner@example.com"
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background"
                        required
                      />
                    </div>
                  </div>
                </div>

                {/* Section B: Tax & Statutory */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    Section B • Statutory & Compliance Identifiers
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-foreground">PAN Number</label>
                      <input
                        type="text"
                        maxLength={10}
                        value={panNumber}
                        onChange={(e) => setPanNumber(e.target.value.toUpperCase())}
                        placeholder="ABCDE1234F"
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background font-mono uppercase"
                      />
                    </div>

                    {partnerType === 'INDIVIDUAL' ? (
                      <div>
                        <label className="text-[11px] font-bold text-foreground">Aadhaar (Last 4 Digits)</label>
                        <input
                          type="text"
                          maxLength={4}
                          value={aadhaarNumber}
                          onChange={(e) => setAadhaarNumber(e.target.value.replace(/\D/g, ''))}
                          placeholder="1234"
                          className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background font-mono"
                        />
                      </div>
                    ) : (
                      <div>
                        <label className="text-[11px] font-bold text-foreground">GSTIN</label>
                        <input
                          type="text"
                          maxLength={15}
                          value={gstin}
                          onChange={(e) => setGstin(e.target.value.toUpperCase())}
                          placeholder="27ABCDE1234F1Z5"
                          className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background font-mono uppercase"
                        />
                      </div>
                    )}

                    {partnerType === 'CORPORATE' && (
                      <>
                        <div>
                          <label className="text-[11px] font-bold text-foreground">Contact Person Name</label>
                          <input
                            type="text"
                            value={contactPersonName}
                            onChange={(e) => setContactPersonName(e.target.value)}
                            placeholder="Authorized Signatory"
                            className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background"
                          />
                        </div>
                        <div>
                          <label className="text-[11px] font-bold text-foreground">Contact Person Phone</label>
                          <input
                            type="tel"
                            maxLength={10}
                            value={contactPersonPhone}
                            onChange={(e) => setContactPersonPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="9876543210"
                            className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background font-mono"
                          />
                        </div>
                      </>
                    )}
                  </div>
                </div>

                {/* Section C: Structured Address */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    Section C • Structured Office / Physical Address (DEC-06)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-foreground">Address Line 1 *</label>
                      <input
                        type="text"
                        value={addressLine1}
                        onChange={(e) => setAddressLine1(e.target.value)}
                        placeholder="Plot No / Building / Street"
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background"
                        required
                      />
                    </div>

                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-bold text-foreground">Address Line 2 (Optional)</label>
                      <input
                        type="text"
                        value={addressLine2}
                        onChange={(e) => setAddressLine2(e.target.value)}
                        placeholder="Locality, Landmark"
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-foreground">City *</label>
                      <input
                        type="text"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        placeholder="Mumbai"
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-foreground">State *</label>
                      <input
                        type="text"
                        value={stateName}
                        onChange={(e) => setStateName(e.target.value)}
                        placeholder="Maharashtra"
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-foreground">Pincode (6 digits) *</label>
                      <input
                        type="text"
                        maxLength={6}
                        value={pincode}
                        onChange={(e) => setPincode(e.target.value.replace(/\D/g, ''))}
                        placeholder="400001"
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background font-mono"
                        required
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-foreground">Country</label>
                      <input
                        type="text"
                        disabled
                        value="India"
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-muted text-muted-foreground"
                      />
                    </div>
                  </div>
                </div>

                {/* Section D: Single Insurer Association (DEC-03) */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="flex items-center justify-between">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                      Section D • Insurer Association (DEC-03: 1:1 Invariant)
                    </div>
                    <span className="text-[10px] font-bold bg-amber-500/10 text-amber-600 px-2 py-0.5 rounded">
                      Single Insurer Exclusive
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="sm:col-span-1">
                      <label className="text-[11px] font-bold text-foreground">Mapped Partner Insurer *</label>
                      <select
                        value={selectedInsurerId}
                        onChange={(e) => setSelectedInsurerId(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background font-medium"
                        required
                      >
                        <option value="">Select Insurer Master...</option>
                        {insurersList.map((ins: any) => (
                          <option key={ins.id} value={ins.id}>
                            {ins.name} ({ins.code})
                          </option>
                        ))}
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-foreground">Partner Code at Insurer</label>
                      <input
                        type="text"
                        value={insurerPartnerCode}
                        onChange={(e) => setInsurerPartnerCode(e.target.value)}
                        placeholder="e.g. HDFC-POS-099"
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background font-mono"
                      />
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-foreground">Insurer POSP ID</label>
                      <input
                        type="text"
                        value={insurerPospId}
                        onChange={(e) => setInsurerPospId(e.target.value)}
                        placeholder="e.g. POSP-77621"
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background font-mono"
                      />
                    </div>
                  </div>
                </div>

                {/* Section E: Initial Commercial Agreement (DEC-05) */}
                <div className="space-y-3 pt-2 border-t">
                  <div className="text-[11px] font-bold uppercase tracking-wider text-primary">
                    Section E • Commercial Agreement Terms (DEC-05)
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="text-[11px] font-bold text-foreground">Product Type</label>
                      <select
                        value={productType}
                        onChange={(e) => setProductType(e.target.value)}
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background"
                      >
                        <option value="MOTOR">Motor Insurance</option>
                        <option value="HEALTH">Health Insurance</option>
                        <option value="LIFE">Life Insurance</option>
                        <option value="GENERAL">General Insurance</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-foreground">Commission Structure</label>
                      <select
                        value={commissionType}
                        onChange={(e) => setCommissionType(e.target.value as any)}
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background"
                      >
                        <option value="PERCENTAGE">Percentage (%)</option>
                        <option value="FIXED">Fixed Amount (₹)</option>
                      </select>
                    </div>

                    <div>
                      <label className="text-[11px] font-bold text-foreground">
                        {commissionType === 'PERCENTAGE' ? 'Commission Rate (%)' : 'Fixed Fee (₹)'}
                      </label>
                      <input
                        type="number"
                        step="0.1"
                        value={commissionType === 'PERCENTAGE' ? commissionRate : fixedAmount}
                        onChange={(e) =>
                          commissionType === 'PERCENTAGE'
                            ? setCommissionRate(e.target.value)
                            : setFixedAmount(e.target.value)
                        }
                        className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background font-mono"
                      />
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-4 py-2 rounded-xl border text-xs font-bold hover:bg-muted"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createPartnerMutation.isPending}
                    className="px-5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 shadow-sm disabled:opacity-50"
                  >
                    {createPartnerMutation.isPending ? 'Registering & Activating...' : 'Register & Activate Partner'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── PARTNER DETAIL MODAL / DRAWER ── */}
        {showDetailModal && partnerDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card border rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl p-6 space-y-6">
              <div className="flex items-start justify-between border-b pb-4">
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="font-mono text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 rounded">
                      {partnerDetail.posCode}
                    </span>
                    <h3 className="text-lg font-black text-foreground">{partnerDetail.name}</h3>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        partnerDetail.status === 'ACTIVE'
                          ? 'bg-emerald-500/10 text-emerald-600'
                          : 'bg-amber-500/10 text-amber-600'
                      }`}
                    >
                      {partnerDetail.status}
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground mt-1 flex items-center space-x-4">
                    <span>{partnerDetail.phone}</span>
                    <span>•</span>
                    <span>{partnerDetail.email}</span>
                    <span>•</span>
                    <span>{partnerDetail.partnerType}</span>
                  </div>
                </div>

                <button
                  onClick={() => setShowDetailModal(false)}
                  className="p-1.5 rounded-full hover:bg-muted text-muted-foreground"
                >
                  <XCircle className="h-5 w-5" />
                </button>
              </div>

              {/* Tabs */}
              <div className="flex border-b space-x-4 text-xs font-bold">
                <button
                  onClick={() => setDetailTab('overview')}
                  className={`pb-2 transition-all ${
                    detailTab === 'overview'
                      ? 'border-b-2 border-emerald-500 text-emerald-600'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Overview & Insurer
                </button>
                <button
                  onClick={() => setDetailTab('agreements')}
                  className={`pb-2 transition-all ${
                    detailTab === 'agreements'
                      ? 'border-b-2 border-emerald-500 text-emerald-600'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Commercial Agreements ({partnerDetail.commissionAgreements?.length || 0})
                </button>
                <button
                  onClick={() => setDetailTab('documents')}
                  className={`pb-2 transition-all ${
                    detailTab === 'documents'
                      ? 'border-b-2 border-emerald-500 text-emerald-600'
                      : 'text-muted-foreground hover:text-foreground'
                  }`}
                >
                  Documents ({partnerDetail.documents?.length || 0})
                </button>
              </div>

              {/* Tab: Overview */}
              {detailTab === 'overview' && (
                <div className="space-y-6">
                  {/* Insurer Mapping Banner */}
                  <div className="p-4 rounded-2xl border bg-muted/30 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-bold text-muted-foreground uppercase">
                        Active Insurer Mapping (1:1 Locked DEC-03)
                      </div>
                      <div className="text-base font-bold text-foreground mt-0.5">
                        {partnerDetail.insurerMapping?.insurer?.name || 'No Insurer Mapped'}
                      </div>
                      {partnerDetail.insurerMapping && (
                        <div className="text-xs text-muted-foreground mt-0.5 font-mono">
                          Insurer Code: {partnerDetail.insurerMapping.insurer?.code}
                          {partnerDetail.insurerMapping.insurerPartnerCode &&
                            ` • Partner Code: ${partnerDetail.insurerMapping.insurerPartnerCode}`}
                        </div>
                      )}
                    </div>

                    <button
                      onClick={() => setShowRemapModal(true)}
                      className="px-3 py-1.5 rounded-xl border bg-background hover:bg-muted text-xs font-bold"
                    >
                      Authorize Remap
                    </button>
                  </div>

                  {/* Address & Identifiers */}
                  <div className="grid grid-cols-2 gap-4 text-xs">
                    <div className="p-4 rounded-2xl border bg-card space-y-2">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">Structured Address</div>
                      <div className="font-medium text-foreground">
                        {partnerDetail.addressLine1}
                        {partnerDetail.addressLine2 && `, ${partnerDetail.addressLine2}`}
                      </div>
                      <div className="text-muted-foreground">
                        {partnerDetail.city}, {partnerDetail.state} - {partnerDetail.pincode}
                      </div>
                      <div className="text-muted-foreground">{partnerDetail.country || 'India'}</div>
                    </div>

                    <div className="p-4 rounded-2xl border bg-card space-y-2">
                      <div className="text-[10px] font-bold uppercase text-muted-foreground">Tax & Statutory Data</div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">PAN:</span>
                        <span className="font-mono font-bold text-foreground">{partnerDetail.panNumber || 'N/A'}</span>
                      </div>
                      {partnerDetail.partnerType === 'INDIVIDUAL' ? (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Aadhaar (Last 4):</span>
                          <span className="font-mono font-bold text-foreground">
                            {partnerDetail.aadhaarNumber || 'N/A'}
                          </span>
                        </div>
                      ) : (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">GSTIN:</span>
                          <span className="font-mono font-bold text-foreground">{partnerDetail.gstin || 'N/A'}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Created:</span>
                        <span className="text-foreground">
                          {new Date(partnerDetail.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Attributed Policies */}
                  <div className="border rounded-2xl p-4 space-y-2">
                    <div className="text-xs font-bold text-foreground">Attributed Policies Portfolio</div>
                    <p className="text-[11px] text-muted-foreground">
                      Policies issued through this POS Partner with snapshot verification (DEC-02).
                    </p>
                    <div className="text-xs text-muted-foreground py-2 font-medium">
                      Total Attributed Policies:{' '}
                      <span className="font-bold text-foreground">
                        {partnerDetail.policies?.length || 0}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* Tab: Agreements */}
              {detailTab === 'agreements' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-foreground">Commercial Agreements</div>
                  {partnerDetail.commissionAgreements?.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground border rounded-2xl">
                      No commercial agreements recorded yet.
                    </div>
                  ) : (
                    <div className="border rounded-2xl overflow-hidden">
                      <table className="w-full text-left text-xs">
                        <thead className="bg-muted/50 border-b text-[10px] font-bold text-muted-foreground uppercase">
                          <tr>
                            <th className="py-2.5 px-3">Product Line</th>
                            <th className="py-2.5 px-3">Insurer</th>
                            <th className="py-2.5 px-3">Type</th>
                            <th className="py-2.5 px-3">Rate / Amount</th>
                            <th className="py-2.5 px-3">Effective Period</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                          {partnerDetail.commissionAgreements?.map((ag: any) => (
                            <tr key={ag.id}>
                              <td className="py-2.5 px-3 font-bold">{ag.productType}</td>
                              <td className="py-2.5 px-3">{ag.insurer?.name || 'Mapped Insurer'}</td>
                              <td className="py-2.5 px-3">{ag.commissionType}</td>
                              <td className="py-2.5 px-3 font-mono font-bold text-emerald-600">
                                {ag.commissionType === 'PERCENTAGE'
                                  ? `${Number(ag.commissionRate)}%`
                                  : `₹${Number(ag.fixedAmount).toLocaleString('en-IN')}`}
                              </td>
                              <td className="py-2.5 px-3 text-muted-foreground">
                                {new Date(ag.effectiveFrom).toLocaleDateString('en-IN')}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab: Documents */}
              {detailTab === 'documents' && (
                <div className="space-y-3">
                  <div className="text-xs font-bold text-foreground">Compliance & KYC Documents</div>
                  {partnerDetail.documents?.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground border rounded-2xl">
                      No documents uploaded for this partner.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {partnerDetail.documents?.map((doc: any) => (
                        <div key={doc.id} className="p-3 border rounded-xl flex items-center justify-between text-xs">
                          <div>
                            <div className="font-bold text-foreground">{doc.documentType}</div>
                            <div className="text-[10px] text-muted-foreground">{doc.fileName}</div>
                          </div>
                          <span
                            className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                              doc.verificationStatus === 'VERIFIED'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : 'bg-amber-500/10 text-amber-600'
                            }`}
                          >
                            {doc.verificationStatus}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── REMAP INSURER MODAL ── */}
        {showRemapModal && partnerDetail && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-background/80 backdrop-blur-sm">
            <div className="bg-card border rounded-3xl max-w-md w-full shadow-2xl p-6 space-y-4">
              <div className="flex items-center justify-between border-b pb-3">
                <h3 className="text-sm font-bold text-foreground">Authorize Insurer Remap</h3>
                <button onClick={() => setShowRemapModal(false)}>
                  <XCircle className="h-4 w-4 text-muted-foreground" />
                </button>
              </div>

              <p className="text-xs text-muted-foreground">
                Current mapped insurer:{' '}
                <span className="font-bold text-foreground">
                  {partnerDetail.insurerMapping?.insurer?.name || 'None'}
                </span>
                . Selecting a new insurer will update the 1:1 association with an audit log.
              </p>

              <div className="space-y-3">
                <div>
                  <label className="text-[11px] font-bold text-foreground">Select New Insurer *</label>
                  <select
                    value={remapInsurerId}
                    onChange={(e) => setRemapInsurerId(e.target.value)}
                    className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background"
                  >
                    <option value="">Select Insurer...</option>
                    {insurersList.map((ins: any) => (
                      <option key={ins.id} value={ins.id}>
                        {ins.name} ({ins.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-bold text-foreground">Remap Authorization Reason *</label>
                  <input
                    type="text"
                    value={remapReason}
                    onChange={(e) => setRemapReason(e.target.value)}
                    placeholder="e.g. Agency re-contracting approved by compliance"
                    className="w-full mt-1 px-3 py-2 text-xs rounded-xl border bg-background"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t">
                <button
                  onClick={() => setShowRemapModal(false)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-bold"
                >
                  Cancel
                </button>
                <button
                  disabled={!remapInsurerId || !remapReason || remapInsurerMutation.isPending}
                  onClick={() =>
                    remapInsurerMutation.mutate({
                      id: partnerDetail.id,
                      insurerId: remapInsurerId,
                      reason: remapReason,
                    })
                  }
                  className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold disabled:opacity-50"
                >
                  {remapInsurerMutation.isPending ? 'Remapping...' : 'Confirm Remap'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
