import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Claim,
  ClaimDocument,
  ClaimHistory,
  ClaimCommunication,
  ClaimStatus,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

import { checkOptimisticLock } from '../../../common/utils/optimistic-lock';

const claimWithRelations = Prisma.validator<Prisma.ClaimDefaultArgs>()({
  include: {
    policy: true,
    contact: true,
    account: true,
    documents: true,
    histories: { orderBy: { createdAt: 'desc' } },
    communications: { orderBy: { sentAt: 'desc' } },
  },
});

export type ClaimWithRelations = Prisma.ClaimGetPayload<
  typeof claimWithRelations
>;

@Injectable()
export class ClaimRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateClaimNumber(): Promise<string> {
    try {
      const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('claim_number_seq')`;
      return `CLM-${result[0].nextval.toString().padStart(6, '0')}`;
    } catch {
      const count = await this.prisma.claim.count();
      return `CLM-${(count + 1001).toString().padStart(6, '0')}`;
    }
  }

  async create(
    data: Prisma.ClaimCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ClaimWithRelations> {
    const client = tx || this.prisma;
    return client.claim.create({
      data,
      include: {
        policy: true,
        contact: true,
        account: true,
        documents: true,
        histories: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { sentAt: 'desc' } },
      },
    });
  }

  async findById(id: string): Promise<ClaimWithRelations | null> {
    return this.prisma.claim.findFirst({
      where: { id, deletedAt: null },
      include: {
        policy: true,
        contact: true,
        account: true,
        documents: true,
        histories: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { sentAt: 'desc' } },
      },
    });
  }

  async findByClaimNumber(
    claimNumber: string,
  ): Promise<ClaimWithRelations | null> {
    return this.prisma.claim.findUnique({
      where: { claimNumber },
      include: {
        policy: true,
        contact: true,
        account: true,
        documents: true,
        histories: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { sentAt: 'desc' } },
      },
    });
  }

  async findAll(
    skip?: number,
    take?: number,
    where?: Prisma.ClaimWhereInput,
    orderBy?: Prisma.ClaimOrderByWithRelationInput,
  ): Promise<ClaimWithRelations[]> {
    return this.prisma.claim.findMany({
      skip,
      take,
      where: { ...where, deletedAt: null },
      include: {
        policy: true,
        contact: true,
        account: true,
        documents: true,
        histories: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { sentAt: 'desc' } },
      },
      orderBy: orderBy || { createdAt: 'desc' },
    });
  }

  async count(where?: Prisma.ClaimWhereInput): Promise<number> {
    return this.prisma.claim.count({
      where: { ...where, deletedAt: null },
    });
  }

  async update(
    id: string,
    data: Prisma.ClaimUpdateInput,
    tx?: Prisma.TransactionClient,
    expectedVersion?: number,
  ): Promise<ClaimWithRelations> {
    const client = tx || this.prisma;
    if (expectedVersion !== undefined) {
      const nextVersion = await checkOptimisticLock(
        client.claim,
        id,
        expectedVersion,
      );
      data.version = nextVersion;
    }
    return client.claim.update({
      where: { id },
      data,
      include: {
        policy: true,
        contact: true,
        account: true,
        documents: true,
        histories: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { sentAt: 'desc' } },
      },
    });
  }

  async addDocument(
    data: Prisma.ClaimDocumentCreateInput,
  ): Promise<ClaimDocument> {
    return this.prisma.claimDocument.create({ data });
  }

  async addHistoryEntry(
    claimId: string,
    status: ClaimStatus,
    action: string,
    comments?: string,
    createdById?: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ClaimHistory> {
    const client = tx || this.prisma;
    const data: Prisma.ClaimHistoryCreateInput = {
      status,
      action,
      comments,
      claim: { connect: { id: claimId } },
    };

    if (createdById) {
      data.createdBy = { connect: { id: createdById } };
    }

    return client.claimHistory.create({ data });
  }

  async recordInsurerDecision(
    claimId: string,
    decision: 'APPROVED' | 'REJECTED',
    reason: string,
    approvedAmount: number | null,
    userId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<ClaimHistory> {
    const client = tx || this.prisma;
    const claim = await client.claim.findUnique({ where: { id: claimId } });
    if (!claim) throw new Error(`Claim ${claimId} not found`);

    // Map decision to ClaimStatus
    const newStatus: ClaimStatus = decision === 'APPROVED' ? 'APPROVED' : 'REJECTED';

    await client.claim.update({
      where: { id: claimId },
      data: {
        status: newStatus,
        ...(approvedAmount !== null && decision === 'APPROVED' ? { approvedAmount } : {}),
      },
    });

    return this.addHistoryEntry(
      claimId,
      newStatus,
      `Insurer decision recorded: ${decision}. Reason: ${reason}`,
      reason,
      userId,
      client,
    );
  }

  async addCommunication(
    data: Prisma.ClaimCommunicationCreateInput,
    tx?: Prisma.TransactionClient,
  ): Promise<ClaimCommunication> {
    const client = tx || this.prisma;
    return client.claimCommunication.create({ data });
  }
}
