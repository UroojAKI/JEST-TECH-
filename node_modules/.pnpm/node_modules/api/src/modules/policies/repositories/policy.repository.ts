import { Injectable } from '@nestjs/common';
import { Prisma, Policy, PolicyRenewal, PolicyPayment, PolicyDocument, PolicyHistory } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';

const policyWithRelations = Prisma.validator<Prisma.PolicyDefaultArgs>()({
  include: {
    contact: true,
    account: true,
    quotation: true,
    members: true,
    nominees: true,
    renewals: { orderBy: { renewalNumber: 'desc' } },
    payments: { orderBy: { paymentDate: 'desc' } },
    documents: true,
    histories: { orderBy: { createdAt: 'desc' } },
  },
});

export type PolicyWithRelations = Prisma.PolicyGetPayload<typeof policyWithRelations>;

@Injectable()
export class PolicyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generatePolicyNumber(): Promise<string> {
    const total = await this.prisma.policy.count();
    return `POL-${(total + 1).toString().padStart(6, '0')}`;
  }

  async create(data: Prisma.PolicyCreateInput): Promise<PolicyWithRelations> {
    return this.prisma.policy.create({
      data,
      include: {
        contact: true,
        account: true,
        quotation: true,
        members: true,
        nominees: true,
        renewals: { orderBy: { renewalNumber: 'desc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        documents: true,
        histories: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async findById(id: string): Promise<PolicyWithRelations | null> {
    return this.prisma.policy.findUnique({
      where: { id },
      include: {
        contact: true,
        account: true,
        quotation: true,
        members: true,
        nominees: true,
        renewals: { orderBy: { renewalNumber: 'desc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        documents: true,
        histories: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async findByPolicyNumber(policyNumber: string): Promise<PolicyWithRelations | null> {
    return this.prisma.policy.findUnique({
      where: { policyNumber },
      include: {
        contact: true,
        account: true,
        quotation: true,
        members: true,
        nominees: true,
        renewals: { orderBy: { renewalNumber: 'desc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        documents: true,
        histories: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async findByQuotationId(quotationId: string): Promise<PolicyWithRelations | null> {
    return this.prisma.policy.findUnique({
      where: { quotationId },
      include: {
        contact: true,
        account: true,
        quotation: true,
        members: true,
        nominees: true,
        renewals: { orderBy: { renewalNumber: 'desc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        documents: true,
        histories: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async findAll(): Promise<PolicyWithRelations[]> {
    return this.prisma.policy.findMany({
      where: { deletedAt: null },
      include: {
        contact: true,
        account: true,
        quotation: true,
        members: true,
        nominees: true,
        renewals: { orderBy: { renewalNumber: 'desc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        documents: true,
        histories: { orderBy: { createdAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: Prisma.PolicyUpdateInput): Promise<PolicyWithRelations> {
    return this.prisma.policy.update({
      where: { id },
      data,
      include: {
        contact: true,
        account: true,
        quotation: true,
        members: true,
        nominees: true,
        renewals: { orderBy: { renewalNumber: 'desc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        documents: true,
        histories: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async softDelete(id: string, deletedById: string): Promise<PolicyWithRelations> {
    return this.prisma.policy.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: deletedById,
      },
      include: {
        contact: true,
        account: true,
        quotation: true,
        members: true,
        nominees: true,
        renewals: { orderBy: { renewalNumber: 'desc' } },
        payments: { orderBy: { paymentDate: 'desc' } },
        documents: true,
        histories: { orderBy: { createdAt: 'desc' } },
      },
    });
  }

  async createRenewal(data: Prisma.PolicyRenewalCreateInput): Promise<PolicyRenewal> {
    return this.prisma.policyRenewal.create({ data });
  }

  async addPayment(data: Prisma.PolicyPaymentCreateInput): Promise<PolicyPayment> {
    return this.prisma.policyPayment.create({ data });
  }

  async addDocument(data: Prisma.PolicyDocumentCreateInput): Promise<PolicyDocument> {
    return this.prisma.policyDocument.create({ data });
  }

  async addHistoryEntry(
    policyId: string,
    status: string,
    comments?: string,
    createdById?: string,
  ): Promise<PolicyHistory> {
    const data: Prisma.PolicyHistoryCreateInput = {
      status,
      comments,
      policy: { connect: { id: policyId } },
    };

    if (createdById) {
      data.createdBy = { connect: { id: createdById } };
    }

    return this.prisma.policyHistory.create({ data });
  }

  async findHistory(policyId: string): Promise<PolicyHistory[]> {
    return this.prisma.policyHistory.findMany({
      where: { policyId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
