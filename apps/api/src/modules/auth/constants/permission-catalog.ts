import { AccessScope } from '@prisma/client';

export interface PermissionDefinition {
  code: string;
  name: string;
  category: string;
  description: string;
}

export const PERMISSION_CATALOG: PermissionDefinition[] = [
  // LEAD (11 permissions: 7 lead + 4 opportunity)
  {
    code: 'lead:read',
    name: 'Read Leads',
    category: 'LEAD',
    description: 'View lead records and details',
  },
  {
    code: 'lead:create',
    name: 'Create Leads',
    category: 'LEAD',
    description: 'Create new leads',
  },
  {
    code: 'lead:update',
    name: 'Update Leads',
    category: 'LEAD',
    description: 'Update existing lead details',
  },
  {
    code: 'lead:delete',
    name: 'Delete Leads',
    category: 'LEAD',
    description: 'Delete leads (Admin only)',
  },
  {
    code: 'lead:assign',
    name: 'Assign Leads',
    category: 'LEAD',
    description: 'Assign leads to agents or teams',
  },
  {
    code: 'lead:merge',
    name: 'Merge Leads',
    category: 'LEAD',
    description: 'Merge duplicate leads',
  },
  {
    code: 'lead:export',
    name: 'Export Leads',
    category: 'LEAD',
    description: 'Export lead data to CSV/Excel',
  },
  {
    code: 'opportunity:read',
    name: 'Read Opportunities',
    category: 'LEAD',
    description: 'View opportunity pipeline',
  },
  {
    code: 'opportunity:create',
    name: 'Create Opportunities',
    category: 'LEAD',
    description: 'Create new sales opportunities',
  },
  {
    code: 'opportunity:update',
    name: 'Update Opportunities',
    category: 'LEAD',
    description: 'Update opportunity stages',
  },
  {
    code: 'opportunity:pipeline',
    name: 'Manage Opportunity Pipeline',
    category: 'LEAD',
    description: 'Configure opportunity pipeline stages',
  },

  // CONTACT (5 permissions)
  {
    code: 'contact:read',
    name: 'Read Contacts',
    category: 'CONTACT',
    description: 'View contact records',
  },
  {
    code: 'contact:create',
    name: 'Create Contacts',
    category: 'CONTACT',
    description: 'Create new contacts',
  },
  {
    code: 'contact:update',
    name: 'Update Contacts',
    category: 'CONTACT',
    description: 'Update existing contacts',
  },
  {
    code: 'contact:delete',
    name: 'Delete Contacts',
    category: 'CONTACT',
    description: 'Delete contact records',
  },
  {
    code: 'contact:export',
    name: 'Export Contacts',
    category: 'CONTACT',
    description: 'Export contact list',
  },

  // QUOTATION (6 permissions)
  {
    code: 'quotation:read',
    name: 'Read Quotations',
    category: 'QUOTATION',
    description: 'View quotations',
  },
  {
    code: 'quotation:create',
    name: 'Create Quotations',
    category: 'QUOTATION',
    description: 'Create motor quotations',
  },
  {
    code: 'quotation:update',
    name: 'Update Quotations',
    category: 'QUOTATION',
    description: 'Modify quotation details',
  },
  {
    code: 'quotation:approve',
    name: 'Approve Quotations',
    category: 'QUOTATION',
    description: 'Approve special quote terms/discounts',
  },
  {
    code: 'quotation:reject',
    name: 'Reject Quotations',
    category: 'QUOTATION',
    description: 'Reject quotation proposals',
  },
  {
    code: 'quotation:export',
    name: 'Export Quotations',
    category: 'QUOTATION',
    description: 'Export quote data',
  },

  // POLICY (6 permissions)
  {
    code: 'policy:read',
    name: 'Read Policies',
    category: 'POLICY',
    description: 'View active and historical policies',
  },
  {
    code: 'policy:create',
    name: 'Create Policies',
    category: 'POLICY',
    description: 'Create policy drafts',
  },
  {
    code: 'policy:update',
    name: 'Update Policies',
    category: 'POLICY',
    description: 'Update policy endorsements',
  },
  {
    code: 'policy:issue',
    name: 'Issue Policies',
    category: 'POLICY',
    description: 'Bind and issue insurance policies',
  },
  {
    code: 'policy:cancel',
    name: 'Cancel Policies',
    category: 'POLICY',
    description: 'Cancel active policies',
  },
  {
    code: 'policy:export',
    name: 'Export Policies',
    category: 'POLICY',
    description: 'Export policy register',
  },

  // CLAIM (7 permissions)
  {
    code: 'claim:read',
    name: 'Read Claims',
    category: 'CLAIM',
    description: 'View insurance claims',
  },
  {
    code: 'claim:create',
    name: 'Create Claims',
    category: 'CLAIM',
    description: 'Intimate new claim',
  },
  {
    code: 'claim:update',
    name: 'Update Claims',
    category: 'CLAIM',
    description: 'Update claim documentation',
  },
  {
    code: 'claim:approve',
    name: 'Approve Claims',
    category: 'CLAIM',
    description: 'Approve claim assessment',
  },
  {
    code: 'claim:reject',
    name: 'Reject Claims',
    category: 'CLAIM',
    description: 'Reject claim filing',
  },
  {
    code: 'claim:settle',
    name: 'Settle Claims',
    category: 'CLAIM',
    description: 'Authorize claim settlement payout',
  },
  {
    code: 'claim:export',
    name: 'Export Claims',
    category: 'CLAIM',
    description: 'Export claim register',
  },

  // RENEWAL (4 permissions)
  {
    code: 'renewal:read',
    name: 'Read Renewals',
    category: 'POLICY',
    description: 'View upcoming policy renewals',
  },
  {
    code: 'renewal:update',
    name: 'Update Renewals',
    category: 'POLICY',
    description: 'Update renewal notes and status',
  },
  {
    code: 'renewal:process',
    name: 'Process Renewals',
    category: 'POLICY',
    description: 'Process policy renewals',
  },
  {
    code: 'renewal:export',
    name: 'Export Renewals',
    category: 'POLICY',
    description: 'Export renewal schedules',
  },

  // DOCUMENT (3 permissions)
  {
    code: 'document:read',
    name: 'Read Documents',
    category: 'DOCUMENT',
    description: 'View and download uploaded documents',
  },
  {
    code: 'document:upload',
    name: 'Upload Documents',
    category: 'DOCUMENT',
    description: 'Upload policy/claim verification documents',
  },
  {
    code: 'document:delete',
    name: 'Delete Documents',
    category: 'DOCUMENT',
    description: 'Delete attached files',
  },

  // COMMISSION / FINANCE (4 permissions)
  {
    code: 'commission:read',
    name: 'Read Commissions',
    category: 'ACCOUNT',
    description: 'View commission statements',
  },
  {
    code: 'commission:process',
    name: 'Process Commissions',
    category: 'ACCOUNT',
    description: 'Calculate and process payouts',
  },
  {
    code: 'commission:configure',
    name: 'Configure Commissions',
    category: 'ACCOUNT',
    description: 'Manage commission grid slabs',
  },
  {
    code: 'commission:export',
    name: 'Export Commissions',
    category: 'ACCOUNT',
    description: 'Export commission disbursement reports',
  },

  // REPORT (3 permissions)
  {
    code: 'report:read',
    name: 'Read Reports',
    category: 'REPORT',
    description: 'Access BI and operational dashboards',
  },
  {
    code: 'report:create',
    name: 'Create Reports',
    category: 'REPORT',
    description: 'Build custom report definitions',
  },
  {
    code: 'report:export',
    name: 'Export Reports',
    category: 'REPORT',
    description: 'Export raw analytical datasets',
  },

  // USER (5 permissions)
  {
    code: 'user:read',
    name: 'Read Users',
    category: 'USER',
    description: 'View user directory',
  },
  {
    code: 'user:create',
    name: 'Create Users',
    category: 'USER',
    description: 'Provision new staff user accounts',
  },
  {
    code: 'user:update',
    name: 'Update Users',
    category: 'USER',
    description: 'Update employee profiles',
  },
  {
    code: 'user:delete',
    name: 'Delete Users',
    category: 'USER',
    description: 'Delete user accounts',
  },
  {
    code: 'user:deactivate',
    name: 'Deactivate Users',
    category: 'USER',
    description: 'Suspend or deactivate accounts',
  },

  // SYSTEM (2 permissions)
  {
    code: 'system:manage',
    name: 'Manage System Settings',
    category: 'SYSTEM',
    description: 'Configure system-wide parameters and integrations',
  },
  {
    code: 'audit:read',
    name: 'Read Audit Logs',
    category: 'SYSTEM',
    description: 'Review security audit trails',
  },
];

