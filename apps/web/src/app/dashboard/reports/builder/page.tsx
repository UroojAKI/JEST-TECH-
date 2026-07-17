'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { api } from '@/lib/api';
import {
  PenTool, ChevronRight, Check, Database, Columns,
  Filter, SortAsc, Save, Play, ArrowLeft, Plus, Trash2,
} from 'lucide-react';

const DATA_SOURCES = [
  { id: 'contacts', label: 'Contacts', description: 'Customer & lead contact records', columns: ['fullName', 'email', 'phone', 'type', 'status', 'city', 'state', 'createdAt'] },
  { id: 'leads', label: 'Leads', description: 'Lead pipeline with stages & assignments', columns: ['leadCode', 'contactName', 'contactEmail', 'status', 'source', 'productType', 'assignedAgentName', 'assignedManagerName', 'createdAt', 'convertedAt'] },
  { id: 'policies', label: 'Policies', description: 'Issued policies with insurer & premium', columns: ['policyNumber', 'contactName', 'contactEmail', 'status', 'insurerName', 'productType', 'premiumAmount', 'effectiveDate', 'expiryDate', 'createdAt'] },
  { id: 'claims', label: 'Claims', description: 'Claims with amounts & statuses', columns: ['claimNumber', 'policyNumber', 'contactName', 'status', 'claimAmount', 'approvedAmount', 'incidentDate', 'reportedAt'] },
  { id: 'revenue', label: 'Revenue', description: 'Policy payments & collection records', columns: ['policyNumber', 'contactName', 'insurerName', 'premiumAmount', 'paymentStatus', 'paymentDate', 'month', 'year'] },
  { id: 'renewals', label: 'Renewals', description: 'Upcoming policy expirations', columns: ['policyNumber', 'contactName', 'contactPhone', 'insurerName', 'premiumAmount', 'expiryDate', 'daysToExpiry'] },
];

const CATEGORIES = ['CRM', 'SALES', 'CLAIMS', 'RENEWALS', 'FINANCE', 'OPERATIONS', 'COMPLIANCE'];

const STEPS = ['Data Source', 'Columns', 'Filters', 'Sort & Save'];

