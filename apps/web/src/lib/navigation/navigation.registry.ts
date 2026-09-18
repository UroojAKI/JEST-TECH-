import { NavigationItem } from '../../types';

export const AGENT_NAVIGATION: NavigationItem[] = [
  {
    id: 'my-work',
    title: 'My Work',
    href: '/workspace/sales',
    icon: 'LayoutDashboard',
  },
  {
    id: 'my-leads',
    title: 'My Leads',
    href: '/crm/leads',
    icon: 'Users',
  },
  {
    id: 'my-quotations',
    title: 'My Quotations',
    href: '/sales/quotations',
    icon: 'FileSpreadsheet',
  },
  {
    id: 'my-customers',
    title: 'My Customers',
    href: '/crm/customers',
    icon: 'UserCheck',
    children: [
      { id: 'agent-customers', title: 'Customers', href: '/crm/customers' },
      { id: 'agent-contacts', title: 'Contacts (Legacy)', href: '/crm/contacts' },
      { id: 'agent-accounts', title: 'Accounts', href: '/crm/accounts' },
    ],
  },
  {
    id: 'my-policies',
    title: 'My Policies',
    href: '/policies',
    icon: 'ShieldCheck',
    children: [
      { id: 'agent-active-policies', title: 'Active Policies', href: '/policies' },
      { id: 'agent-renewals-due', title: 'Renewals Due', href: '/renewals' },
    ],
  },
  {
    id: 'my-claims',
    title: 'My Claims',
    href: '/claims',
    icon: 'FileText',
  },
  {
    id: 'settings',
    title: 'Profile & Preferences',
    href: '/settings',
    icon: 'Settings',
  },
];

export const BACK_OFFICE_NAVIGATION: NavigationItem[] = [
  {
    id: 'operations-hub',
    title: 'Operations Dashboard',
    href: '/workspace/operations',
    icon: 'Briefcase',
  },
  {
    id: 'bo-work-queue',
    title: 'Work Queue',
    href: '/workspace/operations',
    icon: 'CheckSquare',
    children: [
      { id: 'ops-issuance', title: 'Issuance Queue', href: '/workspace/operations' },
      { id: 'ops-inspections', title: 'Inspection Queue', href: '/workspace/operations?tab=inspections' },
    ],
  },
  {
    id: 'bo-customers',
    title: 'Customers',
    href: '/crm/customers',
    icon: 'Users',
    children: [
      { id: 'bo-customers-list', title: 'Customers', href: '/crm/customers' },
      { id: 'bo-contacts', title: 'Contacts (Legacy)', href: '/crm/contacts' },
      { id: 'bo-accounts', title: 'Corporate Accounts', href: '/crm/accounts' },
      { id: 'bo-leads', title: 'Operational Leads', href: '/crm/leads' },
    ],
  },
  {
    id: 'bo-quotations',
    title: 'Quotations',
    href: '/sales/quotations',
    icon: 'FileSpreadsheet',
  },
  {
    id: 'bo-policies',
    title: 'Policies',
    href: '/policies',
    icon: 'ShieldCheck',
  },
  {
    id: 'bo-renewals',
    title: 'Renewals Hub',
    href: '/renewals',
    icon: 'RotateCw',
  },
  {
    id: 'bo-claims',
    title: 'Claims Processing',
    href: '/claims',
    icon: 'FileText',
  },
  {
    id: 'bo-finance',
    title: 'Finance Operations',
    href: '/finance/payments',
    icon: 'Wallet',
    children: [
      { id: 'bo-payments', title: 'Payments', href: '/finance/payments' },
      { id: 'bo-receipts', title: 'Receipts', href: '/finance/receipts' },
      { id: 'bo-ledger', title: 'Reconciliation & Ledger', href: '/finance/ledger' },
    ],
  },
  {
    id: 'bo-documents',
    title: 'Documents',
    href: '/portal/downloads',
    icon: 'Folder',
  },
  {
    id: 'bo-reports',
    title: 'Operational Reports',
    href: '/dashboard/reports',
    icon: 'BarChart3',
  },
  {
    id: 'settings',
    title: 'Settings',
    href: '/settings',
    icon: 'Settings',
  },
];

