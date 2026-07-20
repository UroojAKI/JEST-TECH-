import { Injectable } from '@nestjs/common';
import { Prisma, Policy, PolicyRenewal, PolicyPayment, PolicyDocument, PolicyHistory } from '@prisma/client';
import { BaseRepository } from '../../../common/base/base.repository';
import { PrismaService } from '../../../database/prisma.service';

import { checkOptimisticLock } from '../../../common/utils/optimistic-lock';

export const policyWithRelations = Prisma.validator<Prisma.PolicyDefaultArgs>()({
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
export class PolicyRepository extends BaseRepository<Policy, Prisma.PolicyDelegate<any>> {
  constructor(protected readonly prisma: PrismaService) {
    super(prisma.policy);
  }

  async generatePolicyNumber(): Promise<string> {
    const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('policy_number_seq')`;
    return `POL-${result[0].nextval.toString().padStart(6, '0')}`;
  }

  async create(data: Prisma.PolicyCreateInput, tx?: Prisma.TransactionClient): Promise<PolicyWithRelations> {
    const client = tx || this.prisma;
    return client.policy.create({
      data,
      include: policyWithRelations.include,
    });
  }

  async findBasic(id: string): Promise<Policy | null> {
    return super.findById(id);
  }

  async findDetail(id: string): Promise<PolicyWithRelations | null> {
    return this.prisma.policy.findFirst({
      where: { id, deletedAt: null },
      include: policyWithRelations.include,
    });
  }

  async findByPolicyNumber(policyNumber: string): Promise<PolicyWithRelations | null> {
    return this.prisma.policy.findUnique({
      where: { policyNumber },
      include: policyWithRelations.include,
    });
  }

  async findByQuotationId(quotationId: string): Promise<PolicyWithRelations | null> {
    return this.prisma.policy.findUnique({
      where: { quotationId },
      include: policyWithRelations.include,
    });
  }

  async update(
    id: string,
    data: Prisma.PolicyUpdateInput,
    tx?: Prisma.TransactionClient,
    expectedVersion?: number,
  ): Promise<PolicyWithRelations> {
    const client = tx || this.prisma;
    if (expectedVersion !== undefined) {
      const nextVersion = await checkOptimisticLock(client.policy, id, expectedVersion);
      data.version = nextVersion;
    }
    return client.policy.update({
      where: { id },
      data,
      include: policyWithRelations.include,
    });
  }

  async softDelete(id: string, deletedById: string): Promise<PolicyWithRelations> {
    return this.prisma.policy.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: deletedById,
      },
      include: policyWithRelations.include,
    });
  }

  async createRenewal(data: Prisma.PolicyRenewalCreateInput): Promise<PolicyRenewal> {
    return this.prisma.policyRenewal.create({ data });
  }

  async addPayment(data: Prisma.PolicyPaymentCreateInput): Promise<PolicyPayment> {
    return this.prisma.policyPayment.create({ data });
  }

  async addDocument(data: Prisma.PolicyDocumentCreateInput, tx?: Prisma.TransactionClient): Promise<PolicyDocument> {
    const client = tx || this.prisma;
    return client.policyDocument.create({ data });
  }

  async addHistoryEntry(
    policyId: string,
    status: string,
    comments?: string,
    createdById?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<PolicyHistory> {
    const client = tx || this.prisma;
    const data: Prisma.PolicyHistoryCreateInput = {
      status,
      comments,
      policy: { connect: { id: policyId } },
    };

    if (createdById) {
      data.createdBy = { connect: { id: createdById } };
    }

    return client.policyHistory.create({ data });
  }

  async findHistory(policyId: string): Promise<PolicyHistory[]> {
    return this.prisma.policyHistory.findMany({
      where: { policyId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
