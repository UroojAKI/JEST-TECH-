import { Injectable } from '@nestjs/common';

@Injectable()
export class WorkspaceFactory {
  createDefaultWorkspace(
    jobRoleCode?: string,
    roleCode?: string,
    jobRoleName?: string,
  ) {
    const jobUpper = (jobRoleCode || '').toUpperCase();
    const roleUpper = (roleCode || '').toUpperCase();

    // ---------------------------------------------------------
    // 1. EXACT JOB ROLE MATCHING (Primary)
    // ---------------------------------------------------------

    if (jobUpper === 'SYSTEM_ADMIN') {
      return this.getAdminWorkspace(jobRoleName);
    }

    if (jobUpper === 'SALES_MANAGER') {
      return this.getSalesManagerWorkspace(jobRoleName);
    }

    if (jobUpper === 'SALES_EXEC') {
      return this.getSalesExecWorkspace(jobRoleName);
    }

    if (jobUpper === 'RENEWAL_EXEC') {
      return this.getRenewalWorkspace(jobRoleName);
    }

    if (jobUpper === 'CUSTOMER_SERVICE_EXEC') {
      return this.getCustomerServiceWorkspace(jobRoleName);
    }

    if (jobUpper === 'AGENT_RM') {
      return this.getAgentRMWorkspace(jobRoleName);
    }

    if (jobUpper === 'POLICY_ISSUANCE') {
      return this.getOperationsWorkspace(jobRoleName);
    }

    if (jobUpper === 'ACCOUNTS_EXEC') {
      return this.getFinanceWorkspace(jobRoleName);
    }

    if (jobUpper === 'MARKETING_EXEC') {
      return this.getMarketingWorkspace(jobRoleName);
    }

    if (jobUpper === 'MD_CEO') {
      return this.getExecutiveWorkspace(jobRoleName);
    }

    // ---------------------------------------------------------
    // 2. GENERIC ROLE TYPE MATCHING (Fallback 1)
    // ---------------------------------------------------------

    if (roleUpper.includes('ADMIN') || roleUpper === 'SUPER_ADMIN') {
      return this.getAdminWorkspace(jobRoleName);
    }
    if (roleUpper.includes('SALES_MANAGER') || roleUpper === 'TEAM_LEADER') {
      return this.getSalesManagerWorkspace(jobRoleName);
    }
    if (
      roleUpper.includes('SALES') ||
      roleUpper.includes('POSP') ||
      roleUpper.includes('AGENT')
    ) {
      return this.getSalesExecWorkspace(jobRoleName);
    }
    if (roleUpper.includes('RENEWAL')) {
      return this.getRenewalWorkspace(jobRoleName);
    }
    if (roleUpper.includes('CUSTOMER') || roleUpper.includes('RELATIONSHIP')) {
      return this.getCustomerServiceWorkspace(jobRoleName);
    }
    if (roleUpper.includes('AGENT_MANAGER') || roleUpper.includes('ARM')) {
      return this.getAgentRMWorkspace(jobRoleName);
    }
    if (
      roleUpper.includes('POLICY_ISSUANCE') ||
      roleUpper.includes('OPERATIONS') ||
      roleUpper.includes('UNDERWRITER') ||
      roleUpper.includes('BACK_OFFICE') ||
      roleUpper.includes('BACK OFFICE')
    ) {
      return this.getOperationsWorkspace(jobRoleName);
    }
    if (roleUpper.includes('FINANCE') || roleUpper.includes('ACCOUNTS')) {
      return this.getFinanceWorkspace(jobRoleName);
    }
    if (roleUpper.includes('MARKETING')) {
      return this.getMarketingWorkspace(jobRoleName);
    }
    if (
      roleUpper.includes('MD_CEO') ||
      roleUpper.includes('CEO') ||
      roleUpper.includes('DIRECTOR')
    ) {
      return this.getExecutiveWorkspace(jobRoleName);
    }

    // ---------------------------------------------------------
    // 3. GENERIC EMPLOYEE WORKSPACE (Fallback 2)
    // ---------------------------------------------------------

    if (roleUpper === 'EMPLOYEE' || jobUpper === 'EMPLOYEE') {
      return this.getGenericEmployeeWorkspace(jobRoleName);
    }

    // ---------------------------------------------------------
    // 4. SAFE SYSTEM DEFAULT (Absolute Fallback)
    // ---------------------------------------------------------

    return this.getSafeSystemDefaultWorkspace();
  }

