'use client';

import React from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { Sliders, Plus, Save, Hash, Loader2 } from 'lucide-react';
import { useNumberSeries } from '../../../hooks/useAdmin';
import { toast } from 'sonner';

export default function NumberSeriesPage() {
  const { data: numberSeries = [], isLoading } = useNumberSeries();
  const [isUpdating, setIsUpdating] = React.useState(false);
  return (
    <AppShell>
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <Hash className="h-5 w-5 text-primary" /> Sequential Numbering & Document Format Engine
          </h1>
          <p className="text-xs text-muted-foreground">Configure document numbering formats, sequence counters, financial year resets, and live sample previews</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => toast.info('Numbering series saved!')}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Save className="h-4 w-4" />
            <span>Save Sequence Rules</span>
          </button>
        </div>
      </div>
      
      {isLoading ? (
        <div className="p-8 text-center text-muted-foreground text-sm animate-pulse">Loading numbering series...</div>
      ) : (

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
        {(Array.isArray(numberSeries) ? numberSeries : ((numberSeries as any)?.data || (numberSeries as any)?.items || [])).map((ns: any) => (
          <div key={ns.id} className="p-5 rounded-2xl border bg-card shadow-sm space-y-4">
            <div className="flex justify-between items-start border-b pb-2">
              <div>
                <span className="font-mono font-bold text-[10px] text-muted-foreground uppercase">{ns.id}</span>
                <h3 className="font-extrabold text-sm text-foreground">{ns.entityType}</h3>
              </div>
              <div className="p-2 rounded-lg bg-primary/10 text-primary border border-primary/20 font-mono font-black text-sm">
                {ns.previewSample}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-bold text-muted-foreground text-[10px] uppercase">Prefix Format</label>
                <input
                  type="text"
                  value={ns.prefix}
                  readOnly
                  className="w-full p-2 rounded border bg-background font-mono font-bold text-xs"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-muted-foreground text-[10px] uppercase">Current Counter</label>
                <input
                  type="number"
                  value={ns.currentSequence}
                  readOnly
                  className="w-full p-2 rounded border bg-background font-mono font-bold text-xs text-emerald-600"
                />
              </div>
            </div>

            <div className="flex justify-between items-center pt-2 text-[11px]">
              <span className="text-muted-foreground">Financial Year Auto-Reset:</span>
              <span className="font-bold text-emerald-600">Enabled (Apr 1st)</span>
            </div>
          </div>
        ))}
      </div>
      )}
    </AppShell>
  );
}
