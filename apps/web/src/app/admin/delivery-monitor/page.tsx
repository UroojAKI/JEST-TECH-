'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Activity, Server, CheckCircle2, AlertTriangle, RefreshCw, Filter, Search } from 'lucide-react';
import { useDeliveryLogs, useEventStream } from '../../../hooks/useCommunications';

export default function DeliveryMonitorPage() {
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const { data: deliveryLogs = [] } = useDeliveryLogs();
  const { data: eventStream = [] } = useEventStream(selectedCategory === 'ALL' ? undefined : selectedCategory);

  const filteredEvents = Array.isArray(eventStream) ? eventStream : [];
  const logs = Array.isArray(deliveryLogs) ? deliveryLogs : [];

  return (
    <AppShell>
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Activity className="h-5 w-5 text-emerald-500" /> Channel Delivery Monitor & Domain Event Stream
          </h1>
          <p className="text-xs text-muted-foreground">Monitor message dispatch retry counts, provider latencies, and real-time backend domain events</p>
        </div>
      </div>

      {/* Grid: Delivery Monitor (Top) */}
      <div className="space-y-3">
        <h3 className="font-bold text-xs uppercase text-muted-foreground">Channel Delivery Monitor Logs</h3>
        <div className="border rounded-xl overflow-hidden bg-card text-xs shadow-sm">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-muted/40 text-[10px] text-muted-foreground font-bold border-b uppercase">
                <th className="p-3">Log ID</th>
                <th className="p-3">Recipient</th>
                <th className="p-3">Channel</th>
                <th className="p-3">Status</th>
                <th className="p-3">Retries</th>
                <th className="p-3">Provider</th>
                <th className="p-3">Latency</th>
                <th className="p-3 font-mono">Timestamp</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {logs.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-4 text-center text-muted-foreground">No channel delivery logs recorded.</td>
                </tr>
              ) : (
                logs.map((log: any) => (
                  <tr key={log.id} className="hover:bg-accent/40">
                    <td className="p-3 font-mono font-bold text-primary">{log.id}</td>
                    <td className="p-3 font-semibold">{log.recipient}</td>
                    <td className="p-3 font-bold text-[10px] uppercase text-muted-foreground">{log.channel}</td>
                    <td className="p-3 font-bold text-emerald-600">{log.status}</td>
                    <td className="p-3 font-mono">{log.retryCount || 0}</td>
                    <td className="p-3 text-muted-foreground">{log.provider || 'Gateway'}</td>
                    <td className="p-3 font-mono">{log.latencyMs || 0}ms</td>
                    <td className="p-3 font-mono text-[11px]">{log.timestamp ? new Date(log.timestamp).toLocaleString() : 'N/A'}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Domain Event Stream (Bottom) */}
      <div className="space-y-3 pt-4 border-t">
        <div className="flex justify-between items-center">
          <h3 className="font-bold text-xs uppercase text-muted-foreground">Domain Event Stream</h3>
          <div className="flex border text-xs overflow-x-auto p-1 bg-card rounded-lg space-x-1">
            {['ALL', 'WORKFLOW', 'CLAIMS', 'NOTIFICATION', 'FINANCE'].map((cat) => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-2.5 py-1 rounded font-bold text-[10px] transition-colors ${
                  selectedCategory === cat ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-accent'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-2 text-xs">
          {filteredEvents.map((evt) => (
            <div key={evt.id} className="p-3.5 rounded-xl border bg-card flex justify-between items-center shadow-sm">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="font-mono font-bold text-primary text-xs">{evt.eventType}</span>
                  <span className="px-2 py-0.5 rounded bg-muted text-[10px] font-bold border uppercase">{evt.category}</span>
                </div>
                <div className="font-bold text-foreground">{evt.summary}</div>
              </div>
              <div className="text-right text-[10px] text-muted-foreground">
                <div>By {evt.userEmail}</div>
                <div className="font-mono">{evt.timestamp}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