export const ADMIN_NAVIGATION: NavigationItem[] = [
  {
    id: 'agency-command-center',
    title: 'Command Center',
    href: '/workspace/admin',
    icon: 'LayoutDashboard',
  },
  {
    id: 'business-analytics',
    title: 'Business Analytics',
    href: '/dashboard/reports',
    icon: 'BarChart3',
    children: [
      { id: 'adm-reports-overview', title: 'Performance Reports', href: '/dashboard/reports' },
      { id: 'adm-builder', title: 'Report Builder', href: '/dashboard/reports/builder' },
      { id: 'adm-health', title: 'System Health', href: '/admin/health' },
    ],
  },
  {
    id: 'adm-customers',
    title: 'Customers & CRM',
    href: '/crm/customers',
    icon: 'Users',
    children: [
      { id: 'adm-customers-list', title: 'All Customers', href: '/crm/customers' },
      { id: 'adm-contacts', title: 'Contacts (Legacy)', href: '/crm/contacts' },
      { id: 'adm-accounts', title: 'Corporate Accounts', href: '/crm/accounts' },
      { id: 'adm-leads', title: 'Agency Lead Pipeline', href: '/crm/leads' },
    ],
  },
  {
    id: 'adm-team',
    title: 'Team & Users',
    href: '/admin/users',
    icon: 'UserCheck',
    children: [
      { id: 'adm-users', title: 'User Management', href: '/admin/users' },
      { id: 'adm-roles', title: 'Roles & Privileges', href: '/admin/roles' },
      { id: 'adm-branches', title: 'Branch Management', href: '/admin/branches' },
    ],
  },
  {
    id: 'adm-policies',
    title: 'Policies & Issuance',
    href: '/policies',
    icon: 'ShieldCheck',
  },
  {
    id: 'adm-claims',
    title: 'Claims Oversight',
    href: '/claims',
    icon: 'FileText',
  },
  {
    id: 'adm-finance',
    title: 'Finance & Revenue',
    href: '/finance',
    icon: 'Wallet',
    children: [
      { id: 'adm-finance-overview', title: 'Financial Overview', href: '/finance' },
      { id: 'adm-payments', title: 'Payments', href: '/finance/payments' },
      { id: 'adm-ledger', title: 'General Ledger', href: '/finance/ledger' },
      { id: 'adm-commissions', title: 'Commissions', href: '/finance/commissions' },
    ],
  },
  {
    id: 'adm-config',
    title: 'Configuration',
    href: '/admin/config',
    icon: 'Sliders',
    children: [
      { id: 'adm-workflows', title: 'Workflows & SLAs', href: '/admin/workflows' },
      { id: 'adm-templates', title: 'Notification Templates', href: '/admin/notification-templates' },
      { id: 'adm-products', title: 'Insurance Products', href: '/admin/products' },
      { id: 'adm-insurers', title: 'Partner Insurers', href: '/admin/insurers' },
      { id: 'adm-lookups', title: 'Lookup Masters', href: '/admin/lookups' },
      { id: 'adm-numbering', title: 'Numbering Series', href: '/admin/numbering' },
    ],
  },
  {
    id: 'adm-security',
    title: 'Security & Audit',
    href: '/admin/audit',
    icon: 'ShieldAlert',
    children: [
      { id: 'adm-audit', title: 'Audit Trail', href: '/admin/audit' },
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    href: '/settings',
    icon: 'Settings',
  },
];

export function getRoleNavigation(role?: string): NavigationItem[] {
  const normalized = (role || '').toUpperCase();

  if (normalized === 'ADMIN' || normalized === 'SUPER_ADMIN' || normalized.includes('ADMIN')) {
    return ADMIN_NAVIGATION;
  }

  if (normalized === 'BACK_OFFICE' || normalized.includes('OPERATIONS') || normalized.includes('BACK_OFFICE')) {
    return BACK_OFFICE_NAVIGATION;
  }

  // Default to AGENT workspace for sales / agents / posp
  return AGENT_NAVIGATION;
}

export const navigationRegistry: NavigationItem[] = ADMIN_NAVIGATION;
