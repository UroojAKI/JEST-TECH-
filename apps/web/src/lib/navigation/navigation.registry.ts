import { NavigationItem } from '../../types';

export const navigationRegistry: NavigationItem[] = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    href: '/dashboard',
    icon: 'LayoutDashboard',
  },
  {
    id: 'crm',
    title: 'CRM & Accounts',
    href: '/crm',
    icon: 'Users',
    children: [
      { id: 'contacts', title: 'Contacts', href: '/crm/contacts', permissions: ['lead:read'] },
      { id: 'accounts', title: 'Corporate Accounts', href: '/crm/accounts', permissions: ['lead:read'] },
      { id: 'leads', title: 'Leads & Pipeline', href: '/crm/leads', permissions: ['lead:read'] },
    ],
  },
  {
    id: 'sales',
    title: 'Sales & Quotations',
    href: '/sales',
    icon: 'FileSpreadsheet',
    children: [
      { id: 'quotations', title: 'Quotations', href: '/sales/quotations', permissions: ['policy:read'] },
      { id: 'proposals', title: 'Proposals', href: '/sales/proposals', permissions: ['policy:read'] },
    ],
  },
  {
    id: 'policies',
    title: 'Policies',
    href: '/policies',
    icon: 'ShieldCheck',
    permissions: ['policy:read'],
  },
  {
    id: 'claims',
    title: 'Claims Management',
    href: '/claims',
    icon: 'FileText',
    permissions: ['claim:read'],
  },
  {
    id: 'finance',
    title: 'Finance & Accounting',
    href: '/finance',
    icon: 'Wallet',
    permissions: ['finance:read'],
    children: [
      { id: 'ledger', title: 'General Ledger', href: '/finance/ledger', permissions: ['finance:read'] },
      { id: 'commissions', title: 'Commissions Engine', href: '/finance/commissions', permissions: ['finance:manage'] },
      { id: 'payments', title: 'Payments & Revenue', href: '/finance/payments', permissions: ['finance:read'] },
    ],
  },
  {
    id: 'reports',
    title: 'Reports & BI',
    href: '/dashboard/reports',
    icon: 'BarChart3',
    permissions: ['report:read'],
    children: [
      { id: 'builder', title: 'Report Builder', href: '/dashboard/reports/builder', permissions: ['report:read'] },
      { id: 'kpi', title: 'KPI Manager', href: '/dashboard/reports/kpi', permissions: ['report:read'] },
      { id: 'history', title: 'Report History', href: '/dashboard/reports/history', permissions: ['report:export'] },
    ],
  },

  {
    id: 'administration',
    title: 'Administration',
    href: '/admin',
    icon: 'Settings',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    children: [
      { id: 'users', title: 'User Management', href: '/admin/users', roles: ['SUPER_ADMIN', 'ADMIN'] },
      { id: 'system-config', title: 'System Configurations', href: '/admin/config', roles: ['SUPER_ADMIN'] },
      { id: 'numbering', title: 'Numbering Sequences', href: '/admin/numbering', roles: ['SUPER_ADMIN'] },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    href: '/settings',
    icon: 'Sliders',
  },
];
