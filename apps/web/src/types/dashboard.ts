import React from 'react';
import { RoleType, Permission } from './index';

export type RefreshIntervalOption = '30s' | '60s' | 'MANUAL' | 'PAUSED';

export interface DashboardFilterParams {
  branchId?: string;
  dateRange?: 'MTD' | 'QTD' | 'YTD' | 'CUSTOM';
  productType?: string;
  insurerId?: string;
  agentId?: string;
  refreshStrategy?: RefreshIntervalOption;
}

export interface WidgetConfig {
  id: string;
  type: 'KPI' | 'CHART' | 'TABLE' | 'TIMELINE' | 'ACTIONS';
  title: string;
  roles?: RoleType[];
  permissions?: Permission[];
  featureFlag?: string;
  refreshInterval?: number; // in milliseconds
  cacheTime?: number;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  lazy?: boolean;
  gridSpan: string; // e.g. "col-span-12 md:col-span-6"
  component?: React.ComponentType<any> | null;
}

export interface DashboardLayout {
  userId: string;
  role: RoleType;
  widgets: Array<{
    id: string;
    position: number;
    collapsed: boolean;
    hidden: boolean;
  }>;
}

export interface QuickActionConfig {
  id: string;
  title: string;
  href: string;
  icon: string;
  roles?: RoleType[];
  permissions?: Permission[];
  variant?: 'primary' | 'secondary' | 'outline';
}
