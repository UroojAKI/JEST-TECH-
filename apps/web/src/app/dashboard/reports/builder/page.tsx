'use client';

import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reportsRepository } from '../../../../repositories/reports.repository';
import { toast } from 'sonner';
import { AppShell } from '../../../../components/layout/app-shell';
import {
  Wand2,
  Database,
  Filter,
  CheckSquare,
  Plus,
  Play,
  Save,
  Trash2,
  ArrowRight,
  ShieldCheck,
  Layers,
} from 'lucide-react';
import { VisualizationStudio } from '../../../../components/reports/VisualizationStudio';

const DATASETS = [
  {
    key: 'policies_gwp',
    name: 'Policies & Gross Written Premium (GWP)',
    category: 'Policies',
    description: 'Policy schedules, premiums, commissions, and insurer distributions',
    columns: [
      { key: 'policyNumber', label: 'Policy Number', dataType: 'STRING' },
      { key: 'customerName', label: 'Customer Name', dataType: 'STRING' },
      { key: 'productLine', label: 'Product Line', dataType: 'STRING' },
      { key: 'insurerName', label: 'Insurer Name', dataType: 'STRING' },
      { key: 'idvValue', label: 'IDV Value', dataType: 'CURRENCY' },
      { key: 'totalPremium', label: 'Total Premium', dataType: 'CURRENCY' },
      { key: 'commission', label: 'Brokerage Commission', dataType: 'CURRENCY' },
      { key: 'status', label: 'Policy Status', dataType: 'STRING' },
      { key: 'issueDate', label: 'Issue Date', dataType: 'DATE' },
    ],
  },
  {
    key: 'sales_leads',
    name: 'Sales Pipeline & Lead Conversion',
    category: 'Sales',
    description: 'Leads, stages, score, expected premium, and win rates',
    columns: [
      { key: 'leadId', label: 'Lead ID', dataType: 'STRING' },
      { key: 'contactName', label: 'Contact Name', dataType: 'STRING' },
      { key: 'product', label: 'Product', dataType: 'STRING' },
      { key: 'stage', label: 'Pipeline Stage', dataType: 'STRING' },
      { key: 'leadScore', label: 'Lead Score', dataType: 'NUMBER' },
      { key: 'expectedPremium', label: 'Expected Premium', dataType: 'CURRENCY' },
      { key: 'assignedAgent', label: 'Sales Agent', dataType: 'STRING' },
    ],
  },
  {
    key: 'claims_exposure',
    name: 'Claims Exposure & Loss Ratio',
    category: 'Claims',
    description: 'Claims raised, status, estimated liability, and surveyor status',
    columns: [
      { key: 'claimNumber', label: 'Claim Number', dataType: 'STRING' },
      { key: 'policyNumber', label: 'Policy Number', dataType: 'STRING' },
      { key: 'claimantName', label: 'Claimant', dataType: 'STRING' },
      { key: 'estimatedAmount', label: 'Claimed Amount', dataType: 'CURRENCY' },
      { key: 'approvedAmount', label: 'Approved Amount', dataType: 'CURRENCY' },
      { key: 'status', label: 'Claim Status', dataType: 'STRING' },
    ],
  },
];

const PREVIEW_MOCK_DATA = [
  {
    policyNumber: 'POL-001048',
    customerName: 'Rahul Patil',
    productLine: 'Motor Comprehensive',
    insurerName: 'ICICI Lombard',
    idvValue: 850000,
    totalPremium: 16545,
    commission: 1654.5,
    status: 'ACTIVE',
    issueDate: '2025-08-15',
  },
  {
    policyNumber: 'POL-001049',
    customerName: 'Acme Logistics Pvt Ltd',
    productLine: 'Group Health Optima',
    insurerName: 'HDFC ERGO',
    idvValue: 10000000,
    totalPremium: 450000,
    commission: 45000,
    status: 'ACTIVE',
    issueDate: '2026-01-10',
  },
  {
    policyNumber: 'POL-001050',
    customerName: 'Sunita Kulkarni',
    productLine: 'Health Family Optima',
    insurerName: 'Star Health',
    idvValue: 500000,
    totalPremium: 28000,
    commission: 2800,
    status: 'RENEWAL_DUE',
    issueDate: '2025-06-30',
  },
];

