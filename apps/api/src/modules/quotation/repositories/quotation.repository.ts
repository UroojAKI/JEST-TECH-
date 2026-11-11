import { Injectable } from '@nestjs/common';
import {
  Prisma,
  Quotation,
  QuotationVersion,
  QuotationHistory,
  QuotationDocument,
} from '@prisma/client';
import { BaseRepository } from '../../../common/base/base.repository';
import { PrismaService } from '../../../database/prisma.service';
import { checkOptimisticLock } from '../../../common/utils/optimistic-lock';

export const quotationWithRelations =
  Prisma.validator<Prisma.QuotationDefaultArgs>()({
    include: {
      contact: {
        include: {
          customer: {
            select: {
              id: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              state: true,
              pincode: true,
            },
          },
        },
      },
      account: true,
      lead: true,
      vehicle: true,
      case: { select: { id: true, caseCode: true, status: true, selectedQuoteId: true } },
      motorInspection: {
        select: { id: true, inspectionCode: true, status: true, completedAt: true, updatedAt: true },
      },
      motorPaymentRecord: {
        select: { id: true, status: true, amount: true, paymentMethod: true, referenceNumber: true, paidAt: true, updatedAt: true },
      },
      proposal: { select: { status: true } },
      policy: { select: { id: true, policyNumber: true, status: true } },
      versions: { orderBy: { versionNumber: 'desc' } },
      addons: true,
      discounts: true,
      histories: { orderBy: { createdAt: 'desc' } },
      documents: true,
      motorDocuments: {
        include: {
          document: true,
        },
      },
    },
  });

export type QuotationWithRelations = Prisma.QuotationGetPayload<
  typeof quotationWithRelations
>;

export const quotationSummaryRelations =
  Prisma.validator<Prisma.QuotationDefaultArgs>()({
    include: {
      contact: {
        select: {
          id: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          dateOfBirth: true,
          panNumber: true,
          aadhaarNumber: true,
          customer: {
            select: {
              id: true,
              addressLine1: true,
              addressLine2: true,
              city: true,
              state: true,
              pincode: true,
            },
          },
        },
      },
      account: { select: { id: true, name: true } },
      lead: { select: { id: true, leadCode: true, status: true } },
      vehicle: {
        select: {
          id: true,
          vehicleCode: true,
          category: true,
          registrationNumber: true,
          engineNumber: true,
          chassisNumber: true,
          makeModel: true,
          manufactureYearMonth: true,
        },
      },
      case: { select: { id: true, caseCode: true, status: true, selectedQuoteId: true } },
      proposal: { select: { id: true, status: true, proposalNumber: true } },
      policy: { select: { id: true, policyNumber: true, status: true } },
      motorPaymentRecord: {
        select: { id: true, status: true, amount: true, paymentMethod: true, referenceNumber: true, paidAt: true },
      },
    },
  });

export type QuotationSummary = Prisma.QuotationGetPayload<
  typeof quotationSummaryRelations
>;

@Injectable()
export class QuotationRepository extends BaseRepository<
  Prisma.QuotationDelegate,
  Quotation,
  QuotationWithRelations
> {
  protected get basicArgs() {
    return { include: quotationSummaryRelations.include };
  }
  protected get detailArgs() {
    return { include: quotationWithRelations.include };
  }
  constructor(protected readonly prisma: PrismaService) {
    super(prisma.quotation);
  }

  async generateQuotationCode(): Promise<string> {
    try {
      const result = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('quotation_number_seq')`;
      return `QTN-${result[0].nextval.toString().padStart(6, '0')}`;
    } catch {
      await this.prisma
        .$executeRaw`CREATE SEQUENCE IF NOT EXISTS quotation_number_seq START 1;`;
      const retry = await this.prisma.$queryRaw<[{ nextval: bigint }]>`
        SELECT nextval('quotation_number_seq')`;
      return `QTN-${retry[0].nextval.toString().padStart(6, '0')}`;
    }
  }

  async create(
    data: Prisma.QuotationCreateInput,
  ): Promise<QuotationWithRelations> {
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

  async findAll(
    skip: number,
    take: number,
    where: Prisma.QuotationWhereInput,
    orderBy: Prisma.QuotationOrderByWithRelationInput,
  ): Promise<[QuotationWithRelations[], number]> {
    const { organizationId, ...safeWhere } = (where || {}) as any;
    const companyId = safeWhere.companyId || organizationId;
    const finalWhere = {
      ...safeWhere,
      ...(companyId ? { companyId } : {}),
      deletedAt: null,
    };
    try {
      const data = await this.prisma.quotation.findMany({
        skip,
        take,
        where: finalWhere,
        orderBy,
        include: quotationSummaryRelations.include,
      });
      const total = await this.prisma.quotation.count({ where: finalWhere });
      return [data as unknown as QuotationWithRelations[], total];
    } catch (err: any) {
      const fallbackData = await this.prisma.quotation.findMany({
        skip,
        take,
        where: finalWhere,
        orderBy,
        include: quotationSummaryRelations.include,
      });
      const total = await this.prisma.quotation.count({ where: finalWhere }).catch(() => fallbackData.length);
      return [fallbackData as unknown as QuotationWithRelations[], total];
    }
  }

  async findByQuotationCode(
    quotationCode: string,
  ): Promise<QuotationWithRelations | null> {
    return this.prisma.quotation.findFirst({
      where: { quotationCode, deletedAt: null },
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
      const nextVersion = await checkOptimisticLock(
        client.quotation,
        id,
        expectedVersion,
      );
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

  async createVersion(
    data: Prisma.QuotationVersionCreateInput,
  ): Promise<QuotationVersion> {
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
