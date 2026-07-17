import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

export interface ReportingContact {
  id: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string | null;
  phone: string;
  type: string;
  createdAt: Date;
}

export interface ReportingLead {
  id: string;
  leadCode: string;
  contactName: string;
  contactEmail: string | null;
  status: string;
  source: string | null;
  productType: string | null;
  assignedAgentName: string;
  assignedManagerName: string | null;
  createdAt: Date;
  convertedAt: Date | null;
}

export interface ReportingPolicy {
  id: string;
  policyNumber: string;
  contactName: string;
  contactEmail: string | null;
  status: string;
  insurerName: string | null;
  productType: string | null;
  premiumAmount: number;
  effectiveDate: Date | null;
  expiryDate: Date | null;
  agentName: string | null;
  createdAt: Date;
}

export interface ReportingClaim {
  id: string;
  claimNumber: string;
  policyNumber: string;
  contactName: string;
  status: string;
  claimAmount: number;
  approvedAmount: number;
  incidentDate: Date | null;
  reportedAt: Date;
}

export interface ReportingRevenue {
  policyId: string;
  policyNumber: string;
  contactName: string;
  insurerName: string | null;
  premiumAmount: number;
  paymentStatus: string;
  paymentDate: Date | null;
  month: number;
  year: number;
}

export interface ReportingRenewal {
  id: string;
  policyNumber: string;
  contactName: string;
  contactPhone: string | null;
  insurerName: string | null;
  premiumAmount: number;
  expiryDate: Date | null;
  daysToExpiry: number;
  agentName: string | null;
}

@Injectable()
export class WarehouseService {
  constructor(private readonly prisma: PrismaService) {}

  async getReportingContacts(filters?: { from?: Date; to?: Date; type?: string }): Promise<ReportingContact[]> {
    const contacts = await this.prisma.contact.findMany({
      where: {
        deletedAt: null,
        ...(filters?.type && { type: filters.type as any }),
        ...(filters?.from || filters?.to
          ? {
              createdAt: {
                ...(filters.from && { gte: filters.from }),
                ...(filters.to && { lte: filters.to }),
              },
            }
          : {}),
      },
      orderBy: { createdAt: 'desc' },
    });

    return contacts.map((c) => ({
      id: c.id,
      firstName: c.firstName,
      lastName: c.lastName,
      fullName: `${c.firstName} ${c.lastName}`,
      email: c.email,
      phone: c.phone,
      type: c.type,
      createdAt: c.createdAt,
    }));
  }