  // --- CONFIGURATION FACTORIES ---

  private getAdminWorkspace(name?: string) {
    return {
      dashboardCode: 'admin-dashboard',
      workspaceCode: 'admin',
      title: name || 'Administrator Command Center',
      subtitle:
        'Enterprise governance, user provisioning, system security & parameters',
      navigation: [
        {
          id: 'admin-dash',
          title: 'Admin Overview',
          href: '/workspace/admin',
          icon: 'LayoutDashboard',
        },
        {
          id: 'users',
          title: 'User Management',
          href: '/admin/users',
          icon: 'Users',
        },
        {
          id: 'branches',
          title: 'Branches & Teams',
          href: '/admin/branches',
          icon: 'Building2',
        },
        {
          id: 'roles',
          title: 'Role Permission Matrix',
          href: '/admin/roles',
          icon: 'Shield',
        },
        {
          id: 'workflows',
          title: 'Workflow Engines',
          href: '/admin/workflows',
          icon: 'GitMerge',
        },
        {
          id: 'audit',
          title: 'Audit Trail',
          href: '/admin/audit',
          icon: 'Activity',
        },
      ],
      widgets: [
        {
          id: 'system-metrics',
          type: 'KPI',
          title: 'System Health & Traffic',
          colSpan: 12,
        },
        {
          id: 'user-activity',
          type: 'TIMELINE',
          title: 'Recent System Audit Events',
          colSpan: 6,
        },
        {
          id: 'quick-admin',
          type: 'ACTIONS',
          title: 'Administrative Triggers',
          colSpan: 6,
        },
      ],
      quickActions: [
        {
          id: 'new-user',
          title: 'Provision User',
          href: '/admin/users',
          icon: 'UserPlus',
        },
        {
          id: 'new-branch',
          title: 'Create Branch',
          href: '/admin/branches',
          icon: 'Building2',
        },
      ],
      permissions: [
        'admin:read',
        'admin:manage',
        'user:manage',
        'policy:read',
        'finance:read',
      ],
    };
  }

  private getSalesManagerWorkspace(name?: string) {
    return {
      dashboardCode: 'sales-manager-dashboard',
      workspaceCode: 'sales-management',
      title: name || 'Sales Manager Workspace',
      subtitle:
        'Team premium, conversion rate, SLA escalations, and quotation approvals',
      navigation: [
        {
          id: 'sm-dash',
          title: 'Team Dashboard',
          href: '/workspace/sales-manager',
          icon: 'LayoutDashboard',
        },
        {
          id: 'team-performance',
          title: 'Team Performance',
          href: '/sales/team',
          icon: 'Users',
        },
        {
          id: 'approvals',
          title: 'Quotation Approvals',
          href: '/sales/approvals',
          icon: 'CheckSquare',
        },
        {
          id: 'escalations',
          title: 'Escalations',
          href: '/sales/escalations',
          icon: 'ShieldAlert',
        },
      ],
      widgets: [
        {
          id: 'team-metrics',
          type: 'KPI',
          title: 'Team Production Metrics',
          colSpan: 12,
        },
        {
          id: 'pending-approvals',
          type: 'TABLE',
          title: 'Pending Quotation Approvals',
          colSpan: 8,
        },
        {
          id: 'sla-alerts',
          type: 'LIST',
          title: 'SLA Escalations',
          colSpan: 4,
        },
      ],
      quickActions: [
        {
          id: 'review-quote',
          title: 'Review Quotations',
          href: '/sales/approvals',
          icon: 'CheckSquare',
        },
      ],
      permissions: ['sales:manage', 'quote:approve', 'policy:read'],
    };
  }

