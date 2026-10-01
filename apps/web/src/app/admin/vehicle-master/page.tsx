'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../lib/api-client';
import { toast } from 'sonner';
import { AppShell } from '../../../components/layout/app-shell';
import {
  Car,
  PlusCircle,
  Search,
  MapPin,
  CheckCircle,
  Building,
  Layers,
  Inbox,
  Filter,
} from 'lucide-react';

export default function VehicleMasterAdminPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'RTO' | 'MAKES' | 'MODELS' | 'VARIANTS'>('RTO');
  const [search, setSearch] = useState('');

  // Modals state
  const [showRtoModal, setShowRtoModal] = useState(false);
  const [showMakeModal, setShowMakeModal] = useState(false);
  const [showModelModal, setShowModelModal] = useState(false);
  const [showVariantModal, setShowVariantModal] = useState(false);

  // RTO Form state
  const [rtoCode, setRtoCode] = useState('');
  const [rtoState, setRtoState] = useState('');
  const [rtoDistrict, setRtoDistrict] = useState('');
  const [rtoOffice, setRtoOffice] = useState('');
  const [rtoZone, setRtoZone] = useState('ZONE_A');

  // Make Form state
  const [makeName, setMakeName] = useState('');
  const [makeCode, setMakeCode] = useState('');

  // Model Form state
  const [modelManufacturerId, setModelManufacturerId] = useState('');
  const [modelName, setModelName] = useState('');
  const [modelCode, setModelCode] = useState('');
  const [modelType, setModelType] = useState('FOUR_WHEELER');

  // Variant Form state
  const [variantModelId, setVariantModelId] = useState('');
  const [variantName, setVariantName] = useState('');
  const [variantCode, setVariantCode] = useState('');
  const [variantFuelType, setVariantFuelType] = useState('PETROL');
  const [variantTransmission, setVariantTransmission] = useState('MANUAL');
  const [variantEngineCc, setVariantEngineCc] = useState('');
  const [variantPrice, setVariantPrice] = useState('');

  // Queries
  const { data: rtos = [], isLoading: isRtoLoading } = useQuery({
    queryKey: ['admin-rtos'],
    queryFn: async () => {
      const res = await apiClient.get('/motor/vehicles/rto');
      return res.data || [];
    },
  });

  const { data: makes = [], isLoading: isMakesLoading } = useQuery({
    queryKey: ['admin-makes'],
    queryFn: async () => {
      const res = await apiClient.get('/motor/vehicles/manufacturers');
      return res.data || [];
    },
  });

  const { data: models = [], isLoading: isModelsLoading } = useQuery({
    queryKey: ['admin-models'],
    queryFn: async () => {
      const res = await apiClient.get('/motor/vehicles/models');
      return res.data || [];
    },
  });

  const { data: variants = [], isLoading: isVariantsLoading } = useQuery({
    queryKey: ['admin-variants'],
    queryFn: async () => {
      const res = await apiClient.get('/motor/vehicles/variants');
      return res.data || [];
    },
  });

  // Mutations
  const createRtoMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/motor/vehicles/rto', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-rtos'] });
      toast.success('RTO Master record created!');
      setShowRtoModal(false);
      setRtoCode('');
      setRtoState('');
      setRtoDistrict('');
      setRtoOffice('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create RTO record');
    },
  });

  const createMakeMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/motor/vehicles/manufacturers', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-makes'] });
      toast.success('Vehicle Make created!');
      setShowMakeModal(false);
      setMakeName('');
      setMakeCode('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create vehicle make');
    },
  });

  const createModelMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/motor/vehicles/models', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-models'] });
      toast.success('Vehicle Model created!');
      setShowModelModal(false);
      setModelName('');
      setModelCode('');
      setModelManufacturerId('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create vehicle model');
    },
  });

  const createVariantMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await apiClient.post('/motor/vehicles/variants', data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-variants'] });
      toast.success('Vehicle Variant created!');
      setShowVariantModal(false);
      setVariantName('');
      setVariantCode('');
      setVariantEngineCc('');
      setVariantPrice('');
      setVariantModelId('');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to create vehicle variant');
    },
  });

  const handleRtoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!rtoCode || !rtoState || !rtoOffice) {
      toast.error('RTO Code, State, and Office Name are required');
      return;
    }
    createRtoMutation.mutate({
      code: rtoCode.toUpperCase(),
      state: rtoState,
      district: rtoDistrict || rtoState,
      rtoOfficeName: rtoOffice,
      rtoZone,
    });
  };

  const handleMakeSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!makeName || !makeCode) {
      toast.error('Make Name and Code are required');
      return;
    }
    createMakeMutation.mutate({
      name: makeName,
      code: makeCode.toUpperCase(),
    });
  };

  const handleModelSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!modelManufacturerId || !modelName || !modelCode) {
      toast.error('Manufacturer, Model Name, and Code are required');
      return;
    }
    createModelMutation.mutate({
      manufacturerId: modelManufacturerId,
      name: modelName,
      code: modelCode.toUpperCase(),
      type: modelType,
    });
  };

  const handleVariantSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!variantModelId || !variantName || !variantCode) {
      toast.error('Model, Variant Name, and Code are required');
      return;
    }
    createVariantMutation.mutate({
      modelId: variantModelId,
      name: variantName,
      code: variantCode.toUpperCase(),
      fuelType: variantFuelType,
      transmissionType: variantTransmission,
      engineCapacity: Number(variantEngineCc) || 1200,
      exShowroomPrice: Number(variantPrice) || 500000,
    });
  };

  const safeRtos = Array.isArray(rtos) ? rtos : ((rtos as any)?.data || (rtos as any)?.items || []);
  const safeMakes = Array.isArray(makes) ? makes : ((makes as any)?.data || (makes as any)?.items || []);
  const safeModels = Array.isArray(models) ? models : ((models as any)?.data || (models as any)?.items || []);
  const safeVariants = Array.isArray(variants) ? variants : ((variants as any)?.data || (variants as any)?.items || []);

  const filteredRtos = safeRtos.filter(
    (r: any) =>
      r.code?.toLowerCase().includes(search.toLowerCase()) ||
      r.rtoOfficeName?.toLowerCase().includes(search.toLowerCase()) ||
      r.state?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredMakes = safeMakes.filter(
    (m: any) =>
      m.name?.toLowerCase().includes(search.toLowerCase()) ||
      m.code?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredModels = safeModels.filter(
    (mo: any) =>
      mo.name?.toLowerCase().includes(search.toLowerCase()) ||
      mo.code?.toLowerCase().includes(search.toLowerCase()) ||
      mo.manufacturer?.name?.toLowerCase().includes(search.toLowerCase())
  );

  const filteredVariants = safeVariants.filter(
    (v: any) =>
      v.name?.toLowerCase().includes(search.toLowerCase()) ||
      v.code?.toLowerCase().includes(search.toLowerCase()) ||
      v.model?.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header Banner */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="text-[10px] uppercase font-bold text-primary tracking-wider">
              Administration • Master Data Management
            </div>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight mt-0.5">
              Vehicle & RTO Master Center
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Configure RTO location codes (KA01, MH12, DL01), Zone A/B tariff rules, vehicle manufacturers, models, variants, fuel types, and ex-showroom price schedules.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowRtoModal(true)}
              className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-primary/90 transition-all"
            >
              <PlusCircle className="h-4 w-4" />
              <span>Add RTO Record</span>
            </button>
            <button
              onClick={() => setShowMakeModal(true)}
              className="px-4 py-2 rounded-xl border bg-card text-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-accent transition-all"
            >
              <Car className="h-4 w-4" />
              <span>Add Make</span>
            </button>
            <button
              onClick={() => setShowModelModal(true)}
              className="px-4 py-2 rounded-xl border bg-card text-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-accent transition-all"
            >
              <Building className="h-4 w-4" />
              <span>Add Model</span>
            </button>
            <button
              onClick={() => setShowVariantModal(true)}
              className="px-4 py-2 rounded-xl border bg-card text-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-accent transition-all"
            >
              <Layers className="h-4 w-4" />
              <span>Add Variant</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b text-xs font-semibold space-x-4">
          {[
            { id: 'RTO', label: 'RTO Office Master', icon: MapPin },
            { id: 'MAKES', label: 'Vehicle Makes (Manufacturers)', icon: Car },
            { id: 'MODELS', label: 'Vehicle Models', icon: Building },
            { id: 'VARIANTS', label: 'Vehicle Variants', icon: Layers },
          ].map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`pb-2.5 border-b-2 flex items-center space-x-1.5 transition-all ${
                  activeTab === tab.id
                    ? 'border-primary text-primary font-bold'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                <Icon className="h-4 w-4" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Search Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={`Search ${activeTab.toLowerCase()}...`}
              className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border bg-background focus:ring-1 focus:ring-primary"
            />
          </div>
        </div>

        {/* RTO Master Table */}
        {activeTab === 'RTO' && (
          <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden">
            {isRtoLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
                Loading RTO Master Records...
              </div>
            ) : filteredRtos.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <MapPin className="h-10 w-10 text-muted-foreground mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No RTO Records Found</h3>
                <p className="text-xs text-muted-foreground">Click "Add RTO Record" to register RTO offices.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-[10px] uppercase font-bold text-muted-foreground bg-muted/20">
                      <th className="py-3 px-3">RTO Code</th>
                      <th className="py-3 px-3">RTO Office Name</th>
                      <th className="py-3 px-3">State</th>
                      <th className="py-3 px-3">District</th>
                      <th className="py-3 px-3">Tariff Zone</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs font-semibold">
                    {filteredRtos.map((r: any) => (
                      <tr key={r.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-primary">{r.code}</td>
                        <td className="py-3 px-3 text-foreground font-bold">{r.rtoOfficeName}</td>
                        <td className="py-3 px-3 text-muted-foreground">{r.state}</td>
                        <td className="py-3 px-3 text-muted-foreground">{r.district}</td>
                        <td className="py-3 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.rtoZone === 'ZONE_A'
                                ? 'bg-amber-500/10 text-amber-600'
                                : 'bg-sky-500/10 text-sky-600'
                            }`}
                          >
                            {r.rtoZone}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Makes Master Table */}
        {activeTab === 'MAKES' && (
          <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden">
            {isMakesLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
                Loading Vehicle Makes...
              </div>
            ) : filteredMakes.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Car className="h-10 w-10 text-muted-foreground mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No Vehicle Makes Found</h3>
                <p className="text-xs text-muted-foreground">Click "Add Make" to add manufacturers.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-[10px] uppercase font-bold text-muted-foreground bg-muted/20">
                      <th className="py-3 px-3">Code</th>
                      <th className="py-3 px-3">Manufacturer Name</th>
                      <th className="py-3 px-3">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs font-semibold">
                    {filteredMakes.map((m: any) => (
                      <tr key={m.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-primary">{m.code}</td>
                        <td className="py-3 px-3 text-foreground font-bold">{m.name}</td>
                        <td className="py-3 px-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                            ACTIVE
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Models Master Table */}
        {activeTab === 'MODELS' && (
          <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden">
            {isModelsLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
                Loading Vehicle Models...
              </div>
            ) : filteredModels.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Building className="h-10 w-10 text-muted-foreground mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No Vehicle Models Found</h3>
                <p className="text-xs text-muted-foreground">Click "Add Model" to register vehicle models.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-[10px] uppercase font-bold text-muted-foreground bg-muted/20">
                      <th className="py-3 px-3">Model Code</th>
                      <th className="py-3 px-3">Model Name</th>
                      <th className="py-3 px-3">Manufacturer</th>
                      <th className="py-3 px-3">Category</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs font-semibold">
                    {filteredModels.map((mo: any) => (
                      <tr key={mo.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-primary">{mo.code}</td>
                        <td className="py-3 px-3 text-foreground font-bold">{mo.name}</td>
                        <td className="py-3 px-3 text-muted-foreground">{mo.manufacturer?.name || '--'}</td>
                        <td className="py-3 px-3 font-mono text-[10px]">{mo.type}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Variants Master Table */}
        {activeTab === 'VARIANTS' && (
          <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden">
            {isVariantsLoading ? (
              <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
                Loading Vehicle Variants...
              </div>
            ) : filteredVariants.length === 0 ? (
              <div className="p-12 text-center space-y-3">
                <Layers className="h-10 w-10 text-muted-foreground mx-auto" />
                <h3 className="text-sm font-bold text-foreground">No Vehicle Variants Found</h3>
                <p className="text-xs text-muted-foreground">Click "Add Variant" to configure variants and price schedules.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs border-collapse">
                  <thead>
                    <tr className="border-b text-[10px] uppercase font-bold text-muted-foreground bg-muted/20">
                      <th className="py-3 px-3">Variant Code</th>
                      <th className="py-3 px-3">Variant Name</th>
                      <th className="py-3 px-3">Model</th>
                      <th className="py-3 px-3">Fuel / Transmission</th>
                      <th className="py-3 px-3">Displacement</th>
                      <th className="py-3 px-3">Ex-Showroom Price</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y text-xs font-semibold">
                    {filteredVariants.map((v: any) => (
                      <tr key={v.id} className="hover:bg-muted/10 transition-colors">
                        <td className="py-3 px-3 font-mono font-bold text-primary">{v.code}</td>
                        <td className="py-3 px-3 text-foreground font-bold">{v.name}</td>
                        <td className="py-3 px-3 text-muted-foreground">{v.model?.name || '--'}</td>
                        <td className="py-3 px-3 text-muted-foreground">
                          {v.fuelType} • {v.transmissionType}
                        </td>
                        <td className="py-3 px-3 font-mono">{v.engineCapacity} cc</td>
                        <td className="py-3 px-3 font-bold text-emerald-600">
                          ₹{Number(v.exShowroomPrice || 0).toLocaleString('en-IN')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Add RTO Modal */}
        {showRtoModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md p-6 rounded-2xl border bg-card shadow-2xl space-y-4 text-xs">
              <div className="flex items-center space-x-2 text-primary">
                <MapPin className="h-5 w-5" />
                <h3 className="text-sm font-extrabold text-foreground">Add RTO Master Record</h3>
              </div>

              <form onSubmit={handleRtoSubmit} className="space-y-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">RTO Code *</label>
                  <input
                    required
                    type="text"
                    value={rtoCode}
                    onChange={(e) => setRtoCode(e.target.value)}
                    placeholder="e.g. KA01 or MH12"
                    className="w-full p-2.5 rounded-xl border bg-background font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">RTO Office Name *</label>
                  <input
                    required
                    type="text"
                    value={rtoOffice}
                    onChange={(e) => setRtoOffice(e.target.value)}
                    placeholder="e.g. Koramangala, Bengaluru"
                    className="w-full p-2.5 rounded-xl border bg-background"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-foreground block mb-1">State *</label>
                    <input
                      required
                      type="text"
                      value={rtoState}
                      onChange={(e) => setRtoState(e.target.value)}
                      placeholder="e.g. Karnataka"
                      className="w-full p-2.5 rounded-xl border bg-background"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-foreground block mb-1">District</label>
                    <input
                      type="text"
                      value={rtoDistrict}
                      onChange={(e) => setRtoDistrict(e.target.value)}
                      placeholder="e.g. Bengaluru Urban"
                      className="w-full p-2.5 rounded-xl border bg-background"
                    />
                  </div>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Tariff Zone</label>
                  <select
                    value={rtoZone}
                    onChange={(e) => setRtoZone(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-background font-semibold"
                  >
                    <option value="ZONE_A">Zone A (Metro / Major Cities)</option>
                    <option value="ZONE_B">Zone B (Rest of India)</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowRtoModal(false)}
                    className="px-3.5 py-1.5 font-semibold rounded-xl border hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createRtoMutation.isPending}
                    className="px-4 py-1.5 font-extrabold rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save RTO Record
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Make Modal */}
        {showMakeModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md p-6 rounded-2xl border bg-card shadow-2xl space-y-4 text-xs">
              <div className="flex items-center space-x-2 text-primary">
                <Car className="h-5 w-5" />
                <h3 className="text-sm font-extrabold text-foreground">Add Vehicle Make</h3>
              </div>

              <form onSubmit={handleMakeSubmit} className="space-y-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Manufacturer Name *</label>
                  <input
                    required
                    type="text"
                    value={makeName}
                    onChange={(e) => setMakeName(e.target.value)}
                    placeholder="e.g. Maruti Suzuki or Hyundai"
                    className="w-full p-2.5 rounded-xl border bg-background"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Make Code *</label>
                  <input
                    required
                    type="text"
                    value={makeCode}
                    onChange={(e) => setMakeCode(e.target.value)}
                    placeholder="e.g. MARUTI"
                    className="w-full p-2.5 rounded-xl border bg-background font-mono"
                  />
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowMakeModal(false)}
                    className="px-3.5 py-1.5 font-semibold rounded-xl border hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createMakeMutation.isPending}
                    className="px-4 py-1.5 font-extrabold rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save Vehicle Make
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Model Modal */}
        {showModelModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md p-6 rounded-2xl border bg-card shadow-2xl space-y-4 text-xs">
              <div className="flex items-center space-x-2 text-primary">
                <Building className="h-5 w-5" />
                <h3 className="text-sm font-extrabold text-foreground">Add Vehicle Model</h3>
              </div>

              <form onSubmit={handleModelSubmit} className="space-y-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Manufacturer *</label>
                  <select
                    required
                    value={modelManufacturerId}
                    onChange={(e) => setModelManufacturerId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-background"
                  >
                    <option value="">Select Manufacturer</option>
                    {safeMakes.map((m: any) => (
                      <option key={m.id} value={m.id}>{m.name} ({m.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Model Name *</label>
                  <input
                    required
                    type="text"
                    value={modelName}
                    onChange={(e) => setModelName(e.target.value)}
                    placeholder="e.g. Swift or Creta"
                    className="w-full p-2.5 rounded-xl border bg-background"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Model Code *</label>
                  <input
                    required
                    type="text"
                    value={modelCode}
                    onChange={(e) => setModelCode(e.target.value)}
                    placeholder="e.g. SWIFT"
                    className="w-full p-2.5 rounded-xl border bg-background font-mono"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Vehicle Type</label>
                  <select
                    value={modelType}
                    onChange={(e) => setModelType(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-background"
                  >
                    <option value="FOUR_WHEELER">Four Wheeler (Car / SUV)</option>
                    <option value="TWO_WHEELER">Two Wheeler (Bike / Scooter)</option>
                    <option value="COMMERCIAL">Commercial Vehicle (GCV / Bus / Taxi)</option>
                  </select>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowModelModal(false)}
                    className="px-3.5 py-1.5 font-semibold rounded-xl border hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createModelMutation.isPending}
                    className="px-4 py-1.5 font-extrabold rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save Vehicle Model
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Add Variant Modal */}
        {showVariantModal && (
          <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="w-full max-w-md p-6 rounded-2xl border bg-card shadow-2xl space-y-4 text-xs">
              <div className="flex items-center space-x-2 text-primary">
                <Layers className="h-5 w-5" />
                <h3 className="text-sm font-extrabold text-foreground">Add Vehicle Variant</h3>
              </div>

              <form onSubmit={handleVariantSubmit} className="space-y-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Vehicle Model *</label>
                  <select
                    required
                    value={variantModelId}
                    onChange={(e) => setVariantModelId(e.target.value)}
                    className="w-full p-2.5 rounded-xl border bg-background"
                  >
                    <option value="">Select Vehicle Model</option>
                    {safeModels.map((mo: any) => (
                      <option key={mo.id} value={mo.id}>{mo.name} ({mo.code})</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Variant Name *</label>
                  <input
                    required
                    type="text"
                    value={variantName}
                    onChange={(e) => setVariantName(e.target.value)}
                    placeholder="e.g. VXI or SX (O) Turbo"
                    className="w-full p-2.5 rounded-xl border bg-background"
                  />
                </div>

                <div>
                  <label className="font-bold text-foreground block mb-1">Variant Code *</label>
                  <input
                    required
                    type="text"
                    value={variantCode}
                    onChange={(e) => setVariantCode(e.target.value)}
                    placeholder="e.g. SWIFT_VXI"
                    className="w-full p-2.5 rounded-xl border bg-background font-mono"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-foreground block mb-1">Fuel Type</label>
                    <select
                      value={variantFuelType}
                      onChange={(e) => setVariantFuelType(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-background"
                    >
                      <option value="PETROL">Petrol</option>
                      <option value="DIESEL">Diesel</option>
                      <option value="CNG">CNG</option>
                      <option value="ELECTRIC">Electric</option>
                      <option value="HYBRID">Hybrid</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold text-foreground block mb-1">Transmission</label>
                    <select
                      value={variantTransmission}
                      onChange={(e) => setVariantTransmission(e.target.value)}
                      className="w-full p-2.5 rounded-xl border bg-background"
                    >
                      <option value="MANUAL">Manual</option>
                      <option value="AUTOMATIC">Automatic</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold text-foreground block mb-1">Engine Displacement (cc)</label>
                    <input
                      type="number"
                      value={variantEngineCc}
                      onChange={(e) => setVariantEngineCc(e.target.value)}
                      placeholder="e.g. 1197"
                      className="w-full p-2.5 rounded-xl border bg-background"
                    />
                  </div>
                  <div>
                    <label className="font-bold text-foreground block mb-1">Ex-Showroom Price (₹)</label>
                    <input
                      type="number"
                      value={variantPrice}
                      onChange={(e) => setVariantPrice(e.target.value)}
                      placeholder="e.g. 750000"
                      className="w-full p-2.5 rounded-xl border bg-background"
                    />
                  </div>
                </div>

                <div className="flex justify-end space-x-2 pt-3 border-t">
                  <button
                    type="button"
                    onClick={() => setShowVariantModal(false)}
                    className="px-3.5 py-1.5 font-semibold rounded-xl border hover:bg-accent"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={createVariantMutation.isPending}
                    className="px-4 py-1.5 font-extrabold rounded-xl bg-primary text-primary-foreground shadow-xs hover:bg-primary/90 disabled:opacity-50"
                  >
                    Save Vehicle Variant
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
