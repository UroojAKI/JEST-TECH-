import { QuickActionConfig } from '../../types/dashboard';

export const QUICK_ACTION_REGISTRY: QuickActionConfig[] = [
  {
    id: 'add-lead',
    title: '+ New Lead',
    href: '/crm/leads',
    icon: 'UserPlus',
    permissions: ['lead:create'],
    variant: 'primary',
  },
  {
    id: 'create-quote',
    title: '+ Create Quote',
    href: '/sales/quotations',
    icon: 'FileSpreadsheet',
    permissions: ['policy:read'],
    variant: 'secondary',
  },
  {
    id: 'issue-policy',
    title: '+ Issue Policy',
    href: '/policies',
    icon: 'ShieldCheck',
    permissions: ['policy:issue'],
    variant: 'outline',
  },
  {
    id: 'lodge-claim',
    title: '+ Lodge Claim',
    href: '/claims',
    icon: 'FileText',
    permissions: ['claim:create'],
    variant: 'outline',
  },
  {
    id: 'user-management',
    title: 'User Management',
    href: '/admin/users',
    icon: 'Users',
    roles: ['SUPER_ADMIN', 'ADMIN'],
    variant: 'outline',
  },
  {
    id: 'system-config',
    title: 'System Configurations',
    href: '/admin/config',
    icon: 'Settings',
    roles: ['SUPER_ADMIN'],
    variant: 'outline',
  },
];
