import { WidgetConfig } from '../../types/dashboard';
import { RevenueTrendWidget } from './widgets/RevenueTrendWidget';
import { LeadFunnelWidget } from './widgets/LeadFunnelWidget';
import { FilteredActivityTimelineWidget } from './widgets/FilteredActivityTimelineWidget';
import { RoleQuickActionsWidget } from './widgets/RoleQuickActionsWidget';

// Workspaces (these DO use default exports)
import ManagingDirectorDashboard from './workspaces/ManagingDirectorDashboard';
import SalesManagerDashboard from './workspaces/SalesManagerDashboard';

export const WIDGET_REGISTRY: WidgetConfig[] = [
  {
    id: 'kpi-summary',
    type: 'KPI',
    title: 'Enterprise Metrics Overview',
    priority: 'HIGH',
    gridSpan: 'col-span-12',
    component: RoleQuickActionsWidget,
  },
  {
    id: 'revenue-trend',
    type: 'CHART',
    title: 'Gross Written Premium (GWP) Trend',
    priority: 'HIGH',
    gridSpan: 'col-span-12 md:col-span-7',
    component: RevenueTrendWidget,
  },
  {
    id: 'lead-funnel',
    type: 'CHART',
    title: 'Lead Pipeline Funnel',
    priority: 'MEDIUM',
    gridSpan: 'col-span-12 md:col-span-5',
    component: LeadFunnelWidget,
  },
  {
    id: 'claims-status',
    type: 'CHART',
    title: 'Claims Distribution',
    priority: 'MEDIUM',
    permissions: ['claim:read'],
    gridSpan: 'col-span-12 md:col-span-6',
    component: null as any,
  },
  {
    id: 'renewals-forecast',
    type: 'TABLE',
    title: 'Upcoming Policy Renewals',
    priority: 'HIGH',
    permissions: ['policy:read'],
    gridSpan: 'col-span-12 md:col-span-6',
    component: null as any,
  },
  {
    id: 'activity-timeline',
    type: 'TIMELINE',
    title: 'Live Operational Feed',
    priority: 'MEDIUM',
    gridSpan: 'col-span-12 md:col-span-8',
    component: FilteredActivityTimelineWidget,
  },
  {
    id: 'team-leaderboard',
    type: 'TABLE',
    title: 'Sales Leaderboard',
    priority: 'LOW',
    roles: ['SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER'],
    gridSpan: 'col-span-12 md:col-span-4',
    component: null as any,
  },
  {
    id: 'managing-director',
    type: 'KPI',
    title: 'Managing Director Workspace',
    priority: 'HIGH',
    gridSpan: 'col-span-12',
    component: ManagingDirectorDashboard,
  },
  {
    id: 'sales-manager',
    type: 'KPI',
    title: 'Sales Manager Workspace',
    priority: 'HIGH',
    gridSpan: 'col-span-12',
    component: SalesManagerDashboard,
  }
];