  private getSalesExecWorkspace(name?: string) {
    return {
      dashboardCode: 'sales-exec-dashboard',
      workspaceCode: 'sales',
      title: name || 'Sales Executive Workspace',
      subtitle: 'My leads, my calls, pending quotes, and follow-ups',
      navigation: [
        {
          id: 'sales-dash',
          title: 'Sales Workspace',
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
          id: 'my-quotes',
          title: 'My Quotations',
          href: '/sales/quotations',
          icon: 'FileText',
        },
        {
          id: 'follow-ups',
          title: 'Scheduled Follow-ups',
          href: '/crm/leads',
          icon: 'Clock',
        },
      ],
      widgets: [
        {
          id: 'my-kpis',
          type: 'KPI',
          title: 'My Performance (Premium & Sales)',
          colSpan: 12,
        },
        {
          id: 'hot-leads',
          type: 'TABLE',
          title: 'Hot Leads & Follow-ups',
          colSpan: 8,
        },
        {
          id: 'pending-docs',
          type: 'LIST',
          title: 'Pending Documents',
          colSpan: 4,
        },
      ],
      quickActions: [
        {
          id: 'new-lead',
          title: 'Add Lead',
          href: '/crm/leads/new',
          icon: 'UserPlus',
        },
        {
          id: 'new-quote',
          title: 'Create Quote',
          href: '/sales/quotations/new',
          icon: 'FilePlus',
        },
      ],
      permissions: [
        'lead:read',
        'lead:create',
        'quote:read',
        'quote:create',
        'policy:read',
      ],
    };
  }

  private getRenewalWorkspace(name?: string) {
    return {
      dashboardCode: 'renewal-dashboard',
      workspaceCode: 'renewal',
      title: name || 'Renewals & Retention Workspace',
      subtitle:
        'Upcoming policy expirations, automated retention campaigns & renewal quotes',
      navigation: [
        {
          id: 'ren-dash',
          title: 'Renewals Hub',
          href: '/workspace/renewal',
          icon: 'RotateCw',
        },
        {
          id: 'expiring-policies',
          title: 'Expiring Policies',
          href: '/policies',
          icon: 'Clock',
        },
        {
          id: 'renewal-quotes',
          title: 'Renewal Quotations',
          href: '/sales/quotations',
          icon: 'FileSpreadsheet',
        },
      ],
      widgets: [
        {
          id: 'renewal-due-kpi',
          type: 'KPI',
          title: 'Policies Due for Renewal',
          colSpan: 12,
        },
        {
          id: 'renewal-list',
          type: 'TABLE',
          title: 'High-Value Policies Expiring Soon',
          colSpan: 8,
        },
        {
          id: 'retention-metrics',
          type: 'METRIC',
          title: 'Retention Ratio',
          colSpan: 4,
        },
      ],
      quickActions: [
        {
          id: 'dispatch-quote',
          title: 'Dispatch Renewal Reminders',
          href: '/dashboard/communications',
          icon: 'Send',
        },
      ],
      permissions: ['policy:read', 'policy:renew'],
    };
  }

  private getCustomerServiceWorkspace(name?: string) {
    return {
      dashboardCode: 'customer-dashboard',
      workspaceCode: 'customer',
      title: name || 'Customer Support & Service Workspace',
      subtitle:
        'Customer 360 view, support tickets, claim intake & service queries',
      navigation: [
        {
          id: 'cust-dash',
          title: 'Customer Desk',
          href: '/workspace/customer',
          icon: 'UserCheck',
        },
        {
          id: 'contacts-list',
          title: 'Customer Directory',
          href: '/crm/contacts',
          icon: 'Users',
        },
        {
          id: 'claims-intake',
          title: 'Claims Intake',
          href: '/claims',
          icon: 'LifeBuoy',
        },
        {
          id: 'support-tickets',
          title: 'Support Desk',
          href: '/portal/support',
          icon: 'HelpCircle',
        },
      ],
      widgets: [
        {
          id: 'csat-metric',
          type: 'KPI',
          title: 'Customer Satisfaction Score',
          colSpan: 12,
        },
        {
          id: 'open-tickets',
          type: 'TABLE',
          title: 'Active Customer Inquiries',
          colSpan: 8,
        },
        {
          id: 'recent-claims',
          type: 'LIST',
          title: 'Recent Claims',
          colSpan: 4,
        },
      ],
      quickActions: [
        {
          id: 'new-contact',
          title: 'Add Customer Contact',
          href: '/crm/contacts',
          icon: 'UserPlus',
        },
      ],
      permissions: [
        'contact:read',
        'claim:read',
        'claim:create',
        'policy:read',
      ],
    };
  }

