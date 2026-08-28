'use client';

import React, { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { SalesDashboard } from '../../../components/workspaces/sales/SalesDashboard';
import { MotorQuotationsWorkspace } from '../../../components/sales/MotorQuotationsWorkspace';
import { LayoutDashboard, Car } from 'lucide-react';

export default function SalesWorkspacePage() {
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'quotes' ? 'QUOTES' : 'OVERVIEW';
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'QUOTES'>(initialTab);

  return (
    <div className="space-y-6">
      {/* Workspace Tab Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b pb-4 gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight text-foreground">
            Sales &amp; Distribution Workspace
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Qualified leads, client follow-ups, motor quote calculations &amp; proposal binding
          </p>
        </div>

        {/* Tab Switcher */}
        <div className="inline-flex rounded-xl bg-muted/60 p-1 border">
          <button
            onClick={() => setActiveTab('OVERVIEW')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'OVERVIEW'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <LayoutDashboard className="h-3.5 w-3.5 text-primary" />
            <span>Pipeline &amp; Tasks</span>
          </button>
          <button
            onClick={() => setActiveTab('QUOTES')}
            className={`flex items-center space-x-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              activeTab === 'QUOTES'
                ? 'bg-card text-foreground shadow-xs'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <Car className="h-3.5 w-3.5 text-primary" />
            <span>Motor Quotations</span>
          </button>
        </div>
      </div>

      {/* Tab Body */}
      {activeTab === 'OVERVIEW' ? (
        <SalesDashboard />
      ) : (
        <MotorQuotationsWorkspace />
      )}
    </div>
  );
}
