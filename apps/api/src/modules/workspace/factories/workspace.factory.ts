import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkspaceFactory {
  createDefaultWorkspace(roleCode: string, jobRoleName?: string) {
    const roleUpper = (roleCode || 'SALES_AGENT').toUpperCase();

    if (roleUpper.includes('ADMIN') || roleUpper.includes('SUPER_ADMIN')) {
      return {
        dashboardCode: 'admin-dashboard',
        workspaceCode: 'admin',
        title: jobRoleName || 'Administrator Command Center',
        subtitle: 'Enterprise governance, user provisioning, system security & parameters',
        navigation: [
          { id: 'admin-dash', title: 'Admin Overview', href: '/workspace/admin', icon: 'LayoutDashboard' },
          { id: 'users', title: 'User Management', href: '/admin/users', icon: 'Users' },
          { id: 'branches', title: 'Branches & Teams', href: '/admin/branches', icon: 'Building2' },
          { id: 'roles', title: 'Role Permission Matrix', href: '/admin/roles', icon: 'Shield' },
          { id: 'lookups', title: 'Lookup Tables', href: '/admin/lookups', icon: 'Database' },
          { id: 'numbering', title: 'Numbering Series', href: '/admin/numbering', icon: 'Hash' },
          { id: 'workflows', title: 'Workflow Engines', href: '/admin/workflows', icon: 'GitMerge' },
          { id: 'config', title: 'System Config', href: '/admin/config', icon: 'Settings' },
          { id: 'audit', title: 'Audit Trail', href: '/admin/audit', icon: 'Activity' },
          { id: 'health', title: 'System Health', href: '/admin/health', icon: 'HeartPulse' },
        ],
        widgets: [
          { id: 'system-metrics', type: 'KPI', title: 'System Health & Traffic', colSpan: 12 },
          { id: 'user-activity', type: 'TIMELINE', title: 'Recent System Audit Events', colSpan: 6 },
          { id: 'quick-admin', type: 'ACTIONS', title: 'Administrative Triggers', colSpan: 6 },
        ],
        quickActions: [
          { id: 'new-user', title: 'Provision User', href: '/admin/users', icon: 'UserPlus' },
          { id: 'new-branch', title: 'Create Branch', href: '/admin/branches', icon: 'Building2' },
          { id: 'view-health', title: 'Health Diagnostic', href: '/admin/health', icon: 'Activity' },
        ],
        permissions: ['admin:read', 'admin:manage', 'user:manage'],
      };
    }

    if (roleUpper.includes('EXECUTIVE') || roleUpper.includes('DIRECTOR') || roleUpper.includes('CEO') || roleUpper.includes('SUPER_ADMIN')) {
      return {
        dashboardCode: 'executive-dashboard',
        workspaceCode: 'executive',
        title: jobRoleName || 'Executive Strategy Command Center',
        subtitle: 'Macro revenue telemetry, quarterly policy metrics & zonal growth',
        navigation: [
          { id: 'exec-dash', title: 'Executive Overview', href: '/workspace/executive', icon: 'LayoutDashboard' },
          { id: 'revenue', title: 'GWP & Revenue Analytics', href: '/dashboard/reports/executive', icon: 'TrendingUp' },
          { id: 'pipeline', title: 'Enterprise Pipeline', href: '/crm/leads', icon: 'PieChart' },
          { id: 'claims-overview', title: 'Loss Ratios & Claims', href: '/claims', icon: 'FileText' },
          { id: 'finance-summary', title: 'Financial Settlements', href: '/finance', icon: 'Wallet' },
          { id: 'bi-reports', title: 'Executive BI Reports', href: '/dashboard/reports', icon: 'BarChart3' },
        ],
        widgets: [
          { id: 'gwp-kpi', type: 'KPI', title: 'Gross Written Premium (GWP)', colSpan: 12 },
          { id: 'zonal-chart', type: 'CHART', title: 'Regional Branch Contribution', colSpan: 8 },
          { id: 'loss-ratio', type: 'KPI', title: 'Claims Loss Ratio', colSpan: 4 },
        ],
        quickActions: [
          { id: 'exec-report', title: 'Generate Executive PDF Report', href: '/dashboard/reports/executive', icon: 'FileDown' },
          { id: 'kpi-manager', title: 'Review Target KPIs', href: '/dashboard/reports/kpi', icon: 'Target' },
        ],
        permissions: ['report:read', 'report:export', 'policy:read', 'finance:read'],
      };
    }

    if (roleUpper.includes('FINANCE') || roleUpper.includes('ACCOUNTS')) {
      return {
        dashboardCode: 'finance-dashboard',
        workspaceCode: 'finance',
        title: jobRoleName || 'Finance & Accounting Workspace',
        subtitle: 'General ledger, commission payouts, premium receipts & insurer settlements',
        navigation: [
          { id: 'fin-dash', title: 'Finance Workspace', href: '/workspace/finance', icon: 'Wallet' },
          { id: 'ledger', title: 'General Ledger', href: '/finance/ledger', icon: 'BookOpen' },
          { id: 'commissions', title: 'Commissions Engine', href: '/finance/commissions', icon: 'Percent' },
          { id: 'payments', title: 'Payments & Collections', href: '/finance/payments', icon: 'CreditCard' },
          { id: 'receipts', title: 'Premium Receipts', href: '/finance/receipts', icon: 'Receipt' },
          { id: 'settlements', title: 'Insurer Settlements', href: '/finance/settlements', icon: 'Building2' },
        ],
        widgets: [
          { id: 'fin-kpis', type: 'KPI', title: 'Premium Revenue & Commission Ledgers', colSpan: 12 },
          { id: 'recent-vouchers', type: 'TABLE', title: 'Pending Journal Postings', colSpan: 8 },
          { id: 'settlement-status', type: 'CHART', title: 'Partner Insurer Payables', colSpan: 4 },
        ],
        quickActions: [
          { id: 'post-journal', title: 'Post Journal Voucher', href: '/finance/ledger', icon: 'PlusCircle' },
          { id: 'run-commission', title: 'Calculate Agent Payouts', href: '/finance/commissions', icon: 'DollarSign' },
        ],
        permissions: ['finance:read', 'finance:manage'],
      };
    }

    if (roleUpper.includes('UNDERWRITER') || roleUpper.includes('OPERATIONS') || roleUpper.includes('BACK_OFFICE')) {
      return {
        dashboardCode: 'operations-dashboard',
        workspaceCode: 'operations',
        title: jobRoleName || 'Operations & Underwriting Workspace',
        subtitle: 'Proposal risk review, policy issuance, endorsement processing & verification',
        navigation: [
          { id: 'ops-dash', title: 'Operations Hub', href: '/workspace/operations', icon: 'Sliders' },
          { id: 'proposals', title: 'Proposal Queue', href: '/sales/proposals', icon: 'FileSpreadsheet' },
          { id: 'policy-ops', title: 'Policy Verification', href: '/policies', icon: 'ShieldCheck' },
          { id: 'endorsements', title: 'Endorsements Work-in-Progress', href: '/dashboard/endorsements', icon: 'Edit3' },
          { id: 'documents', title: 'KYC & Document Repository', href: '/portal/downloads', icon: 'FileText' },
        ],
        widgets: [
          { id: 'underwriting-queue', type: 'TABLE', title: 'Pending Underwriting Proposals', colSpan: 8 },
          { id: 'sla-timers', type: 'METRIC', title: 'Average Turnaround Time (TAT)', colSpan: 4 },
        ],
        quickActions: [
          { id: 'review-prop', title: 'Approve Proposals', href: '/sales/proposals', icon: 'CheckSquare' },
          { id: 'issue-pol', title: 'Batch Policy Issuance', href: '/policies', icon: 'Shield' },
        ],
        permissions: ['policy:read', 'policy:issue', 'lead:read'],
      };
    }

    if (roleUpper.includes('RENEWAL')) {
      return {
        dashboardCode: 'renewal-dashboard',
        workspaceCode: 'renewal',
        title: jobRoleName || 'Renewals & Retention Workspace',
        subtitle: 'Upcoming policy expirations, automated retention campaigns & renewal quotes',
        navigation: [
          { id: 'ren-dash', title: 'Renewals Hub', href: '/workspace/renewal', icon: 'RotateCw' },
          { id: 'expiring-policies', title: 'Expiring Policies (30 Days)', href: '/policies', icon: 'Clock' },
          { id: 'renewal-quotes', title: 'Renewal Quotations', href: '/sales/quotations', icon: 'FileSpreadsheet' },
          { id: 'customer-comms', title: 'Retention Messages', href: '/dashboard/communications', icon: 'MessageSquare' },
        ],
        widgets: [
          { id: 'renewal-due-kpi', type: 'KPI', title: 'Policies Due for Renewal', colSpan: 12 },
          { id: 'renewal-list', type: 'TABLE', title: 'High-Value Policies Expiring Soon', colSpan: 8 },
        ],
        quickActions: [
          { id: 'dispatch-quote', title: 'Dispatch Renewal Reminders', href: '/dashboard/communications', icon: 'Send' },
        ],
        permissions: ['policy:read', 'policy:renew'],
      };
    }

    if (roleUpper.includes('CUSTOMER') || roleUpper.includes('RELATIONSHIP')) {
      return {
        dashboardCode: 'customer-dashboard',
        workspaceCode: 'customer',
        title: jobRoleName || 'Customer Support & Service Workspace',
        subtitle: 'Customer 360 view, support tickets, claim intake & service queries',
        navigation: [
          { id: 'cust-dash', title: 'Customer Desk', href: '/workspace/customer', icon: 'UserCheck' },
          { id: 'contacts-list', title: 'Customer Directory', href: '/crm/contacts', icon: 'Users' },
          { id: 'claims-intake', title: 'Claims Intake', href: '/claims', icon: 'LifeBuoy' },
          { id: 'support-tickets', title: 'Support Desk', href: '/portal/support', icon: 'HelpCircle' },
        ],
        widgets: [
          { id: 'open-tickets', type: 'TABLE', title: 'Active Customer Inquiries', colSpan: 8 },
          { id: 'csat-metric', type: 'KPI', title: 'Customer Satisfaction Score', colSpan: 4 },
        ],
        quickActions: [
          { id: 'new-contact', title: 'Add Customer Contact', href: '/crm/contacts', icon: 'UserPlus' },
          { id: 'file-claim', title: 'Register Claim Incident', href: '/claims', icon: 'PlusCircle' },
        ],
        permissions: ['contact:read', 'claim:read', 'claim:create'],
      };
    }

    // Default: Sales Executive / Sales Workspace
    return {
      dashboardCode: 'sales-dashboard',
      workspaceCode: 'sales',
      title: jobRoleName || 'Sales & Pipeline Workspace',
      subtitle: 'Active lead pipeline, motor/health quotations, follow-ups & policy issuance',
      navigation: [
        { id: 'sales-dash', title: 'Sales Workspace', href: '/workspace/sales', icon: 'LayoutDashboard' },
        { id: 'leads', title: 'My Leads & Pipeline', href: '/crm/leads', icon: 'Users' },
        { id: 'quotations', title: 'Quotation Engine', href: '/sales/quotations', icon: 'FileSpreadsheet' },
        { id: 'proposals', title: 'Proposals', href: '/sales/proposals', icon: 'FileText' },
        { id: 'my-policies', title: 'Issued Policies', href: '/policies', icon: 'ShieldCheck' },
        { id: 'performance', title: 'Sales Commission Tracker', href: '/portal/performance', icon: 'Award' },
      ],
      widgets: [
        { id: 'sales-kpis', type: 'KPI', title: 'Active Leads & Conversion Ratio', colSpan: 12 },
        { id: 'lead-funnel', type: 'CHART', title: 'Lead Pipeline Progression', colSpan: 8 },
        { id: 'today-followups', type: 'LIST', title: 'Today Scheduled Follow-ups', colSpan: 4 },
      ],
      quickActions: [
        { id: 'create-lead', title: 'Capture New Lead', href: '/crm/leads', icon: 'UserPlus' },
        { id: 'create-quote', title: 'Motor Quote Calculator', href: '/sales/quotations', icon: 'Calculator' },
        { id: 'issue-policy', title: 'Issue Policy Wizard', href: '/policies', icon: 'ShieldCheck' },
      ],
      permissions: ['lead:read', 'lead:create', 'policy:read', 'policy:create'],
    };
  }
}