  private getAgentRMWorkspace(name?: string) {
    return {
      dashboardCode: 'agent-dashboard',
      workspaceCode: 'agent',
      title: name || 'Agent & POSP Management Workspace',
      subtitle:
        'POSP onboarding, licensing compliance, production leaderboards',
      navigation: [
        {
          id: 'agent-dash',
          title: 'ARM Workspace',
          href: '/workspace/agent-relationship',
          icon: 'Users',
        },
        {
          id: 'agent-roster',
          title: 'Active Agents',
          href: '/agent/roster',
          icon: 'ShieldCheck',
        },
        {
          id: 'training',
          title: 'Training Logs',
          href: '/agent/training',
          icon: 'BookOpen',
        },
      ],
      widgets: [
        {
          id: 'agent-kpis',
          type: 'KPI',
          title: 'Active Agents & GWP',
          colSpan: 12,
        },
        {
          id: 'agent-leaderboard',
          type: 'TABLE',
          title: 'Top Performing POSPs',
          colSpan: 8,
        },
        {
          id: 'agent-retention',
          type: 'METRIC',
          title: 'Agent Retention',
          colSpan: 4,
        },
      ],
      quickActions: [
        {
          id: 'onboard-agent',
          title: 'Onboard New POSP',
          href: '/agent/roster',
          icon: 'UserPlus',
        },
      ],
      permissions: ['user:read', 'report:read', 'policy:read'],
    };
  }

  private getOperationsWorkspace(name?: string) {
    return {
      dashboardCode: 'operations-dashboard',
      workspaceCode: 'operations',
      title: name || 'Operations & Underwriting Workspace',
      subtitle: 'Proposal risk review, policy issuance, and verification',
      navigation: [
        {
          id: 'ops-dash',
          title: 'Operations Hub',
          href: '/workspace/operations',
          icon: 'Sliders',
        },
        {
          id: 'proposals',
          title: 'Proposal Queue',
          href: '/sales/proposals',
          icon: 'FileSpreadsheet',
        },
        {
          id: 'policy-ops',
          title: 'Policy Verification',
          href: '/policies',
          icon: 'ShieldCheck',
        },
      ],
      widgets: [
        { id: 'sla-timers', type: 'KPI', title: 'Operations TAT', colSpan: 12 },
        {
          id: 'underwriting-queue',
          type: 'TABLE',
          title: 'Pending Proposals',
          colSpan: 8,
        },
        {
          id: 'pending-verifications',
          type: 'LIST',
          title: 'Verifications Required',
          colSpan: 4,
        },
      ],
      quickActions: [
        {
          id: 'review-prop',
          title: 'Approve Proposals',
          href: '/sales/proposals',
          icon: 'CheckSquare',
        },
      ],
      permissions: ['policy:read', 'policy:issue', 'lead:read'],
    };
  }

  private getFinanceWorkspace(name?: string) {
    return {
      dashboardCode: 'finance-dashboard',
      workspaceCode: 'finance',
      title: name || 'Finance & Accounting Workspace',
      subtitle:
        'General ledger, commission payouts, premium receipts & insurer settlements',
      navigation: [
        {
          id: 'fin-dash',
          title: 'Finance Workspace',
          href: '/workspace/finance',
          icon: 'Wallet',
        },
        {
          id: 'ledger',
          title: 'General Ledger',
          href: '/finance/ledger',
          icon: 'BookOpen',
        },
        {
          id: 'commissions',
          title: 'Commissions',
          href: '/finance/commissions',
          icon: 'Percent',
        },
      ],
      widgets: [
        {
          id: 'fin-kpis',
          type: 'KPI',
          title: 'Revenue & Ledgers',
          colSpan: 12,
        },
        {
          id: 'recent-vouchers',
          type: 'TABLE',
          title: 'Journal Postings',
          colSpan: 8,
        },
        {
          id: 'pending-payouts',
          type: 'LIST',
          title: 'Pending Payouts',
          colSpan: 4,
        },
      ],
      quickActions: [
        {
          id: 'post-journal',
          title: 'Post Journal',
          href: '/finance/ledger',
          icon: 'PlusCircle',
        },
      ],
      permissions: ['finance:read', 'finance:manage', 'report:read'],
    };
  }

