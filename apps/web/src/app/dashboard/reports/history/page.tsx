'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import { History, CheckCircle2, XCircle, Loader2, Clock, BookOpen } from 'lucide-react';
import Link from 'next/link';

interface SavedReport {
  id: string;
  name: string;
  category: string;
  dataSource: string;
  createdAt: string;
  _count: { runs: number };
}

export default function ReportHistoryPage() {
  const { data: savedReports = [], isLoading } = useQuery<SavedReport[]>({
    queryKey: ['saved-reports'],
    queryFn: () => api.get('/reports/saved').then((r) => r.data),
  });

  const categoryColors: Record<string, string> = {
    CRM: 'bg-blue-500/15 text-blue-400',
    SALES: 'bg-indigo-500/15 text-indigo-400',
    CLAIMS: 'bg-rose-500/15 text-rose-400',
    RENEWALS: 'bg-amber-500/15 text-amber-400',
    FINANCE: 'bg-emerald-500/15 text-emerald-400',
    OPERATIONS: 'bg-purple-500/15 text-purple-400',
    COMPLIANCE: 'bg-slate-500/15 text-slate-400',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-bold text-white flex items-center gap-2">
          <History className="h-5 w-5 text-indigo-400" /> Saved Reports & History
        </h1>
        <p className="text-xs text-slate-400 mt-1">
          All custom reports built with the Report Builder. Run, re-run, or re-configure at any time.
        </p>
      </div>

      {isLoading ? (
        <div className="glass rounded-xl border border-slate-900 p-16 text-center">
          <Loader2 className="h-6 w-6 animate-spin text-indigo-500 mx-auto" />
        </div>
      ) : savedReports.length === 0 ? (
        <div className="glass rounded-xl border border-slate-900 p-16 text-center">
          <History className="h-8 w-8 text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-400">No saved reports yet.</p>
          <p className="text-xs text-slate-500 mt-1 mb-4">Use the Report Builder to create and save your first custom report.</p>
          <Link href="/dashboard/reports/builder"
            className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors">
            <BookOpen className="h-3.5 w-3.5" /> Open Report Builder
          </Link>
        </div>
      ) : (
        <div className="glass rounded-xl border border-slate-900 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-900 bg-slate-950/20 text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3.5 px-5">Report Name</th>
                  <th className="py-3.5 px-5">Category</th>
                  <th className="py-3.5 px-5">Data Source</th>
                  <th className="py-3.5 px-5">Runs</th>
                  <th className="py-3.5 px-5">Created</th>
                  <th className="py-3.5 px-5">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-900 text-xs text-slate-300">
                {savedReports.map((report) => (
                  <tr key={report.id} className="hover:bg-slate-900/20 transition-colors">
                    <td className="py-3.5 px-5">
                      <p className="font-bold text-white">{report.name}</p>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className={`inline-block rounded px-2 py-0.5 text-[9px] font-bold ${categoryColors[report.category] ?? 'bg-slate-800 text-slate-400'}`}>
                        {report.category}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-400 capitalize">{report.dataSource}</td>
                    <td className="py-3.5 px-5">
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3 text-slate-600" />
                        {report._count.runs}
                      </span>
                    </td>
                    <td className="py-3.5 px-5 text-slate-500">
                      {new Date(report.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="py-3.5 px-5">
                      <Link href={`/dashboard/reports/${report.id}`}
                        className="text-indigo-400 hover:underline text-[10px] font-bold">
                        Run →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
