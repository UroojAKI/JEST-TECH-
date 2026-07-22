'use client';

import React from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { SlidersHorizontal, RefreshCw, Calendar, Building, Filter } from 'lucide-react';
import { RefreshIntervalOption } from '../../types/dashboard';

export function DashboardFilterBar() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const currentBranch = searchParams.get('branchId') || 'ALL';
  const currentDateRange = searchParams.get('dateRange') || 'MTD';
  const currentProduct = searchParams.get('productType') || 'ALL';
  const currentRefresh = (searchParams.get('refresh') as RefreshIntervalOption) || '30s';

  const updateParam = (key: string, value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === 'ALL') {
      params.delete(key);
    } else {
      params.set(key, value);
    }
    router.push(`${pathname}?${params.toString()}`);
  };

  return (
    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 p-3 bg-card rounded-xl border shadow-sm text-xs">
      {/* Left section: Filter Selectors */}
      <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
        <div className="flex items-center space-x-1.5 font-bold text-muted-foreground mr-1">
          <Filter className="h-3.5 w-3.5" />
          <span>Filters:</span>
        </div>

        {/* Date Range Selector */}
        <select
          value={currentDateRange}
          onChange={(e) => updateParam('dateRange', e.target.value)}
          className="px-2.5 py-1.5 rounded-md border bg-background text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="MTD">Month to Date (MTD)</option>
          <option value="QTD">Quarter to Date (QTD)</option>
          <option value="YTD">Year to Date (YTD)</option>
          <option value="CUSTOM">Custom Range</option>
        </select>

        {/* Product Line Selector */}
        <select
          value={currentProduct}
          onChange={(e) => updateParam('productType', e.target.value)}
          className="px-2.5 py-1.5 rounded-md border bg-background text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="ALL">All Product Lines</option>
          <option value="MOTOR">Motor Insurance</option>
          <option value="HEALTH">Health Insurance</option>
          <option value="LIFE">Life Insurance</option>
          <option value="COMMERCIAL">Commercial / Fire</option>
        </select>

        {/* Branch Selector */}
        <select
          value={currentBranch}
          onChange={(e) => updateParam('branchId', e.target.value)}
          className="px-2.5 py-1.5 rounded-md border bg-background text-foreground font-medium focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="ALL">All Branches</option>
          <option value="HQ">Mumbai HQ</option>
          <option value="BR-DELHI">Delhi Branch</option>
          <option value="BR-BLR">Bangalore Branch</option>
        </select>
      </div>

      {/* Right section: Refresh Strategy Selector */}
      <div className="flex items-center space-x-2 w-full sm:w-auto justify-end">
        <span className="text-muted-foreground font-medium">Live Polling:</span>
        <select
          value={currentRefresh}
          onChange={(e) => updateParam('refresh', e.target.value)}
          className="px-2.5 py-1.5 rounded-md border bg-background text-foreground font-semibold focus:outline-none focus:ring-1 focus:ring-primary"
        >
          <option value="30s">Auto (30s)</option>
          <option value="60s">Auto (60s)</option>
          <option value="MANUAL">Manual Only</option>
          <option value="PAUSED">Paused</option>
        </select>

        <button
          onClick={() => router.refresh()}
          className="p-1.5 rounded-md border bg-muted/30 hover:bg-accent text-muted-foreground hover:text-foreground transition-colors"
          title="Force Refresh Data"
        >
          <RefreshCw className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
}