  private getMarketingWorkspace(name?: string) {
    return {
      dashboardCode: 'marketing-dashboard',
      workspaceCode: 'marketing',
      title: name || 'Marketing & Campaigns Workspace',
      subtitle: 'Campaign performance, lead attribution, and social engagement',
      navigation: [
        {
          id: 'marketing-dash',
          title: 'Marketing Hub',
          href: '/workspace/marketing',
          icon: 'Megaphone',
        },
        {
          id: 'campaigns',
          title: 'Campaign Calendar',
          href: '/marketing/campaigns',
          icon: 'Calendar',
        },
        {
          id: 'leads',
          title: 'Generated Leads',
          href: '/crm/leads',
          icon: 'Users',
        },
      ],
      widgets: [
        {
          id: 'campaign-roi',
          type: 'KPI',
          title: 'Lead Generation ROI',
          colSpan: 12,
        },
        {
          id: 'source-attribution',
          type: 'CHART',
          title: 'Leads by Source',
          colSpan: 8,
        },
        {
          id: 'active-campaigns',
          type: 'LIST',
          title: 'Active Campaigns',
          colSpan: 4,
        },
      ],
      quickActions: [
        {
          id: 'new-campaign',
          title: 'Launch Campaign',
          href: '/marketing/campaigns',
          icon: 'PlusCircle',
        },
      ],
      permissions: ['lead:read', 'lead:create', 'report:read'],
    };
  }

  private getExecutiveWorkspace(name?: string) {
    return {
      dashboardCode: 'executive-dashboard',
      workspaceCode: 'executive',
      title: name || 'Executive Strategy Command Center',
      subtitle:
        'Macro revenue telemetry, quarterly policy metrics & zonal growth',
      navigation: [
        {
          id: 'exec-dash',
          title: 'Executive Overview',
          href: '/workspace/executive',
          icon: 'LayoutDashboard',
        },
        {
          id: 'revenue',
          title: 'GWP Analytics',
          href: '/dashboard/reports/executive',
          icon: 'TrendingUp',
        },
        {
          id: 'bi-reports',
          title: 'BI Reports',
          href: '/dashboard/reports',
          icon: 'BarChart3',
        },
      ],
      widgets: [
        {
          id: 'gwp-kpi',
          type: 'KPI',
          title: 'Gross Written Premium (GWP)',
          colSpan: 12,
        },
        {
          id: 'zonal-chart',
          type: 'CHART',
          title: 'Branch Contribution',
          colSpan: 8,
        },
        {
          id: 'top-metrics',
          type: 'METRIC',
          title: 'Top Performers',
          colSpan: 4,
        },
      ],
      quickActions: [
        {
          id: 'exec-report',
          title: 'Generate PDF Report',
          href: '/dashboard/reports/executive',
          icon: 'FileDown',
        },
      ],
      permissions: [
        'report:read',
        'report:export',
        'policy:read',
        'finance:read',
        'lead:read',
      ],
    };
  }

  private getGenericEmployeeWorkspace(name?: string) {
    return {
      dashboardCode: 'employee-dashboard',
      workspaceCode: 'employee',
      title: name || 'Employee Workspace',
      subtitle: 'Standard self-service HR portal and generic tasks',
      navigation: [
        {
          id: 'emp-dash',
          title: 'My Workspace',
          href: '/workspace/employee',
          icon: 'User',
        },
      ],
      widgets: [
        { id: 'my-tasks', type: 'LIST', title: 'My Tasks', colSpan: 12 },
      ],
      quickActions: [],
      permissions: [],
    };
  }

  private getSafeSystemDefaultWorkspace() {
    return {
      dashboardCode: 'system-default-dashboard',
      workspaceCode: 'default',
      title: 'Default System Workspace',
      subtitle:
        'A minimal workspace when your role configuration is unavailable',
      navigation: [
        {
          id: 'safe-dash',
          title: 'Dashboard',
          href: '/workspace',
          icon: 'LayoutDashboard',
        },
        {
          id: 'safe-profile',
          title: 'My Profile',
          href: '/profile',
          icon: 'User',
        },
        {
          id: 'safe-help',
          title: 'Help & Support',
          href: '/help',
          icon: 'HelpCircle',
        },
      ],
      widgets: [
        {
          id: 'welcome-widget',
          type: 'ACTIONS',
          title: 'Welcome to JEST Policy CRM',
          colSpan: 12,
        },
      ],
      quickActions: [],
      permissions: [],
    };
  }
}
