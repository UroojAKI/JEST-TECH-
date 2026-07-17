'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import { api } from '@/lib/api';
import {
  BookOpen, Users, Sparkles, ShieldCheck, AlertTriangle,
  CalendarClock, TrendingUp, BarChart2, Shield, Search,
  ChevronRight, Play, Download, Filter,
} from 'lucide-react';

interface ReportTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  dataSource: string;
  defaultColumns: string[];
  icon: string;
}

const iconMap: Record<string, React.ElementType> = {
  Users, Sparkles, ShieldCheck, AlertTriangle,
  CalendarClock, TrendingUp, BarChart2, Shield,
  Filter, BookOpen, CheckCircle: ShieldCheck, XCircle: AlertTriangle,
  Clock: CalendarClock, AlertCircle: AlertTriangle, Calendar: CalendarClock,
  CalendarX: CalendarClock, IndianRupee: TrendingUp, FileText: BookOpen,
  ClipboardList: BookOpen, LogIn: Users, FileSearch: Shield, UserCheck: Users,
};

const categoryColors: Record<string, string> = {
  CRM: 'bg-blue-500/15 text-blue-400 border border-blue-500/25',
  SALES: 'bg-indigo-500/15 text-indigo-400 border border-indigo-500/25',
  CLAIMS: 'bg-rose-500/15 text-rose-400 border border-rose-500/25',
  RENEWALS: 'bg-amber-500/15 text-amber-400 border border-amber-500/25',
  FINANCE: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/25',
  OPERATIONS: 'bg-purple-500/15 text-purple-400 border border-purple-500/25',
  COMPLIANCE: 'bg-slate-500/15 text-slate-400 border border-slate-500/25',
};

const categories = ['ALL', 'CRM', 'SALES', 'CLAIMS', 'RENEWALS', 'FINANCE', 'OPERATIONS', 'COMPLIANCE'];

export default function ReportsLibraryPage() {
  const [search, setSearch] = useState('');
  const [activeCategory, setActiveCategory] = useState('ALL');

  const { data: templates = [], isLoading } = useQuery<ReportTemplate[]>({
    queryKey: ['report-library'],
    queryFn: () => api.get('/reports/library').then((r) => r.data),
  });

  const filtered = templates.filter((t) => {
    const matchCat = activeCategory === 'ALL' || t.category === activeCategory;
    const matchSearch = !search || t.name.toLowerCase().includes(search.toLowerCase()) || t.description.toLowerCase().includes(search.toLowerCase());
    return matchCat && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
        <div>
          <h1 className="text-xl font-bold text-white flex items-center gap-2">
            <BookOpen className="h-5 w-5 text-indigo-400" /> Reports Library
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            {templates.length} built-in reports across 7 categories — run, filter, and export instantly.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/dashboard/reports/builder"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white hover:bg-indigo-500 transition-colors flex items-center gap-2"
          >
            <Filter className="h-3.5 w-3.5" /> Build Custom Report
          </Link>
        </div>
      </div>

      {/* Search + Category Filter */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
          <input
            type="text"
            placeholder="Search reports..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg bg-slate-950 pl-9 pr-3 py-2 text-xs text-white border border-slate-800 focus:border-indigo-500 focus:outline-none"
          />
        </div>
        <div className="flex gap-1.5 flex-wrap">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-bold transition-colors cursor-pointer ${
                activeCategory === cat
                  ? 'bg-indigo-600 text-white'
                  : 'bg-slate-900 text-slate-400 hover:text-white'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Report Cards Grid */}
      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass rounded-xl border border-slate-900 p-5 animate-pulse">
              <div className="h-4 bg-slate-800 rounded w-2/3 mb-3" />
              <div className="h-3 bg-slate-800 rounded w-full mb-2" />
              <div className="h-3 bg-slate-800 rounded w-4/5" />
            </div>
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="glass rounded-xl border border-slate-900 p-16 text-center">
          <BookOpen className="h-8 w-8 text-slate-700 mx-auto mb-3" />
          <p className="text-sm font-bold text-slate-400">No reports match your filters.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((template) => {
            const IconComp = iconMap[template.icon] ?? BookOpen;
            return (
              <div
                key={template.id}
                className="glass rounded-xl border border-slate-900 p-5 flex flex-col gap-4 hover:border-indigo-500/40 transition-colors group"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-indigo-600/10 p-2.5">
                      <IconComp className="h-4 w-4 text-indigo-400" />
                    </div>
                    <div>
                      <h3 className="text-sm font-bold text-white leading-tight">{template.name}</h3>
                      <span className={`inline-block mt-1 rounded px-2 py-0.5 text-[9px] font-bold ${categoryColors[template.category] ?? categoryColors.CRM}`}>
                        {template.category}
                      </span>
                    </div>
                  </div>
                </div>

                <p className="text-xs text-slate-400 leading-relaxed flex-1">{template.description}</p>

                <div className="flex items-center gap-2 border-t border-slate-900 pt-3">
                  <Link
                    href={`/dashboard/reports/${template.id}`}
                    className="flex-1 rounded-lg bg-indigo-600/10 hover:bg-indigo-600/20 text-indigo-400 py-2 text-[10px] font-bold flex items-center justify-center gap-1.5 transition-colors"
                  >
                    <Play className="h-3 w-3" /> Run Report
                  </Link>
                  <a
                    href={`${process.env.NEXT_PUBLIC_API_URL}/reports/export/${template.id}?format=csv`}
                    className="rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-white px-3 py-2 text-[10px] font-bold flex items-center gap-1.5 transition-colors"
                  >
                    <Download className="h-3 w-3" /> CSV
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary Stats */}
      <div className="grid grid-cols-3 sm:grid-cols-7 gap-3 mt-2">
        {categories.slice(1).map((cat) => {
          const count = templates.filter((t) => t.category === cat).length;
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className="glass rounded-lg border border-slate-900 p-3 text-center hover:border-indigo-500/30 transition-colors cursor-pointer"
            >
              <p className="text-lg font-bold text-white">{count}</p>
              <p className="text-[9px] text-slate-500 mt-0.5">{cat}</p>
            </button>
          );
        })}
      </div>
    </div>
  );
}
