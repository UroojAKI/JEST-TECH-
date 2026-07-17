import { Injectable } from '@nestjs/common';
import { Prisma, Quotation, QuotationVersion, QuotationHistory, QuotationDocument } from '@prisma/client';

import { PrismaService } from '../../../database/prisma.service';

const quotationWithRelations = Prisma.validator<Prisma.QuotationDefaultArgs>()({
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

@Injectable()
export class QuotationRepository {
  constructor(private readonly prisma: PrismaService) {}

  async generateQuotationCode(): Promise<string> {
    const total = await this.prisma.quotation.count();
    return `QT-${(total + 1).toString().padStart(6, '0')}`;
  }

  async create(data: Prisma.QuotationCreateInput): Promise<QuotationWithRelations> {
    return this.prisma.quotation.create({
      data,
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
  }

  async findById(id: string): Promise<QuotationWithRelations | null> {
    return this.prisma.quotation.findUnique({
      where: { id },
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
  }

  async findAll(): Promise<QuotationWithRelations[]> {
    return this.prisma.quotation.findMany({
      where: { deletedAt: null },
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
      orderBy: { createdAt: 'desc' },
    });
  }

  async update(id: string, data: Prisma.QuotationUpdateInput): Promise<QuotationWithRelations> {
    return this.prisma.quotation.update({
      where: { id },
      data,
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
  }

  async softDelete(id: string, deletedById: string): Promise<QuotationWithRelations> {
    return this.prisma.quotation.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        updatedById: deletedById,
      },
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