export default function VisualReportBuilderPage() {
  const [selectedDatasetKey, setSelectedDatasetKey] = useState<string>('policies_gwp');
  const [reportTitle, setReportTitle] = useState<string>('Custom Policy GWP Analysis');
  const [selectedColumns, setSelectedColumns] = useState<string[]>([
    'policyNumber',
    'customerName',
    'productLine',
    'insurerName',
    'totalPremium',
  ]);
  const [filters, setFilters] = useState<{ column: string; operator: string; value: string }[]>([
    { column: 'status', operator: 'equals', value: 'ACTIVE' },
  ]);
  const [isPreviewExecuted, setIsPreviewExecuted] = useState<boolean>(true);

  const queryClient = useQueryClient();

  const { mutate: saveReport, isPending: isSaving } = useMutation({
    mutationFn: (data: any) => reportsRepository.createReport(data),
    onSuccess: () => {
      toast.success(`Report "${reportTitle}" saved successfully!`);
      queryClient.invalidateQueries({ queryKey: ['reports'] });
    },
    onError: () => toast.error('Failed to save report')
  });

  const dataset = DATASETS.find((d) => d.key === selectedDatasetKey) || DATASETS[0];

  const handleToggleColumn = (colKey: string) => {
    if (selectedColumns.includes(colKey)) {
      if (selectedColumns.length > 1) {
        setSelectedColumns(selectedColumns.filter((c) => c !== colKey));
      }
    } else {
      setSelectedColumns([...selectedColumns, colKey]);
    }
  };

  const handleAddFilter = () => {
    setFilters([...filters, { column: dataset.columns[0].key, operator: 'equals', value: '' }]);
  };

  const handleRemoveFilter = (index: number) => {
    setFilters(filters.filter((_, idx) => idx !== index));
  };

  const activeColumns = dataset.columns.filter((col) => selectedColumns.includes(col.key));

  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Wand2 className="h-5 w-5 text-primary" /> Self-Service Visual Report Builder
          </h1>
          <p className="text-xs text-muted-foreground">
            Design custom reports, pick datasets, configure multi-condition filters, and preview live analytics
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setIsPreviewExecuted(true)}
            className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-accent shadow-sm"
          >
            <Play className="h-3.5 w-3.5 text-emerald-500" />
            <span>Run Preview</span>
          </button>
          <button
            disabled={isSaving}
            onClick={() => {
              saveReport({
                name: reportTitle,
                category: dataset.category.toUpperCase() as any,
                module: dataset.key,
                providerKey: dataset.key,
                isSystem: false,
                status: 'ACTIVE',
                columns: activeColumns,
                description: 'Custom report created from builder',
              });
            }}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isSaving ? 'Saving...' : 'Save Report Template'}</span>
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 text-xs">
        {/* Left Column: Configuration Controls */}
        <div className="lg:col-span-4 space-y-4">
          {/* Report Title & Dataset */}
          <div className="p-4 rounded-xl border bg-card space-y-3 shadow-sm">
            <div className="space-y-1">
              <label className="font-bold text-muted-foreground uppercase text-[10px]">Report Title</label>
              <input
                type="text"
                value={reportTitle}
                onChange={(e) => setReportTitle(e.target.value)}
                className="w-full p-2.5 rounded-lg border bg-background font-bold text-xs"
              />
            </div>

            <div className="space-y-1">
              <label className="font-bold text-muted-foreground uppercase text-[10px]">Select Data Provider / Dataset</label>
              <select
                value={selectedDatasetKey}
                onChange={(e) => {
                  setSelectedDatasetKey(e.target.value);
                  const newDs = DATASETS.find((d) => d.key === e.target.value);
                  if (newDs) {
                    setSelectedColumns(newDs.columns.slice(0, 5).map((c) => c.key));
                  }
                }}
                className="w-full p-2.5 rounded-lg border bg-background font-semibold text-xs"
              >
                {DATASETS.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.name} ({d.category})
                  </option>
                ))}
              </select>
              <p className="text-[10px] text-muted-foreground pt-0.5">{dataset.description}</p>
            </div>
          </div>

          {/* Column Picker */}
          <div className="p-4 rounded-xl border bg-card space-y-3 shadow-sm">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-bold uppercase text-[10px] text-muted-foreground">Columns ({selectedColumns.length} Selected)</span>
              <CheckSquare className="h-3.5 w-3.5 text-primary" />
            </div>

            <div className="space-y-1.5 max-h-[220px] overflow-y-auto pr-1">
              {dataset.columns.map((col) => {
                const isSelected = selectedColumns.includes(col.key);
                return (
                  <label
                    key={col.key}
                    className={`flex items-center justify-between p-2 rounded-lg border cursor-pointer transition-colors ${
                      isSelected ? 'bg-primary/10 border-primary/40 font-bold text-primary' : 'bg-background hover:bg-accent'
                    }`}
                  >
                    <div className="flex items-center space-x-2">
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => handleToggleColumn(col.key)}
                        className="rounded"
                      />
                      <span>{col.label}</span>
                    </div>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground uppercase font-mono">
                      {col.dataType}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Filter Rules */}
          <div className="p-4 rounded-xl border bg-card space-y-3 shadow-sm">
            <div className="flex justify-between items-center border-b pb-2">
              <span className="font-bold uppercase text-[10px] text-muted-foreground">Filter Rules</span>
              <button
                onClick={handleAddFilter}
                className="text-primary hover:underline font-bold text-[11px] flex items-center gap-0.5"
              >
                <Plus className="h-3 w-3" /> Add Filter
              </button>
            </div>

            <div className="space-y-2">
              {filters.map((f, idx) => (
                <div key={idx} className="flex items-center space-x-1.5">
                  <select
                    value={f.column}
                    onChange={(e) => {
                      const updated = [...filters];
                      updated[idx].column = e.target.value;
                      setFilters(updated);
                    }}
                    className="flex-1 p-1.5 rounded border bg-background text-[11px]"
                  >
                    {dataset.columns.map((c) => (
                      <option key={c.key} value={c.key}>{c.label}</option>
                    ))}
                  </select>

                  <select
                    value={f.operator}
                    onChange={(e) => {
                      const updated = [...filters];
                      updated[idx].operator = e.target.value;
                      setFilters(updated);
                    }}
                    className="w-24 p-1.5 rounded border bg-background text-[11px]"
                  >
                    <option value="equals">Equals</option>
                    <option value="contains">Contains</option>
                    <option value="greater_than">&gt; Greater</option>
                    <option value="date_between">Date Between</option>
                  </select>

                  <input
                    type="text"
                    placeholder="Value..."
                    value={f.value}
                    onChange={(e) => {
                      const updated = [...filters];
                      updated[idx].value = e.target.value;
                      setFilters(updated);
                    }}
                    className="w-24 p-1.5 rounded border bg-background text-[11px]"
                  />

                  <button
                    onClick={() => handleRemoveFilter(idx)}
                    className="p-1 rounded text-red-500 hover:bg-red-500/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right Column: Visualization & Live Data Preview */}
        <div className="lg:col-span-8 space-y-4">
          <VisualizationStudio
            data={PREVIEW_MOCK_DATA}
            columns={activeColumns}
            title={reportTitle}
            categoryKey="insurerName"
            valueKey="totalPremium"
          />
        </div>
      </div>
    </AppShell>
  );
}
