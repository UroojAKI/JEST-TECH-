'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../../components/layout/app-shell';
import { Database, Download, RefreshCw, HardDrive, Cpu, CheckCircle2, Server } from 'lucide-react';
import { toast } from 'sonner';

const WAREHOUSE_TABLES = [
  { name: 'fact_policies_issued', records: '1,42,850', size: '245 MB', lastSync: '10 mins ago', status: 'SYNCED' },
  { name: 'fact_claims_settled', records: '28,400', size: '98 MB', lastSync: '10 mins ago', status: 'SYNCED' },
  { name: 'dim_customers_360', records: '86,200', size: '112 MB', lastSync: '15 mins ago', status: 'SYNCED' },
  { name: 'dim_vehicle_master', records: '4,15,000', size: '480 MB', lastSync: '1 hour ago', status: 'SYNCED' },
  { name: 'fact_commission_ledgers', records: '92,100', size: '175 MB', lastSync: '10 mins ago', status: 'SYNCED' },
];

export default function DataWarehousePage() {
  const [isSyncing, setIsSyncing] = useState(false);

  const handleSyncETL = () => {
    setIsSyncing(true);
    setTimeout(() => {
      setIsSyncing(false);
      toast.success('ETL Pipeline executed: Data Warehouse synchronized with Postgres OLTP!');
    }, 1000);
  };

  const handleExportTable = (tableName: string) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [`Table Name,Records,Size,Status`, `${tableName},100000,200MB,SYNCED`].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `${tableName}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success(`Exported ${tableName} data extract!`);
  };

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-5 w-5 text-primary" /> Enterprise Data Warehouse & Analytics Engine
          </h1>
          <p className="text-xs text-muted-foreground">Read-replica analytical data store, ETL sync pipelines, and OLAP reporting tables</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={handleSyncETL}
            disabled={isSyncing}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${isSyncing ? 'animate-spin' : ''}`} />
            <span>{isSyncing ? 'Syncing ETL...' : 'Trigger Full Sync'}</span>
          </button>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs">
        <div className="p-4 rounded-xl border bg-card space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-bold text-[10px] uppercase">Warehouse Storage</span>
            <HardDrive className="h-4 w-4 text-primary" />
          </div>
          <div className="text-lg font-black font-mono">1.11 GB</div>
          <p className="text-[10px] text-emerald-500 font-medium">PostgreSQL Read Replica Active</p>
        </div>

        <div className="p-4 rounded-xl border bg-card space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-bold text-[10px] uppercase">Total OLAP Records</span>
            <Server className="h-4 w-4 text-indigo-500" />
          </div>
          <div className="text-lg font-black font-mono">7,64,550</div>
          <p className="text-[10px] text-muted-foreground">Across 5 Analytical Marts</p>
        </div>

        <div className="p-4 rounded-xl border bg-card space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-bold text-[10px] uppercase">ETL Pipeline Status</span>
            <Cpu className="h-4 w-4 text-emerald-500" />
          </div>
          <div className="text-lg font-black font-mono text-emerald-600">HEALTHY</div>
          <p className="text-[10px] text-emerald-500 font-medium">0 Sync Errors Logged</p>
        </div>

        <div className="p-4 rounded-xl border bg-card space-y-1">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="font-bold text-[10px] uppercase">Query Performance</span>
            <CheckCircle2 className="h-4 w-4 text-primary" />
          </div>
          <div className="text-lg font-black font-mono">42 ms avg</div>
          <p className="text-[10px] text-muted-foreground">Read Replica Isolated</p>
        </div>
      </div>

      {/* Warehouse Tables Listing */}
      <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
        <div className="p-4 border-b font-bold text-sm bg-muted/20">Analytical Data Marts & Export Registers</div>
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
              <th className="p-3.5">Table Name</th>
              <th className="p-3.5">Record Count</th>
              <th className="p-3.5">Storage Footprint</th>
              <th className="p-3.5">Last Sync</th>
              <th className="p-3.5">Status</th>
              <th className="p-3.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {WAREHOUSE_TABLES.map((t) => (
              <tr key={t.name} className="hover:bg-accent/40">
                <td className="p-3.5 font-mono font-bold text-primary">{t.name}</td>
                <td className="p-3.5 font-semibold">{t.records}</td>
                <td className="p-3.5 font-mono text-muted-foreground">{t.size}</td>
                <td className="p-3.5 text-muted-foreground">{t.lastSync}</td>
                <td className="p-3.5">
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                    {t.status}
                  </span>
                </td>
                <td className="p-3.5 text-right">
                  <button
                    onClick={() => handleExportTable(t.name)}
                    className="flex items-center space-x-1 ml-auto px-3 py-1 rounded border bg-background hover:bg-accent text-xs font-semibold"
                  >
                    <Download className="h-3 w-3" />
                    <span>Export Extract</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </AppShell>
  );
}