function formatColHeader(col: string) {
  return col.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

export default function ReportBuilderPage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const [step, setStep] = useState(0);
  const [dataSource, setDataSource] = useState('');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([]);
  const [reportName, setReportName] = useState('');
  const [reportCategory, setReportCategory] = useState('CRM');
  const [sortBy, setSortBy] = useState('');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [filters, setFilters] = useState<{ key: string; label: string }[]>([]);

  const availableColumns = DATA_SOURCES.find((d) => d.id === dataSource)?.columns ?? [];

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post('/reports/saved', {
        name: reportName,
        category: reportCategory,
        dataSource,
        columns: selectedColumns,
        filters,
        sortBy: sortBy || undefined,
        sortDir,
      }),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ['saved-reports'] });
      router.push(`/dashboard/reports/${res.data.id}`);
    },
  });

  const runPreviewMutation = useMutation({
    mutationFn: () =>
      api.post('/reports/saved', {
        name: reportName || 'Preview',
        category: reportCategory,
        dataSource,
        columns: selectedColumns,
        filters,
        sortBy: sortBy || undefined,
        sortDir,
      }),
    onSuccess: (res) => {
      router.push(`/dashboard/reports/${res.data.id}`);
    },
  });

  const toggleColumn = (col: string) => {
    setSelectedColumns((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col],
    );
  };

  const canNext = () => {
    if (step === 0) return !!dataSource;
    if (step === 1) return selectedColumns.length > 0;
    return true;
  };

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => router.push('/dashboard/reports')} className="text-slate-500 hover:text-white transition-colors cursor-pointer">
          <ArrowLeft className="h-4 w-4" />
        </button>
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <PenTool className="h-5 w-5 text-indigo-400" /> Dynamic Report Builder
          </h1>
          <p className="text-xs text-slate-400 mt-0.5">Configure columns, filters, and sort — no code required.</p>
        </div>
      </div>

      {/* Step Indicator */}
      <div className="flex items-center gap-0">
        {STEPS.map((s, i) => (
          <React.Fragment key={s}>
            <button
              onClick={() => i < step && setStep(i)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                i === step ? 'bg-indigo-600 text-white' : i < step ? 'text-emerald-400' : 'text-slate-500'
              }`}
            >
              {i < step ? <Check className="h-3 w-3" /> : <span className="w-4 h-4 rounded-full border border-current flex items-center justify-center text-[9px]">{i + 1}</span>}
              {s}
            </button>
            {i < STEPS.length - 1 && <ChevronRight className="h-3 w-3 text-slate-700 mx-1" />}
          </React.Fragment>
        ))}
      </div>

      {/* Step Panels */}
      <div className="glass rounded-xl border border-slate-900 p-6">

        {/* Step 0: Data Source */}
        {step === 0 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-4">
              <Database className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Choose Data Source</h2>
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              {DATA_SOURCES.map((source) => (
                <button
                  key={source.id}
                  onClick={() => { setDataSource(source.id); setSelectedColumns([]); }}
                  className={`text-left p-4 rounded-xl border transition-all cursor-pointer ${
                    dataSource === source.id
                      ? 'border-indigo-500 bg-indigo-600/10'
                      : 'border-slate-800 bg-slate-950/30 hover:border-indigo-500/40'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-bold text-white">{source.label}</p>
                    {dataSource === source.id && <Check className="h-4 w-4 text-indigo-400" />}
                  </div>
                  <p className="text-[10px] text-slate-400 mt-1">{source.description}</p>
                  <p className="text-[9px] text-slate-600 mt-1">{source.columns.length} available columns</p>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Columns */}
        {step === 1 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Columns className="h-4 w-4 text-indigo-400" />
                <h2 className="text-sm font-bold text-white">Select Columns</h2>
              </div>
              <button
                onClick={() => setSelectedColumns(availableColumns)}
                className="text-[10px] text-indigo-400 hover:underline cursor-pointer"
              >
                Select All
              </button>
            </div>
            <div className="grid sm:grid-cols-2 gap-2">
              {availableColumns.map((col) => (
                <button
                  key={col}
                  onClick={() => toggleColumn(col)}
                  className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all cursor-pointer ${
                    selectedColumns.includes(col)
                      ? 'border-indigo-500 bg-indigo-600/10'
                      : 'border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className={`w-4 h-4 rounded border flex items-center justify-center flex-shrink-0 ${
                    selectedColumns.includes(col) ? 'border-indigo-500 bg-indigo-600' : 'border-slate-600'
                  }`}>
                    {selectedColumns.includes(col) && <Check className="h-2.5 w-2.5 text-white" />}
                  </div>
                  <span className="text-xs font-medium text-slate-300">{formatColHeader(col)}</span>
                </button>
              ))}
            </div>
            {selectedColumns.length > 0 && (
              <p className="text-[10px] text-indigo-400">{selectedColumns.length} column{selectedColumns.length !== 1 ? 's' : ''} selected</p>
            )}
          </div>
        )}

        {/* Step 2: Filters */}
        {step === 2 && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Filter className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Configure Filters (Optional)</h2>
            </div>
            <p className="text-xs text-slate-400">Filters can also be applied dynamically at runtime. Skip this step to allow full date/status flexibility when running the report.</p>
            <div className="space-y-2">
              {['from', 'to', 'status', 'agentId', 'type'].map((filterKey) => (
                <label key={filterKey} className="flex items-center gap-3 p-3 rounded-lg border border-slate-800 cursor-pointer hover:border-slate-700 transition-colors">
                  <input
                    type="checkbox"
                    checked={filters.some((f) => f.key === filterKey)}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setFilters((prev) => [...prev, { key: filterKey, label: formatColHeader(filterKey) }]);
                      } else {
                        setFilters((prev) => prev.filter((f) => f.key !== filterKey));
                      }
                    }}
                    className="accent-indigo-500 w-4 h-4"
                  />
                  <div>
                    <p className="text-xs font-bold text-white">{formatColHeader(filterKey)}</p>
                    <p className="text-[10px] text-slate-500">
                      {filterKey === 'from' || filterKey === 'to' ? 'Date range filter' :
                       filterKey === 'status' ? 'Filter by record status' :
                       filterKey === 'agentId' ? 'Filter by assigned agent' : 'Filter by type/category'}
                    </p>
                  </div>
                </label>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Sort & Save */}
        {step === 3 && (
          <div className="space-y-5">
            <div className="flex items-center gap-2 mb-2">
              <SortAsc className="h-4 w-4 text-indigo-400" />
              <h2 className="text-sm font-bold text-white">Sort & Save Report</h2>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Report Name *</label>
                <input
                  type="text"
                  value={reportName}
                  onChange={(e) => setReportName(e.target.value)}
                  placeholder="e.g. Monthly Revenue Summary"
                  className="w-full rounded-lg bg-slate-950 px-3 py-2 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Category</label>
                <select
                  value={reportCategory}
                  onChange={(e) => setReportCategory(e.target.value)}
                  className="rounded-lg bg-slate-950 px-3 py-2 text-xs text-white border border-slate-800 focus:outline-none"
                >
                  {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Sort By Column</label>
                <div className="flex gap-2">
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="flex-1 rounded-lg bg-slate-950 px-3 py-2 text-xs text-white border border-slate-800 focus:outline-none"
                  >
                    <option value="">No Sort</option>
                    {selectedColumns.map((c) => <option key={c} value={c}>{formatColHeader(c)}</option>)}
                  </select>
                  <select
                    value={sortDir}
                    onChange={(e) => setSortDir(e.target.value as 'asc' | 'desc')}
                    className="rounded-lg bg-slate-950 px-3 py-2 text-xs text-white border border-slate-800 focus:outline-none"
                  >
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Summary Card */}
            <div className="border border-slate-800 rounded-xl p-4 bg-slate-950/30 space-y-1">
              <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Report Summary</p>
              <p className="text-xs text-slate-300"><span className="text-slate-500">Data Source:</span> {dataSource}</p>
              <p className="text-xs text-slate-300"><span className="text-slate-500">Columns:</span> {selectedColumns.length} selected</p>
              <p className="text-xs text-slate-300"><span className="text-slate-500">Filters:</span> {filters.length > 0 ? filters.map(f => f.label).join(', ') : 'None'}</p>
              <p className="text-xs text-slate-300"><span className="text-slate-500">Sort:</span> {sortBy ? `${formatColHeader(sortBy)} (${sortDir})` : 'None'}</p>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={() => saveMutation.mutate()}
                disabled={!reportName || saveMutation.isPending}
                className="flex-1 rounded-xl bg-indigo-600 py-3 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
              >
                <Save className="h-3.5 w-3.5" /> Save & Open Report
              </button>
              <button
                onClick={() => runPreviewMutation.mutate()}
                disabled={runPreviewMutation.isPending}
                className="rounded-xl bg-slate-800 px-5 py-3 text-xs font-bold text-white hover:bg-slate-700 cursor-pointer flex items-center gap-2"
              >
                <Play className="h-3.5 w-3.5" /> Run Preview
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Navigation */}
      <div className="flex justify-between">
        <button
          onClick={() => setStep((s) => s - 1)}
          disabled={step === 0}
          className="rounded-lg bg-slate-900 px-4 py-2 text-xs font-bold text-slate-400 hover:text-white disabled:opacity-30 cursor-pointer"
        >
          ← Back
        </button>
        {step < STEPS.length - 1 && (
          <button
            onClick={() => setStep((s) => s + 1)}
            disabled={!canNext()}
            className="rounded-lg bg-indigo-600 px-5 py-2 text-xs font-bold text-white hover:bg-indigo-500 disabled:opacity-50 cursor-pointer flex items-center gap-1.5"
          >
            Next <ChevronRight className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </div>
  );
}
