'use client';

import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  flexRender,
  type SortingState,
  type ColumnDef,
} from '@tanstack/react-table';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from 'recharts';
import {
  ArrowLeft, Download, BarChart2, TableProperties, ChevronLeft,
  ChevronRight, ChevronsLeft, ChevronsRight, ArrowUpDown, Search, Loader2,
} from 'lucide-react';

interface ReportResult {
  templateId: string;
  name: string;
  columns: string[];
  rows: Record<string, any>[];
  rowCount: number;
  generatedAt: string;
}

const COLORS = ['#6366f1', '#8b5cf6', '#06b6d4', '#10b981', '#f59e0b', '#ef4444', '#ec4899'];

function formatColHeader(col: string) {
  return col.replace(/([A-Z])/g, ' $1').replace(/^./, (s) => s.toUpperCase()).trim();
}

function formatCellValue(val: any): string {
  if (val === null || val === undefined) return '—';
  if (val instanceof Date || (typeof val === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(val))) {
    return new Date(val).toLocaleDateString('en-IN');
  }
  if (typeof val === 'number') return val.toLocaleString('en-IN');
  return String(val);
}

export default function ReportViewerPage() {
  const params = useParams();
  const templateId = params.id as string;
  const [view, setView] = useState<'table' | 'chart'>('table');
  const [sorting, setSorting] = useState<SortingState>([]);
  const [globalFilter, setGlobalFilter] = useState('');
  const [chartType, setChartType] = useState<'bar' | 'line' | 'pie'>('bar');
  const [filters, setFilters] = useState({ from: '', to: '', status: '' });

  const queryParams = new URLSearchParams();
  if (filters.from) queryParams.set('from', filters.from);
  if (filters.to) queryParams.set('to', filters.to);
  if (filters.status) queryParams.set('status', filters.status);

  const { data, isLoading, refetch } = useQuery<ReportResult>({
    queryKey: ['report-run', templateId, filters],
    queryFn: () => api.get(`/reports/run/${templateId}?${queryParams.toString()}`).then((r) => r.data),
    enabled: !!templateId,
  });

  const columns = useMemo<ColumnDef<Record<string, any>>[]>(() => {
    if (!data?.columns) return [];
    return data.columns.map((col) => ({
      accessorKey: col,
      header: ({ column }) => (
        <button
          onClick={() => column.toggleSorting(column.getIsSorted() === 'asc')}
          className="flex items-center gap-1 text-[10px] font-bold text-slate-500 uppercase tracking-wider hover:text-slate-300 transition-colors"
        >
          {formatColHeader(col)}
          <ArrowUpDown className="h-2.5 w-2.5" />
        </button>
      ),
      cell: ({ getValue }) => (
        <span className="text-xs text-slate-300">{formatCellValue(getValue())}</span>
      ),
    }));
  }, [data?.columns]);

  const table = useReactTable({
    data: data?.rows ?? [],
    columns,
    state: { sorting, globalFilter },
    onSortingChange: setSorting,
    onGlobalFilterChange: setGlobalFilter,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 25 } },
  });

  // Compute totals for numeric columns
  const totals = useMemo(() => {
    if (!data) return {};
    const tots: Record<string, number> = {};
    for (const col of data.columns) {
      const vals = data.rows.map((r) => Number(r[col])).filter((v) => !isNaN(v) && v > 0);
      if (vals.length === data.rows.length && vals.length > 0) {
        tots[col] = vals.reduce((a, b) => a + b, 0);
      }
    }
    return tots;
  }, [data]);

  // Chart data: first string col as label, first numeric col as value
  const chartData = useMemo(() => {
    if (!data?.rows.length) return [];
    const numericCol = data.columns.find((c) => typeof data.rows[0][c] === 'number');
    const labelCol = data.columns.find((c) => typeof data.rows[0][c] === 'string');
    if (!numericCol || !labelCol) return [];
    return data.rows.slice(0, 20).map((r) => ({ name: String(r[labelCol]).substring(0, 18), value: Number(r[numericCol]) }));
  }, [data]);

  const apiBase = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001/api';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-3">
          <Link href="/dashboard/reports" className="text-slate-500 hover:text-white transition-colors">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white">{data?.name ?? 'Loading Report...'}</h1>
            {data && (
              <p className="text-[10px] text-slate-500 mt-0.5">
                {data.rowCount.toLocaleString()} records · Generated {new Date(data.generatedAt).toLocaleTimeString('en-IN')}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setView('table')}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${view === 'table' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
          >
            <TableProperties className="h-3 w-3" /> Table
          </button>
          <button
            onClick={() => setView('chart')}
            className={`rounded-lg px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${view === 'chart' ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}
          >
            <BarChart2 className="h-3 w-3" /> Chart
          </button>
          <div className="w-px h-5 bg-slate-800" />
          <a
            href={`${apiBase}/reports/export/${templateId}?format=csv&${queryParams.toString()}`}
            className="rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 transition-colors"
          >
            <Download className="h-3 w-3" /> CSV
          </a>
          <a
            href={`${apiBase}/reports/export/${templateId}?format=excel&${queryParams.toString()}`}
            className="rounded-lg bg-emerald-600/15 hover:bg-emerald-600/25 text-emerald-400 px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 transition-colors"
          >
            <Download className="h-3 w-3" /> Excel
          </a>
          <a
            href={`${apiBase}/reports/export/${templateId}?format=pdf&${queryParams.toString()}`}
            className="rounded-lg bg-rose-600/15 hover:bg-rose-600/25 text-rose-400 px-3 py-1.5 text-[10px] font-bold flex items-center gap-1.5 transition-colors"
          >
            <Download className="h-3 w-3" /> PDF
          </a>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass rounded-xl border border-slate-900 p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">From Date</label>
          <input type="date" value={filters.from} onChange={(e) => setFilters((f) => ({ ...f, from: e.target.value }))}
            className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">To Date</label>
          <input type="date" value={filters.to} onChange={(e) => setFilters((f) => ({ ...f, to: e.target.value }))}
            className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none" />
        </div>
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Status Filter</label>
          <input type="text" placeholder="e.g. ACTIVE" value={filters.status} onChange={(e) => setFilters((f) => ({ ...f, status: e.target.value }))}
            className="rounded-lg bg-slate-950 px-3 py-1.5 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none w-28" />
        </div>
        <button onClick={() => refetch()}
          className="rounded-lg bg-indigo-600 px-4 py-1.5 text-xs font-bold text-white hover:bg-indigo-500 transition-colors cursor-pointer">
          Apply
        </button>
        <button onClick={() => setFilters({ from: '', to: '', status: '' })}
          className="rounded-lg bg-slate-900 px-3 py-1.5 text-xs font-bold text-slate-400 hover:text-white transition-colors cursor-pointer">
          Clear
        </button>
      </div>

      {isLoading ? (
        <div className="glass rounded-xl border border-slate-900 p-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mx-auto mb-3" />
          <p className="text-xs text-slate-400">Running report from data warehouse...</p>
        </div>
      ) : view === 'table' ? (
        /* Enterprise Data Grid */
        <div className="glass rounded-xl border border-slate-900 overflow-hidden">
          {/* Search + pagination info */}
          <div className="p-4 flex justify-between items-center border-b border-slate-900">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500" />
              <input
                value={globalFilter}
                onChange={(e) => setGlobalFilter(e.target.value)}
                placeholder="Search all columns..."
                className="pl-8 pr-3 py-1.5 rounded-lg bg-slate-950 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none w-56"
              />
            </div>
            <p className="text-[10px] text-slate-500">
              Showing {table.getState().pagination.pageIndex * table.getState().pagination.pageSize + 1}–
              {Math.min((table.getState().pagination.pageIndex + 1) * table.getState().pagination.pageSize, table.getFilteredRowModel().rows.length)} of {table.getFilteredRowModel().rows.length} rows
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id} className="border-b border-slate-900 bg-slate-950/30">
                    {hg.headers.map((header) => (
                      <th key={header.id} className="py-3 px-4">
                        {flexRender(header.column.columnDef.header, header.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-900/50">
                {table.getRowModel().rows.map((row, i) => (
                  <tr key={row.id} className={`hover:bg-slate-900/30 transition-colors ${i % 2 === 0 ? '' : 'bg-slate-950/20'}`}>
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="py-2.5 px-4">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
                {/* Totals row */}
                {Object.keys(totals).length > 0 && (
                  <tr className="border-t-2 border-indigo-500/30 bg-indigo-950/20">
                    {(data?.columns ?? []).map((col, i) => (
                      <td key={col} className="py-3 px-4 text-xs font-bold text-white">
                        {i === 0 ? 'TOTAL' : totals[col] ? totals[col].toLocaleString('en-IN') : ''}
                      </td>
                    ))}
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="p-4 border-t border-slate-900 flex items-center justify-between">
            <div className="flex items-center gap-1">
              <button onClick={() => table.setPageIndex(0)} disabled={!table.getCanPreviousPage()} className="rounded p-1 text-slate-500 hover:text-white disabled:opacity-30 cursor-pointer">
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => table.previousPage()} disabled={!table.getCanPreviousPage()} className="rounded p-1 text-slate-500 hover:text-white disabled:opacity-30 cursor-pointer">
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
              <span className="text-[10px] text-slate-400 px-2">
                Page {table.getState().pagination.pageIndex + 1} of {table.getPageCount()}
              </span>
              <button onClick={() => table.nextPage()} disabled={!table.getCanNextPage()} className="rounded p-1 text-slate-500 hover:text-white disabled:opacity-30 cursor-pointer">
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button onClick={() => table.setPageIndex(table.getPageCount() - 1)} disabled={!table.getCanNextPage()} className="rounded p-1 text-slate-500 hover:text-white disabled:opacity-30 cursor-pointer">
                <ChevronsRight className="h-3.5 w-3.5" />
              </button>
            </div>
            <select
              value={table.getState().pagination.pageSize}
              onChange={(e) => table.setPageSize(Number(e.target.value))}
              className="rounded bg-slate-900 text-xs text-slate-400 px-2 py-1 border border-slate-800"
            >
              {[10, 25, 50, 100].map((s) => <option key={s} value={s}>{s} rows</option>)}
            </select>
          </div>
        </div>
      ) : (
        /* Chart View */
        <div className="glass rounded-xl border border-slate-900 p-6 space-y-4">
          <div className="flex gap-2">
            {(['bar', 'line', 'pie'] as const).map((ct) => (
              <button key={ct} onClick={() => setChartType(ct)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-bold capitalize transition-colors cursor-pointer ${chartType === ct ? 'bg-indigo-600 text-white' : 'bg-slate-900 text-slate-400 hover:text-white'}`}>
                {ct} Chart
              </button>
            ))}
          </div>

          {chartData.length === 0 ? (
            <p className="text-xs text-slate-500 text-center py-12">Not enough numeric data to render chart for this report.</p>
          ) : (
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'bar' ? (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} />
                    <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                ) : chartType === 'line' ? (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="name" tick={{ fill: '#64748b', fontSize: 10 }} />
                    <YAxis tick={{ fill: '#64748b', fontSize: 10 }} />
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} />
                    <Line type="monotone" dataKey="value" stroke="#6366f1" strokeWidth={2} dot={{ fill: '#6366f1', r: 4 }} />
                  </LineChart>
                ) : (
                  <PieChart>
                    <Pie data={chartData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} label={({ name, percent }) => `${name} ${((percent ?? 0) * 100).toFixed(0)}%`}>
                      {chartData.map((_, i) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px', fontSize: '11px' }} />
                    <Legend />
                  </PieChart>
                )}
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
