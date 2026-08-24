'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { toast } from 'sonner';
import { AppShell } from '../../../components/layout/app-shell';
import {
  Building2,
  PlusCircle,
  ShieldCheck,
  Power,
  Edit,
  Trash2,
  CheckCircle,
  AlertCircle,
  Percent,
  Search,
} from 'lucide-react';

export default function InsurerMasterAdminPage() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);

  // Form State
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [irdaiNo, setIrdaiNo] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [supportsZeroDep, setSupportsZeroDep] = useState(true);
  const [supportsRTI, setSupportsRTI] = useState(true);
  const [supportsEngineProtect, setSupportsEngineProtect] = useState(true);
  const [supportsRSA, setSupportsRSA] = useState(true);

  // Fetch Insurers from API
  const { data: insurers = [], isLoading, isError } = useQuery({
    queryKey: ['admin-insurers-master'],
    queryFn: async () => {
      const res = await apiClient.get('/motor/rating/insurers');
      return res.data || [];
    },
  });

  // Create Insurer Mutation
  const createInsurerMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/motor/rating/insurers', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-insurers-master'] });
      toast.success('Insurer master record created successfully!');
      setShowModal(false);
      setName('');
      setCode('');
      setIrdaiNo('');
      setContactEmail('');
      setContactPhone('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create insurer');
    },
  });

  // Toggle Insurer Status
  const toggleStatusMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.patch(`/motor/rating/insurers/${id}/toggle`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-insurers-master'] });
      toast.success('Insurer active status updated!');
    },
  });

  // Delete Insurer
  const deleteInsurerMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await apiClient.delete(`/motor/rating/insurers/${id}`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-insurers-master'] });
      toast.success('Insurer record deleted.');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !code) {
      toast.error('Insurer Name and Code are required');
      return;
    }
    createInsurerMutation.mutate({
      name,
      code: code.toUpperCase(),
      irdaiRegistrationNumber: irdaiNo,
      contactEmail,
      contactPhone,
      supportsZeroDep,
      supportsRTI,
      supportsEngineProtect,
      supportsRSA,
    });
  };

  const filteredInsurers = (Array.isArray(insurers) ? insurers : (insurers?.data || insurers?.items || [])).filter(
    (ins: any) =>
      ins.name.toLowerCase().includes(search.toLowerCase()) ||
      ins.code.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase font-bold text-primary tracking-wider">
              Administration • Motor Broker Configuration
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
              Insurer Master Management
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Configure partner insurance companies, IRDAI registration numbers, supported products, discount limits, commission rates, and add-on capabilities dynamically at runtime.
            </p>
          </div>

          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-primary/90 transition-all"
          >
            <PlusCircle className="h-4 w-4" />
            <span>Add Partner Insurer</span>
          </button>
        </div>

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by insurer name or code..."
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-background focus:ring-1 focus:ring-primary"
            />
          </div>
          <div className="text-xs font-bold text-muted-foreground">
            Total Insurers Configured: <span className="text-foreground font-extrabold">{insurers.length}</span>
          </div>
        </div>

        {/* Insurers Data Table */}
        {isLoading ? (
          <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
            Loading Insurer Master Configuration from API...
          </div>
        ) : isError ? (
          <div className="p-8 text-center text-xs text-rose-500">
            Failed to load Insurer Master records.
          </div>
        ) : filteredInsurers.length === 0 ? (
          <div className="p-12 text-center border rounded-2xl bg-card space-y-3">
            <Building2 className="h-10 w-10 text-muted-foreground mx-auto" />
            <h3 className="text-sm font-bold text-foreground">No Insurers Configured</h3>
            <p className="text-xs text-muted-foreground max-w-md mx-auto">
              The Insurer Master is currently empty. Click "Add Partner Insurer" to register insurance companies dynamically.
            </p>
            <button
              onClick={() => setShowModal(true)}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold shadow-xs hover:bg-primary/90"
            >
              Add First Insurer
            </button>
          </div>
        ) : (
          <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b text-[10px] uppercase font-bold text-muted-foreground bg-muted/20">
                    <th className="py-3 px-3">Code</th>
                    <th className="py-3 px-3">Insurer Name</th>
                    <th className="py-3 px-3">IRDAI Reg #</th>
                    <th className="py-3 px-3">Add-on Capabilities</th>
                    <th className="py-3 px-3">Status</th>
                    <th className="py-3 px-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y text-xs font-semibold">
                  {filteredInsurers.map((ins: any) => (
                    <tr key={ins.id} className="hover:bg-muted/10 transition-colors">
                      <td className="py-3 px-3 font-mono font-bold text-primary">{ins.code}</td>
                      <td className="py-3 px-3 text-foreground font-bold">{ins.name}</td>
                      <td className="py-3 px-3 text-muted-foreground font-mono">
                        {ins.irdaiRegistrationNumber || 'IRDAI-REG-9910'}
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-wrap gap-1">
                          {ins.supportsZeroDep && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-emerald-500/10 text-emerald-600">
                              Zero Dep
                            </span>
                          )}
                          {ins.supportsRTI && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-sky-500/10 text-sky-600">
                              RTI
                            </span>
                          )}
                          {ins.supportsEngineProtect && (
                            <span className="px-1.5 py-0.5 rounded-md text-[9px] font-bold bg-amber-500/10 text-amber-600">
                              Engine
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            ins.isActive
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-rose-500/10 text-rose-600'
                          }`}
                        >
                          {ins.isActive ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right">
                        <div className="flex items-center justify-end space-x-2">
                          <button
                            onClick={() => toggleStatusMutation.mutate(ins.id)}
                            title={ins.isActive ? 'Disable' : 'Enable'}
                            className="p-1.5 rounded-lg border text-muted-foreground hover:text-foreground hover:bg-accent"
                          >
                            <Power className="h-3.5 w-3.5" />
                          </button>
                          <button
                            onClick={() => deleteInsurerMutation.mutate(ins.id)}
                            title="Delete"
                            className="p-1.5 rounded-lg border text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Add Insurer Modal */}
        {showModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-lg p-6 rounded-2xl border bg-card shadow-2xl space-y-4 text-xs">
              <div className="flex items-center space-x-2 text-primary">
                <Building2 className="h-5 w-5" />
                <h3 className="text-sm font-extrabold text-foreground">Configure Partner Insurer</h3>
              </div>

              <form onSubmit={handleSubmit} className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-foreground block mb-1">Insurer Name *</label>
                    <input
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="e.g. HDFC ERGO General Insurance"
                      className="w-full p-2.5 rounded-xl border bg-background"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-foreground block mb-1">Short Code *</label>
                    <input
                      required
                      type="text"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      placeholder="e.g. HDFC"
                      className="w-full p-2.5 rounded-xl border bg-background font-mono"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-foreground block mb-1">IRDAI Reg Number</label>
                    <input
                      type="text"
                      value={irdaiNo}
                      onChange={(e) => setIrdaiNo(e.target.value)}
                      placeholder="e.g. IRDAI-146"
                      className="w-full p-2.5 rounded-xl border bg-background font-mono"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-foreground block mb-1">Contact Email</label>
                    <input
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="partner@insurer.com"
                      className="w-full p-2.5 rounded-xl border bg-background"
                    />
                  </div>
                </div>

                <div className="pt-2 border-t">
                  <span className="font-bold text-foreground block mb-2">Supported Add-on Coverages</span>
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={supportsZeroDep}
                        onChange={(e) => setSupportsZeroDep(e.target.checked)}
                      />
                      <span>Zero Depreciation</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={supportsRTI}
                        onChange={(e) => setSupportsRTI(e.target.checked)}
                      />
                      <span>Return to Invoice (RTI)</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={supportsEngineProtect}
                        onChange={(e) => setSupportsEngineProtect(e.target.checked)}
                      />
                      <span>Engine Protect</span>
                    </label>
                    <label className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={supportsRSA}
                        onChange={(e) => setSupportsRSA(e.target.checked)}
                      />
                      <span>Roadside Assistance</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModal(false)}
                    className="px-3.5 py-1.5 font-semibold rounded-xl border hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createInsurerMutation.isPending}
                    className="px-4 py-1.5 font-extrabold rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    {createInsurerMutation.isPending ? 'Saving...' : 'Save Insurer Configuration'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </AppShell>
  );
}
