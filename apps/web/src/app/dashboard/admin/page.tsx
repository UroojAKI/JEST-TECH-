'use client';

import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/api';
import {
  Settings,
  Car,
  Shield,
  TrendingUp,
  Sliders,
  Plus,
  Upload,
  Play,
  CheckCircle,
} from 'lucide-react';

interface Manufacturer {
  id: string;
  name: string;
  code: string;
}

interface Model {
  id: string;
  name: string;
  code: string;
  vehicleType: string;
  manufacturer: Manufacturer;
}

interface Variant {
  id: string;
  name: string;
  code: string;
  fuelType: string;
  transmissionType: string;
  engineCapacity: number;
  exShowroomPrice: number;
  model: Model;
}

interface Insurer {
  id: string;
  name: string;
  code: string;
  rating?: number;
}

interface Product {
  id: string;
  name: string;
  code: string;
  type: string;
  baseCommissionRate: number;
}

interface RatingRule {
  id: string;
  ruleName: string;
  ruleType: string;
  insurer: Insurer;
  product: Product;
  priority: number;
}

export default function AdminPortalPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'vehicles' | 'insurers' | 'rules' | 'calculator'>('vehicles');

  // Form states
  const [mName, setMName] = useState('');
  const [mCode, setMCode] = useState('');

  const [modManufacturerId, setModManufacturerId] = useState('');
  const [modName, setModName] = useState('');
  const [modCode, setModCode] = useState('');
  const [modType, setModType] = useState('FOUR_WHEELER');

  const [insName, setInsName] = useState('');
  const [insCode, setInsCode] = useState('');
  const [insRating, setInsRating] = useState('4.5');

  const [prodName, setProdName] = useState('');
  const [prodCode, setProdCode] = useState('');
  const [prodType, setProdType] = useState('COMPREHENSIVE');
  const [prodCommission, setProdCommission] = useState('10');

  // Rating Sandbox Calculator inputs
  const [calcVariantId, setCalcVariantId] = useState('');
  const [calcInsurerId, setCalcInsurerId] = useState('');
  const [calcProductId, setCalcProductId] = useState('');
  const [calcAge, setCalcAge] = useState('0');
  const [calcNcb, setCalcNcb] = useState('0');
  const [calcAddons, setCalcAddons] = useState<string[]>([]);
  const [calcResult, setCalcResult] = useState<any>(null);

  // CSV Import State
  const [importStatus, setImportStatus] = useState('');

  // Queries
  const { data: manufacturers = [] } = useQuery<Manufacturer[]>({
    queryKey: ['admin-manufacturers'],
    queryFn: () => api.get('/motor/vehicles/manufacturers').then((res) => res.data),
  });

  const { data: models = [] } = useQuery<Model[]>({
    queryKey: ['admin-models'],
    queryFn: () => api.get('/motor/vehicles/models').then((res) => res.data),
  });

  const { data: variants = [] } = useQuery<Variant[]>({
    queryKey: ['admin-variants'],
    queryFn: () => api.get('/motor/vehicles/variants').then((res) => res.data),
  });

  const { data: insurers = [] } = useQuery<Insurer[]>({
    queryKey: ['admin-insurers'],
    queryFn: () => api.get('/motor/rating/insurers').then((res) => res.data),
  });

  const { data: products = [] } = useQuery<Product[]>({
    queryKey: ['admin-products'],
    queryFn: () => api.get('/motor/rating/products').then((res) => res.data),
  });

  const { data: rules = [] } = useQuery<RatingRule[]>({
    queryKey: ['admin-rules'],
    queryFn: () => api.get('/motor/rating/rules').then((res) => res.data),
  });

  // Mutations
  const mfgMutation = useMutation({
    mutationFn: () => api.post('/motor/vehicles/manufacturers', { name: mName, code: mCode }),
    onSuccess: () => {
      setMName('');
      setMCode('');
      queryClient.invalidateQueries({ queryKey: ['admin-manufacturers'] });
    },
  });

  const modelMutation = useMutation({
    mutationFn: () => api.post('/motor/vehicles/models', {
      manufacturerId: modManufacturerId,
      name: modName,
      code: modCode,
      type: modType,
    }),
    onSuccess: () => {
      setModName('');
      setModCode('');
      queryClient.invalidateQueries({ queryKey: ['admin-models'] });
    },
  });

  const insurerMutation = useMutation({
    mutationFn: () => api.post('/motor/rating/insurers', {
      name: insName,
      code: insCode,
      rating: parseFloat(insRating),
    }),
    onSuccess: () => {
      setInsName('');
      setInsCode('');
      queryClient.invalidateQueries({ queryKey: ['admin-insurers'] });
    },
  });

  const productMutation = useMutation({
    mutationFn: () => api.post('/motor/rating/products', {
      name: prodName,
      code: prodCode,
      type: prodType,
      baseCommissionRate: parseFloat(prodCommission),
    }),
    onSuccess: () => {
      setProdName('');
      setProdCode('');
      queryClient.invalidateQueries({ queryKey: ['admin-products'] });
    },
  });

  // Calculate Mutation
  const calculateMutation = useMutation({
    mutationFn: () => api.post('/motor/rating/calculate', {
      variantId: calcVariantId,
      insurerId: calcInsurerId,
      productId: calcProductId,
      vehicleAgeYears: parseInt(calcAge),
      ncbPercentage: parseInt(calcNcb),
      selectedAddons: calcAddons,
    }),
    onSuccess: (res) => {
      setCalcResult(res.data);
    },
  });

  const handleCSVImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setImportStatus('Uploading...');
    const formData = new FormData();
    formData.append('file', file);

    api.post('/motor/vehicles/variants/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }).then((res) => {
      setImportStatus(`Successfully imported ${res.data.count} variants!`);
      queryClient.invalidateQueries({ queryKey: ['admin-variants'] });
    }).catch(() => {
      setImportStatus('Error importing CSV');
    });
  };

  const toggleAddon = (addon: string) => {
    setCalcAddons((prev) =>
      prev.includes(addon) ? prev.filter((a) => a !== addon) : [...prev, addon]
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <Settings className="h-5 w-5 text-indigo-400" /> JEST Settings & Configurations
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Motor administration platform: manage master registers, dynamic rating, and premium rules.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-slate-900 pb-2">
        <button
          onClick={() => setActiveTab('vehicles')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
            activeTab === 'vehicles' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900/60'
          }`}
        >
          <Car className="h-4 w-4" /> Vehicle Master
        </button>
        <button
          onClick={() => setActiveTab('insurers')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
            activeTab === 'insurers' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900/60'
          }`}
        >
          <Shield className="h-4 w-4" /> Insurers & Products
        </button>
        <button
          onClick={() => setActiveTab('rules')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
            activeTab === 'rules' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900/60'
          }`}
        >
          <Sliders className="h-4 w-4" /> Rating Rules
        </button>
        <button
          onClick={() => setActiveTab('calculator')}
          className={`flex items-center gap-2 px-4 py-2 text-xs font-bold rounded-lg cursor-pointer transition-colors ${
            activeTab === 'calculator' ? 'bg-indigo-600 text-white' : 'text-slate-400 hover:bg-slate-900/60'
          }`}
        >
          <TrendingUp className="h-4 w-4" /> Premium Sandbox
        </button>
      </div>

      {/* Vehicles Master Tab */}
      {activeTab === 'vehicles' && (
        <div className="grid gap-6 md:grid-cols-3">
          {/* Create Manufacturer Form */}
          <div className="glass p-6 rounded-xl border border-slate-900">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-400" /> New Manufacturer
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Manufacturer Name (e.g. Tata)"
                value={mName}
                onChange={(e) => setMName(e.target.value)}
                className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Manufacturer Code (e.g. TATA)"
                value={mCode}
                onChange={(e) => setMCode(e.target.value)}
                className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={() => mfgMutation.mutate()}
                className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
              >
                Add Manufacturer
              </button>
            </div>
          </div>

          {/* Create Model Form */}
          <div className="glass p-6 rounded-xl border border-slate-900">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-400" /> New Vehicle Model
            </h3>
            <div className="space-y-4">
              <select
                value={modManufacturerId}
                onChange={(e) => setModManufacturerId(e.target.value)}
                className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select Manufacturer</option>
                {manufacturers.map((m) => (
                  <option key={m.id} value={m.id}>{m.name}</option>
                ))}
              </select>
              <input
                type="text"
                placeholder="Model Name (e.g. Nexon)"
                value={modName}
                onChange={(e) => setModName(e.target.value)}
                className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Model Code (e.g. NEXON)"
                value={modCode}
                onChange={(e) => setModCode(e.target.value)}
                className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={() => modelMutation.mutate()}
                className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
              >
                Add Model
              </button>
            </div>
          </div>

          {/* CSV Variant Bulk Upload */}
          <div className="glass p-6 rounded-xl border border-slate-900">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Upload className="h-4 w-4 text-indigo-400" /> Bulk Import Variants
            </h3>
            <div className="space-y-4">
              <p className="text-[10px] text-slate-400 leading-relaxed">
                Upload a CSV file containing vehicle models and variants.
                <br />
                Columns: <code className="text-indigo-400">modelCode, name, variantCode, fuelType, transmissionType, engineCapacity, exShowroomPrice</code>
              </p>
              <label className="flex flex-col items-center justify-center border border-dashed border-slate-800 rounded-lg p-6 bg-slate-950/20 hover:bg-slate-950/40 cursor-pointer transition-colors">
                <Upload className="h-6 w-6 text-slate-400 mb-2" />
                <span className="text-xs text-slate-300">Choose CSV File</span>
                <input
                  type="file"
                  accept=".csv"
                  onChange={handleCSVImport}
                  className="hidden"
                />
              </label>
              {importStatus && (
                <div className="text-center text-xs text-indigo-400 font-bold bg-indigo-500/10 p-2 rounded-lg">
                  {importStatus}
                </div>
              )}
            </div>
          </div>

          {/* Variants Table List */}
          <div className="md:col-span-3 glass rounded-xl border border-slate-900 overflow-hidden">
            <div className="p-6 border-b border-slate-900">
              <h3 className="text-sm font-bold text-white">Active Variants Registry</h3>
            </div>
            <div className="overflow-x-auto max-h-[30vh]">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-900 bg-slate-950/20 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                    <th className="py-4 px-6">Brand</th>
                    <th className="py-4 px-6">Model</th>
                    <th className="py-4 px-6">Variant</th>
                    <th className="py-4 px-6">CC</th>
                    <th className="py-4 px-6">Ex-Showroom Price</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                  {variants.map((v) => (
                    <tr key={v.id} className="hover:bg-slate-900/20">
                      <td className="py-4 px-6 font-bold text-white">{v.model?.manufacturer?.name}</td>
                      <td className="py-4 px-6">{v.model?.name}</td>
                      <td className="py-4 px-6 text-slate-400">{v.name} ({v.fuelType})</td>
                      <td className="py-4 px-6 text-slate-400">{v.engineCapacity} CC</td>
                      <td className="py-4 px-6 font-semibold text-slate-200">₹{Number(v.exShowroomPrice).toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Insurers & Products Tab */}
      {activeTab === 'insurers' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* New Insurer Form */}
          <div className="glass p-6 rounded-xl border border-slate-900">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-400" /> Configure Insurer
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Insurer Name (e.g. Digit Insurance)"
                value={insName}
                onChange={(e) => setInsName(e.target.value)}
                className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Insurer Code (e.g. DIGIT)"
                value={insCode}
                onChange={(e) => setInsCode(e.target.value)}
                className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={() => insurerMutation.mutate()}
                className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
              >
                Add Insurer
              </button>
            </div>
          </div>

          {/* New Product Form */}
          <div className="glass p-6 rounded-xl border border-slate-900">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
              <Plus className="h-4 w-4 text-indigo-400" /> Configure Product Line
            </h3>
            <div className="space-y-4">
              <input
                type="text"
                placeholder="Product Name (e.g. Private Car Zero Dep)"
                value={prodName}
                onChange={(e) => setProdName(e.target.value)}
                className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <input
                type="text"
                placeholder="Product Code (e.g. CAR_COMP)"
                value={prodCode}
                onChange={(e) => setProdCode(e.target.value)}
                className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
              />
              <div className="flex gap-4">
                <select
                  value={prodType}
                  onChange={(e) => setProdType(e.target.value)}
                  className="flex-1 rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
                >
                  <option value="COMPREHENSIVE">Comprehensive</option>
                  <option value="THIRD_PARTY">Third Party</option>
                  <option value="ZERO_DEP">Zero Depreciation</option>
                </select>
                <input
                  type="number"
                  placeholder="Commission %"
                  value={prodCommission}
                  onChange={(e) => setProdCommission(e.target.value)}
                  className="w-[120px] rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <button
                onClick={() => productMutation.mutate()}
                className="w-full rounded-lg bg-indigo-600 py-2 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer"
              >
                Add Product
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rating Rules Configurator */}
      {activeTab === 'rules' && (
        <div className="glass rounded-xl border border-slate-900 overflow-hidden">
          <div className="p-6 border-b border-slate-900 flex justify-between items-center">
            <h3 className="text-sm font-bold text-white">Active Premium Rating Coefficients</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/20 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-4 px-6">Rule Name</th>
                  <th className="py-4 px-6">Insurer</th>
                  <th className="py-4 px-6">Product</th>
                  <th className="py-4 px-6">Rule Type</th>
                  <th className="py-4 px-6">Priority</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                {rules.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-500 text-xs">
                      No custom rating rules configured. System is running on Ex-showroom defaults.
                    </td>
                  </tr>
                ) : (
                  rules.map((rule) => (
                    <tr key={rule.id} className="hover:bg-slate-900/20">
                      <td className="py-4 px-6 font-bold text-white">{rule.ruleName}</td>
                      <td className="py-4 px-6">{rule.insurer?.name}</td>
                      <td className="py-4 px-6">{rule.product?.name}</td>
                      <td className="py-4 px-6">
                        <span className="bg-indigo-500/15 text-indigo-400 border border-indigo-500/30 px-2 py-0.5 rounded text-[10px] font-bold">
                          {rule.ruleType}
                        </span>
                      </td>
                      <td className="py-4 px-6">{rule.priority}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Premium Sandbox Calculator */}
      {activeTab === 'calculator' && (
        <div className="grid gap-6 md:grid-cols-2">
          {/* Parameters Input Form */}
          <div className="glass p-6 rounded-xl border border-slate-900 space-y-4">
            <h3 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
              <Play className="h-4 w-4 text-indigo-400" /> Premium Sandbox Calculator
            </h3>
            <div className="space-y-3">
              <label htmlFor="calcVariantId" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Vehicle Variant</label>
              <select
                id="calcVariantId"
                value={calcVariantId}
                onChange={(e) => setCalcVariantId(e.target.value)}
                className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select Variant</option>
                {variants.map((v) => (
                  <option key={v.id} value={v.id}>
                    {v.model?.manufacturer?.name} {v.model?.name} {v.name} ({v.engineCapacity} CC)
                  </option>
                ))}
              </select>

              <label htmlFor="calcInsurerId" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Insurer Partner</label>
              <select
                id="calcInsurerId"
                value={calcInsurerId}
                onChange={(e) => setCalcInsurerId(e.target.value)}
                className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select Insurer</option>
                {insurers.map((i) => (
                  <option key={i.id} value={i.id}>{i.name}</option>
                ))}
              </select>

              <label htmlFor="calcProductId" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Product Line</label>
              <select
                id="calcProductId"
                value={calcProductId}
                onChange={(e) => setCalcProductId(e.target.value)}
                className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500 focus:outline-none"
              >
                <option value="">Select Product</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <div className="flex gap-4">
                <div className="flex-1">
                  <label htmlFor="calcAge" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Vehicle Age (Years)</label>
                  <input
                    id="calcAge"
                    type="number"
                    value={calcAge}
                    onChange={(e) => setCalcAge(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500"
                  />
                </div>
                <div className="flex-1">
                  <label htmlFor="calcNcb" className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1">NCB Discount (%)</label>
                  <select
                    id="calcNcb"
                    value={calcNcb}
                    onChange={(e) => setCalcNcb(e.target.value)}
                    className="w-full rounded-lg bg-slate-950 py-2 px-3 text-xs text-white border border-slate-900 focus:border-indigo-500"
                  >
                    <option value="0">0% (No Claim)</option>
                    <option value="20">20%</option>
                    <option value="25">25%</option>
                    <option value="35">35%</option>
                    <option value="45">45%</option>
                    <option value="50">50%</option>
                  </select>
                </div>
              </div>

              <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Add-ons Covers</label>
              <div className="flex gap-4">
                <label htmlFor="addonZeroDep" className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    id="addonZeroDep"
                    type="checkbox"
                    checked={calcAddons.includes('ZERO_DEP')}
                    onChange={() => toggleAddon('ZERO_DEP')}
                    className="rounded bg-slate-950 border-slate-900 text-indigo-600 focus:ring-0"
                  />
                  Zero Depreciation
                </label>
                <label htmlFor="addonEngineProtect" className="flex items-center gap-2 text-xs text-slate-300">
                  <input
                    id="addonEngineProtect"
                    type="checkbox"
                    checked={calcAddons.includes('ENGINE_PROTECT')}
                    onChange={() => toggleAddon('ENGINE_PROTECT')}
                    className="rounded bg-slate-950 border-slate-900 text-indigo-600 focus:ring-0"
                  />
                  Engine Protect
                </label>
              </div>

              <button
                onClick={() => calculateMutation.mutate()}
                className="w-full rounded-lg bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-500 cursor-pointer transition-all flex items-center justify-center gap-2 mt-4"
              >
                <Play className="h-4 w-4" /> Run dynamic Premium Rating
              </button>
            </div>
          </div>

          {/* Premium Breakout Results Panel */}
          <div className="glass p-6 rounded-xl border border-slate-900 flex flex-col justify-between">
            <div>
              <h3 className="text-xs font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-indigo-400" /> Pricing Calculation Breakout
              </h3>
              {calcResult ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 border-b border-slate-900 pb-3">
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Calculated IDV</p>
                      <p className="text-lg font-bold text-white">₹{calcResult.idv.toLocaleString()}</p>
                    </div>
                    <div>
                      <p className="text-[10px] text-slate-500 uppercase tracking-wider">Ex-Showroom Price</p>
                      <p className="text-lg font-bold text-slate-400">₹{calcResult.exShowroom.toLocaleString()}</p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Own Damage Base Premium</span>
                      <span className="text-white font-medium">₹{calcResult.calculations.ownDamage.base.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-rose-400">
                      <span>NCB Discount Deductions</span>
                      <span>-₹{calcResult.calculations.ownDamage.ncbDiscount.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs">
                      <span className="text-slate-400">Third Party Fixed Premium</span>
                      <span className="text-white font-medium">₹{calcResult.calculations.thirdParty.toLocaleString()}</span>
                    </div>
                    {calcResult.calculations.addons.breakdown.map((add: any, idx: number) => (
                      <div key={idx} className="flex justify-between text-xs text-indigo-400">
                        <span>{add.name}</span>
                        <span>₹{add.premium.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="flex justify-between text-xs border-t border-slate-900 pt-2 font-bold text-slate-200">
                      <span>Net Premium</span>
                      <span>₹{calcResult.calculations.netPremium.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-400">
                      <span>GST Taxes (18%)</span>
                      <span>₹{calcResult.calculations.gst.toLocaleString()}</span>
                    </div>
                  </div>

                  <div className="border-t border-slate-900 pt-4 flex justify-between items-center bg-indigo-600/5 p-4 rounded-xl border border-indigo-500/10 mt-6">
                    <div>
                      <p className="text-[10px] text-indigo-400 font-bold uppercase tracking-wider">Total Premium Due</p>
                      <p className="text-xl font-black text-white">₹{calcResult.calculations.totalPremium.toLocaleString()}</p>
                    </div>
                    <span className="bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                      Premium Live
                    </span>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-slate-500 text-center py-12">
                  Select a variant and parameters, then run calculation to inspect the pricing breakup.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