  async getReportingLeads(filters?: { from?: Date; to?: Date; status?: string; agentId?: string }): Promise<ReportingLead[]> {
    const leads = await this.prisma.lead.findMany({
      where: {
        deletedAt: null,
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.agentId && { assignedToId: filters.agentId }),
        ...(filters?.from || filters?.to
          ? { createdAt: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) } }
          : {}),
      },
      include: {
        contact: true,
        assignedTo: { select: { firstName: true, lastName: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return leads.map((l) => ({
      id: l.id,
      leadCode: l.leadCode,
      contactName: `${l.contact.firstName} ${l.contact.lastName}`,
      contactEmail: l.contact.email,
      status: l.status,
      source: l.source,
      productType: null,
      assignedAgentName: l.assignedTo ? `${l.assignedTo.firstName} ${l.assignedTo.lastName}` : 'Unassigned',
      assignedManagerName: null,
      createdAt: l.createdAt,
      convertedAt: null,
    }));
  }

  async getReportingPolicies(filters?: { from?: Date; to?: Date; status?: string; agentId?: string }): Promise<ReportingPolicy[]> {
    const policies = await this.prisma.policy.findMany({
      where: {
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.from || filters?.to
          ? { createdAt: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) } }
          : {}),
      },
      include: {
        contact: true,
        quotation: { select: { insurerName: true, productType: true, totalPremium: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return policies.map((p) => ({
      id: p.id,
      policyNumber: p.policyNumber,
      contactName: `${p.contact.firstName} ${p.contact.lastName}`,
      contactEmail: p.contact.email,
      status: p.status,
      insurerName: p.quotation?.insurerName ?? null,
      productType: p.quotation?.productType ?? null,
      premiumAmount: Number(p.premiumAmount),
      effectiveDate: p.effectiveDate,
      expiryDate: p.expiryDate,
      agentName: null,
      createdAt: p.createdAt,
    }));
  }

  async getReportingClaims(filters?: { from?: Date; to?: Date; status?: string }): Promise<ReportingClaim[]> {
    const claims = await this.prisma.claim.findMany({
      where: {
        ...(filters?.status && { status: filters.status as any }),
        ...(filters?.from || filters?.to
          ? { reportedDate: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) } }
          : {}),
      },
      include: {
        policy: { select: { policyNumber: true } },
        contact: { select: { firstName: true, lastName: true } },
      },
      orderBy: { reportedDate: 'desc' },
    });

    return claims.map((c) => ({
      id: c.id,
      claimNumber: c.claimNumber,
      policyNumber: c.policy.policyNumber,
      contactName: `${c.contact.firstName} ${c.contact.lastName}`,
      status: c.status,
      claimAmount: Number(c.claimAmount ?? 0),
      approvedAmount: Number(c.approvedAmount ?? 0),
      incidentDate: c.incidentDate,
      reportedAt: c.reportedDate,
    }));
  }

  async getReportingRevenue(filters?: { from?: Date; to?: Date }): Promise<ReportingRevenue[]> {
    const payments = await this.prisma.policyPayment.findMany({
      where: {
        ...(filters?.from || filters?.to
          ? { paymentDate: { ...(filters.from && { gte: filters.from }), ...(filters.to && { lte: filters.to }) } }
          : {}),
      },
      include: {
        policy: {
          select: {
            policyNumber: true,
            premiumAmount: true,
            contact: { select: { firstName: true, lastName: true } },
            quotation: { select: { insurerName: true } },
          },
        },
      },
      orderBy: { paymentDate: 'desc' },
    });

    return payments.map((p) => ({
      policyId: p.policyId,
      policyNumber: p.policy.policyNumber,
      contactName: `${p.policy.contact.firstName} ${p.policy.contact.lastName}`,
      insurerName: p.policy.quotation?.insurerName ?? null,
      premiumAmount: Number(p.amount),
      paymentStatus: p.status,
      paymentDate: p.paymentDate,
      month: p.paymentDate ? new Date(p.paymentDate).getMonth() + 1 : 0,
      year: p.paymentDate ? new Date(p.paymentDate).getFullYear() : 0,
    }));
  }

  async getReportingRenewals(): Promise<ReportingRenewal[]> {
    const now = new Date();
    const in45 = new Date(now.getTime() + 45 * 24 * 60 * 60 * 1000);

    const policies = await this.prisma.policy.findMany({
      where: {
        status: 'ACTIVE',
        expiryDate: { gte: now, lte: in45 },
      },
      include: {
        contact: { select: { firstName: true, lastName: true, phone: true } },
        quotation: { select: { insurerName: true, totalPremium: true } },
      },
      orderBy: { expiryDate: 'asc' },
    });

    return policies.map((p) => {
      const expiry = p.expiryDate ? new Date(p.expiryDate) : null;
      const daysToExpiry = expiry ? Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)) : -1;
      return {
        id: p.id,
        policyNumber: p.policyNumber,
        contactName: `${p.contact.firstName} ${p.contact.lastName}`,
        contactPhone: p.contact.phone,
        insurerName: p.quotation?.insurerName ?? null,
        premiumAmount: Number(p.quotation?.totalPremium ?? p.premiumAmount),
        expiryDate: p.expiryDate,
        daysToExpiry,
        agentName: null,
      };
    });
  }
}
