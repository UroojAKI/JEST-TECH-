import { Injectable } from '@nestjs/common';
import { Prisma, Claim, ClaimDocument, ClaimAssessment, ClaimPayment, ClaimReserve, ClaimHistory, ClaimCommunication, ClaimStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

const claimWithRelations = Prisma.validator<Prisma.ClaimDefaultArgs>()({
  include: {
    policy: true,
    contact: true,
    account: true,
    documents: true,
    assessments: true,
    payments: true,
    reserves: { orderBy: { createdAt: 'desc' } },
    histories: { orderBy: { createdAt: 'desc' } },
    communications: { orderBy: { sentAt: 'desc' } },
  },
});

export type ClaimWithRelations = Prisma.ClaimGetPayload<typeof claimWithRelations>;

@Injectable()
export class ClaimRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateClaimNumber(): Promise<string> {
    const total = await this.prisma.claim.count();
    return `CLM-${(total + 1).toString().padStart(6, '0')}`;
  }

  async create(data: Prisma.ClaimCreateInput): Promise<ClaimWithRelations> {
    return this.prisma.claim.create({
      data,
      include: {
        policy: true,
        contact: true,
        account: true,
        documents: true,
        assessments: true,
        payments: true,
        reserves: { orderBy: { createdAt: 'desc' } },
        histories: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { sentAt: 'desc' } },
      },
    });
  }

  async findById(id: string): Promise<ClaimWithRelations | null> {
    return this.prisma.claim.findUnique({
      where: { id },
      include: {
        policy: true,
        contact: true,
        account: true,
        documents: true,
        assessments: true,
        payments: true,
        reserves: { orderBy: { createdAt: 'desc' } },
        histories: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { sentAt: 'desc' } },
      },
    });
  }

  async findByClaimNumber(claimNumber: string): Promise<ClaimWithRelations | null> {
    return this.prisma.claim.findUnique({
      where: { claimNumber },
      include: {
        policy: true,
        contact: true,
        account: true,
        documents: true,
        assessments: true,
        payments: true,
        reserves: { orderBy: { createdAt: 'desc' } },
        histories: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { sentAt: 'desc' } },
      },
    });
  }

  async findAll(): Promise<ClaimWithRelations[]> {
    return this.prisma.claim.findMany({
      where: { deletedAt: null },
      include: {
        policy: true,
        contact: true,
        account: true,
        documents: true,
        assessments: true,
        payments: true,
        reserves: { orderBy: { createdAt: 'desc' } },
        histories: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { sentAt: 'desc' } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: Prisma.ClaimUpdateInput): Promise<ClaimWithRelations> {
    return this.prisma.claim.update({
      where: { id },
      data,
      include: {
        policy: true,
        contact: true,
        account: true,
        documents: true,
        assessments: true,
        payments: true,
        reserves: { orderBy: { createdAt: 'desc' } },
        histories: { orderBy: { createdAt: 'desc' } },
        communications: { orderBy: { sentAt: 'desc' } },
      },
    });
  }

  async addDocument(data: Prisma.ClaimDocumentCreateInput): Promise<ClaimDocument> {
    return this.prisma.claimDocument.create({ data });
  }

  async addAssessment(data: Prisma.ClaimAssessmentCreateInput): Promise<ClaimAssessment> {
    return this.prisma.claimAssessment.create({ data });
  }

  async addPayment(data: Prisma.ClaimPaymentCreateInput): Promise<ClaimPayment> {
    return this.prisma.claimPayment.create({ data });
  }

  async addReserve(data: Prisma.ClaimReserveCreateInput): Promise<ClaimReserve> {
    return this.prisma.claimReserve.create({ data });
  }

  async addHistoryEntry(
    claimId: string,
    status: ClaimStatus,
    action: string,
    comments?: string,
    createdById?: string,
  ): Promise<ClaimHistory> {
    const data: Prisma.ClaimHistoryCreateInput = {
      status,
      action,
      comments,
      claim: { connect: { id: claimId } },
    };

    if (createdById) {
      data.createdBy = { connect: { id: createdById } };
    }

    return this.prisma.claimHistory.create({ data });
  }

  async addCommunication(data: Prisma.ClaimCommunicationCreateInput): Promise<ClaimCommunication> {
    return this.prisma.claimCommunication.create({ data });
  }
}