export const CANONICAL_ROLE_GRANTS = {
  ADMIN: PERMISSION_CATALOG.map((p) => ({
    code: p.code,
    scope: AccessScope.ALL,
  })),

  BACK_OFFICE: PERMISSION_CATALOG.filter(
    (p) =>
      ![
        'user:create',
        'user:delete',
        'user:deactivate',
        'system:manage',
        'audit:read',
        'commission:configure',
        'lead:delete',
      ].includes(p.code),
  ).map((p) => ({
    code: p.code,
    scope: AccessScope.ORGANIZATION,
  })),

  AGENT: [
    // Field sales (OWN + ASSIGNED)
    { code: 'lead:read', scope: AccessScope.OWN },
    { code: 'lead:read', scope: AccessScope.ASSIGNED },
    { code: 'lead:create', scope: AccessScope.OWN },
    { code: 'lead:update', scope: AccessScope.OWN },
    { code: 'lead:update', scope: AccessScope.ASSIGNED },
    { code: 'opportunity:read', scope: AccessScope.OWN },
    { code: 'opportunity:read', scope: AccessScope.ASSIGNED },
    { code: 'opportunity:create', scope: AccessScope.OWN },
    { code: 'opportunity:update', scope: AccessScope.OWN },
    { code: 'opportunity:update', scope: AccessScope.ASSIGNED },
    { code: 'renewal:read', scope: AccessScope.OWN },
    { code: 'renewal:read', scope: AccessScope.ASSIGNED },
    { code: 'renewal:update', scope: AccessScope.OWN },
    { code: 'renewal:update', scope: AccessScope.ASSIGNED },
    // Portfolio & relationship (OWN)
    { code: 'contact:read', scope: AccessScope.OWN },
    { code: 'contact:create', scope: AccessScope.OWN },
    { code: 'contact:update', scope: AccessScope.OWN },
    { code: 'quotation:read', scope: AccessScope.OWN },
    { code: 'quotation:create', scope: AccessScope.OWN },
    { code: 'quotation:update', scope: AccessScope.OWN },
    { code: 'policy:read', scope: AccessScope.OWN },
    { code: 'policy:create', scope: AccessScope.OWN },
    { code: 'policy:update', scope: AccessScope.OWN },
    { code: 'claim:read', scope: AccessScope.OWN },
    { code: 'claim:create', scope: AccessScope.OWN },
    { code: 'document:read', scope: AccessScope.OWN },
    { code: 'document:upload', scope: AccessScope.OWN },
    { code: 'commission:read', scope: AccessScope.OWN },
  ],
};
