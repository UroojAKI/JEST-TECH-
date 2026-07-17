import { Injectable } from '@nestjs/common';
import { ReportCategory } from '@prisma/client';

export interface ReportTemplate {
  id: string;          // slug used for /reports/run/:id
  name: string;
  description: string;
  category: ReportCategory;
  dataSource: string;
  defaultColumns: string[];
  availableFilters: string[];
  icon: string;
}

@Injectable()
export class ReportLibraryService {
  private readonly templates: ReportTemplate[] = [
    // CRM
    { id: 'contact-register', name: 'Contact Register', description: 'Full list of all contacts with type, status, and location.', category: ReportCategory.CRM, dataSource: 'contacts', defaultColumns: ['fullName', 'email', 'phone', 'type', 'status', 'city', 'state', 'createdAt'], availableFilters: ['from', 'to', 'type'], icon: 'Users' },
    { id: 'customer-summary', name: 'Customer Summary', description: 'Active customers with associated policy counts.', category: ReportCategory.CRM, dataSource: 'contacts', defaultColumns: ['fullName', 'email', 'phone', 'type', 'createdAt'], availableFilters: ['from', 'to'], icon: 'UserCheck' },
    { id: 'lead-register', name: 'Lead Register', description: 'All leads with stage, source, and assignment.', category: ReportCategory.CRM, dataSource: 'leads', defaultColumns: ['leadCode', 'contactName', 'status', 'source', 'productType', 'assignedAgentName', 'createdAt'], availableFilters: ['from', 'to', 'status', 'agentId'], icon: 'Sparkles' },
    { id: 'lead-funnel', name: 'Lead Funnel', description: 'Lead stage-by-stage funnel analysis.', category: ReportCategory.CRM, dataSource: 'leads', defaultColumns: ['leadCode', 'contactName', 'status', 'assignedAgentName', 'createdAt', 'convertedAt'], availableFilters: ['from', 'to'], icon: 'Filter' },

    // Sales
    { id: 'quotation-summary', name: 'Quotation Summary', description: 'All quotations with insurer, product, and status.', category: ReportCategory.SALES, dataSource: 'policies', defaultColumns: ['policyNumber', 'contactName', 'insurerName', 'productType', 'premiumAmount', 'status', 'createdAt'], availableFilters: ['from', 'to', 'status'], icon: 'FileText' },
    { id: 'proposal-status', name: 'Proposal Status', description: 'Underwriting pipeline — all proposals and their stages.', category: ReportCategory.SALES, dataSource: 'leads', defaultColumns: ['contactName', 'status', 'assignedAgentName', 'createdAt'], availableFilters: ['from', 'to', 'status'], icon: 'ClipboardList' },
    { id: 'policies-issued', name: 'Policies Issued', description: 'All issued policies with insurer and premium breakdown.', category: ReportCategory.SALES, dataSource: 'policies', defaultColumns: ['policyNumber', 'contactName', 'insurerName', 'productType', 'premiumAmount', 'effectiveDate', 'expiryDate'], availableFilters: ['from', 'to', 'status'], icon: 'ShieldCheck' },

    // Claims
    { id: 'open-claims', name: 'Open Claims', description: 'All currently open and registered claims.', category: ReportCategory.CLAIMS, dataSource: 'claims', defaultColumns: ['claimNumber', 'policyNumber', 'contactName', 'status', 'claimAmount', 'reportedAt'], availableFilters: ['from', 'to'], icon: 'AlertTriangle' },
    { id: 'settled-claims', name: 'Settled Claims', description: 'All settled claims with approved amounts.', category: ReportCategory.CLAIMS, dataSource: 'claims', defaultColumns: ['claimNumber', 'policyNumber', 'contactName', 'claimAmount', 'approvedAmount', 'reportedAt'], availableFilters: ['from', 'to'], icon: 'CheckCircle' },
    { id: 'rejected-claims', name: 'Rejected Claims', description: 'Claims that were rejected with reason tracking.', category: ReportCategory.CLAIMS, dataSource: 'claims', defaultColumns: ['claimNumber', 'policyNumber', 'contactName', 'claimAmount', 'status', 'reportedAt'], availableFilters: ['from', 'to'], icon: 'XCircle' },
    { id: 'claim-aging', name: 'Claim Aging', description: 'Open claims sorted by days since reported.', category: ReportCategory.CLAIMS, dataSource: 'claims', defaultColumns: ['claimNumber', 'policyNumber', 'contactName', 'claimAmount', 'status', 'reportedAt'], availableFilters: ['from', 'to', 'status'], icon: 'Clock' },

    // Renewals
    { id: 'renewal-45', name: '45-Day Renewal Pipeline', description: 'Policies expiring within the next 45 days.', category: ReportCategory.RENEWALS, dataSource: 'renewals', defaultColumns: ['policyNumber', 'contactName', 'contactPhone', 'insurerName', 'premiumAmount', 'expiryDate', 'daysToExpiry'], availableFilters: [], icon: 'CalendarClock' },
    { id: 'renewal-30', name: '30-Day Renewal Pipeline', description: 'Policies expiring within the next 30 days.', category: ReportCategory.RENEWALS, dataSource: 'renewals', defaultColumns: ['policyNumber', 'contactName', 'contactPhone', 'insurerName', 'premiumAmount', 'expiryDate', 'daysToExpiry'], availableFilters: [], icon: 'Calendar' },
    { id: 'renewal-20', name: '20-Day Renewal Pipeline', description: 'Urgent — policies expiring within 20 days.', category: ReportCategory.RENEWALS, dataSource: 'renewals', defaultColumns: ['policyNumber', 'contactName', 'contactPhone', 'insurerName', 'premiumAmount', 'expiryDate', 'daysToExpiry'], availableFilters: [], icon: 'AlertCircle' },
    { id: 'missed-renewals', name: 'Missed Renewals', description: 'Policies that have lapsed without renewal.', category: ReportCategory.RENEWALS, dataSource: 'policies', defaultColumns: ['policyNumber', 'contactName', 'insurerName', 'premiumAmount', 'expiryDate', 'status'], availableFilters: ['from', 'to'], icon: 'CalendarX' },

    // Finance
    { id: 'premium-summary', name: 'Premium Summary', description: 'Total premium collected by insurer and product.', category: ReportCategory.FINANCE, dataSource: 'revenue', defaultColumns: ['policyNumber', 'contactName', 'insurerName', 'premiumAmount', 'paymentStatus', 'paymentDate'], availableFilters: ['from', 'to'], icon: 'IndianRupee' },
    { id: 'revenue-report', name: 'Revenue Report', description: 'Monthly revenue trend with growth analysis.', category: ReportCategory.FINANCE, dataSource: 'revenue', defaultColumns: ['policyNumber', 'contactName', 'insurerName', 'premiumAmount', 'paymentDate', 'month', 'year'], availableFilters: ['from', 'to'], icon: 'TrendingUp' },
    { id: 'outstanding-premium', name: 'Outstanding Premium', description: 'Policies with pending or failed payments.', category: ReportCategory.FINANCE, dataSource: 'revenue', defaultColumns: ['policyNumber', 'contactName', 'insurerName', 'premiumAmount', 'paymentStatus', 'paymentDate'], availableFilters: ['from', 'to'], icon: 'AlertCircle' },

    // Operations
    { id: 'agent-performance', name: 'Agent Performance', description: 'Per-agent breakdown of leads, policies, and revenue.', category: ReportCategory.OPERATIONS, dataSource: 'leads', defaultColumns: ['assignedAgentName', 'leadCode', 'contactName', 'status', 'createdAt'], availableFilters: ['from', 'to', 'agentId'], icon: 'BarChart2' },
    { id: 'manager-performance', name: 'Manager Performance', description: 'Manager-level aggregated team performance.', category: ReportCategory.OPERATIONS, dataSource: 'leads', defaultColumns: ['assignedManagerName', 'assignedAgentName', 'leadCode', 'status', 'createdAt'], availableFilters: ['from', 'to'], icon: 'Users' },

    // Compliance
    { id: 'login-history', name: 'Login History', description: 'User login events and access audit trail.', category: ReportCategory.COMPLIANCE, dataSource: 'contacts', defaultColumns: ['fullName', 'email', 'createdAt'], availableFilters: ['from', 'to'], icon: 'LogIn' },
    { id: 'audit-log', name: 'Audit Log', description: 'Full audit trail of system actions.', category: ReportCategory.COMPLIANCE, dataSource: 'contacts', defaultColumns: ['fullName', 'email', 'type', 'createdAt'], availableFilters: ['from', 'to'], icon: 'Shield' },
    { id: 'document-access-log', name: 'Document Access Log', description: 'Track who accessed which documents and when.', category: ReportCategory.COMPLIANCE, dataSource: 'contacts', defaultColumns: ['fullName', 'email', 'createdAt'], availableFilters: ['from', 'to'], icon: 'FileSearch' },
  ];

  getAll(): ReportTemplate[] {
    return this.templates;
  }

  getByCategory(category: ReportCategory): ReportTemplate[] {
    return this.templates.filter((t) => t.category === category);
  }

  getById(id: string): ReportTemplate | undefined {
    return this.templates.find((t) => t.id === id);
  }

  getCategories(): ReportCategory[] {
    return [...new Set(this.templates.map((t) => t.category))];
  }
}
