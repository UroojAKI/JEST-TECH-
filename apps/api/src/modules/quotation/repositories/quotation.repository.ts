// import removed
import { Prisma, Quotation, QuotationVersion, QuotationHistory, QuotationDocument } from '@prisma/client';
import { BaseRepository } from '../../../common/base/base.repository';
import { PrismaService } from '../../../database/prisma.service';
import { checkOptimisticLock } from '../../../common/utils/optimistic-lock';

export const quotationWithRelations = Prisma.validator<Prisma.QuotationDefaultArgs>()({
  include: {
    contact: true,
    account: true,
    lead: true,
    versions: { orderBy: { versionNumber: 'desc' } },
    addons: true,
    discounts: true,
    histories: { orderBy: { createdAt: 'desc' } },
    documents: true,
  },
});

export type QuotationWithRelations = Prisma.QuotationGetPayload<typeof quotationWithRelations>;

import { Injectable } from '@nestjs/common';
@Injectable()
export class QuotationRepository extends BaseRepository<Prisma.QuotationDelegate, Quotation, QuotationWithRelations> {
  protected get basicArgs() {
    return { include: quotationWithRelations.include };
  }
  protected get detailArgs() {
    return { include: quotationWithRelations.include };
  }
  constructor(protected readonly prisma: PrismaService) {
    super(prisma.quotation);
  }

  async generateQuotationCode(): Promise<string> {
    const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
      SELECT nextval('quotation_number_seq')`;
    return `QTN-${result[0].nextval.toString().padStart(6, '0')}`;
  }

  async create(data: Prisma.QuotationCreateInput): Promise<QuotationWithRelations> {
    return this.prisma.quotation.create({
      data,
      include: quotationWithRelations.include,
    });
  }

  async findBasic(id: string): Promise<Quotation | null> {
    return super.findById(id);
  }

  async findDetail(id: string): Promise<QuotationWithRelations | null> {
    return this.prisma.quotation.findFirst({
      where: { id, deletedAt: null },
      include: quotationWithRelations.include,
    });
  }

  async findByQuotationCode(quotationCode: string): Promise<QuotationWithRelations | null> {
    return this.prisma.quotation.findUnique({
      where: { quotationCode },
      include: quotationWithRelations.include,
    });
  }

  async update(
    id: string,
    data: Prisma.QuotationUpdateInput,
    tx?: Prisma.TransactionClient,
    expectedVersion?: number,
  ): Promise<QuotationWithRelations> {
    const client = tx || this.prisma;
    if (expectedVersion !== undefined) {
      const nextVersion = await checkOptimisticLock(client.quotation, id, expectedVersion);
      data.version = nextVersion;
    }
    return client.quotation.update({
      where: { id },
      data,
      include: quotationWithRelations.include,
    });
  }

  async softDelete(id: string, deletedById: string): Promise<void> {
    await this.prisma.quotation.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: deletedById,
      },
    });
  }

  async createVersion(data: Prisma.QuotationVersionCreateInput): Promise<QuotationVersion> {
    return this.prisma.quotationVersion.create({ data });
  }

  async addHistoryEntry(
    quotationId: string,
    status: string,
    comments?: string,
    createdById?: string,
  ): Promise<QuotationHistory> {
    const data: Prisma.QuotationHistoryCreateInput = {
      status,
      comments,
      quotation: { connect: { id: quotationId } },
    };

    if (createdById) {
      data.createdBy = { connect: { id: createdById } };
    }

    return this.prisma.quotationHistory.create({ data });
  }

  async addDocument(
    quotationId: string,
    documentType: string,
    fileKey: string,
    fileName: string,
    fileSize: number,
  ): Promise<QuotationDocument> {
    return this.prisma.quotationDocument.create({
      data: {
        documentType,
        fileKey,
        fileName,
        fileSize,
        quotation: { connect: { id: quotationId } },
      },
    });
  }

  async findHistory(quotationId: string): Promise<QuotationHistory[]> {
    return this.prisma.quotationHistory.findMany({
      where: { quotationId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
