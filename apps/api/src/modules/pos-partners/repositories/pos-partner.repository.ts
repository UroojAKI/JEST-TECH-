import { Injectable } from '@nestjs/common';
import { Prisma, PosPartner, PosPartnerStatus, PosVerificationStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { PosPartnerQueryDto } from '../dto/pos-partner-query.dto';

@Injectable()
export class PosPartnerRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.PosPartnerCreateInput, tx?: Prisma.TransactionClient): Promise<PosPartner> {
    const client = tx || this.prisma;
    return client.posPartner.create({
      data,
      include: {
        insurerMapping: {
          include: { insurer: true },
        },
      },
    });
  }

  async findById(id: string, companyId?: string): Promise<any | null> {
    return this.prisma.posPartner.findFirst({
      where: {
        id,
        ...(companyId ? { companyId } : {}),
        deletedAt: null,
      },
      include: {
        insurerMapping: {
          include: { insurer: true },
        },
        documents: {
          orderBy: { createdAt: 'desc' },
        },
        commissionAgreements: {
          include: { insurer: true },
          orderBy: { createdAt: 'desc' },
        },
        policies: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            policyNumber: true,
            status: true,
            premiumAmount: true,
            expiryDate: true,
            createdAt: true,
          },
        },
        _count: {
          select: {
            policies: true,
            documents: true,
            commissionAgreements: true,
          },
        },
      },
    });
  }

  async findByCode(posCode: string, companyId: string): Promise<PosPartner | null> {
    return this.prisma.posPartner.findFirst({
      where: {
        posCode,
        companyId,
        deletedAt: null,
      },
      include: {
        insurerMapping: {
          include: { insurer: true },
        },
      },
    });
  }

  async findMany(
    companyId: string,
    query: PosPartnerQueryDto,
  ): Promise<{ data: any[]; total: number; page: number; limit: number; totalPages: number }> {
    const page = Number(query.page) || 1;
    const limit = Number(query.pageSize || query.limit) || 20;
    const skip = (page - 1) * limit;

    const where: Prisma.PosPartnerWhereInput = {
      companyId,
      deletedAt: null,
      ...(query.status ? { status: query.status } : {}),
      ...(query.verificationStatus ? { verificationStatus: query.verificationStatus } : {}),
      ...(query.partnerType ? { partnerType: query.partnerType } : {}),
      ...(query.insurerId
        ? {
            insurerMapping: {
              insurerId: query.insurerId,
              isActive: true,
            },
          }
        : {}),
    };

    if (query.search && query.search.trim()) {
      const term = query.search.trim();
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { posCode: { contains: term, mode: 'insensitive' } },
        { mobile: { contains: term } },
        { email: { contains: term, mode: 'insensitive' } },
        { registrationNumber: { contains: term, mode: 'insensitive' } },
      ];
    }

    const [total, data] = await Promise.all([
      this.prisma.posPartner.count({ where }),
      this.prisma.posPartner.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          insurerMapping: {
            include: {
              insurer: {
                select: { id: true, name: true, code: true, logoUrl: true, isActive: true },
              },
            },
          },
          _count: {
            select: { policies: true, documents: true },
          },
        },
      }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 1,
    };
  }

  async findEligible(params: {
    companyId: string;
    insurerId?: string;
    insurerName?: string;
    productType?: string;
  }): Promise<any[]> {
    const now = new Date();

    const where: Prisma.PosPartnerWhereInput = {
      companyId: params.companyId,
      status: PosPartnerStatus.ACTIVE,
      deletedAt: null,
      AND: [
        { effectiveFrom: { lte: now } },
        {
          OR: [
            { effectiveUntil: null },
            { effectiveUntil: { gte: now } },
          ],
        },
      ],
      insurerMapping: {
        isActive: true,
        AND: [
          { effectiveFrom: { lte: now } },
          {
            OR: [
              { effectiveUntil: null },
              { effectiveUntil: { gte: now } },
            ],
          },
          ...(params.insurerId
            ? [
                {
                  OR: [
                    { insurerId: params.insurerId },
                    { insurer: { code: params.insurerId } },
                  ],
                },
              ]
            : params.insurerName
            ? [
                {
                  insurer: {
                    name: { equals: params.insurerName, mode: 'insensitive' as const },
                  },
                },
              ]
            : []),
        ],
      },
    };

    return this.prisma.posPartner.findMany({
      where,
      orderBy: { name: 'asc' },
      include: {
        insurerMapping: {
          include: {
            insurer: {
              select: { id: true, name: true, code: true, isActive: true },
            },
          },
        },
      },
    });
  }

  async update(id: string, data: Prisma.PosPartnerUpdateInput, tx?: Prisma.TransactionClient): Promise<PosPartner> {
    const client = tx || this.prisma;
    return client.posPartner.update({
      where: { id },
      data,
      include: {
        insurerMapping: {
          include: { insurer: true },
        },
      },
    });
  }

  async countKpis(companyId: string) {
    const [total, active, suspended, pendingVerification] = await Promise.all([
      this.prisma.posPartner.count({ where: { companyId, deletedAt: null } }),
      this.prisma.posPartner.count({ where: { companyId, status: PosPartnerStatus.ACTIVE, deletedAt: null } }),
      this.prisma.posPartner.count({ where: { companyId, status: PosPartnerStatus.SUSPENDED, deletedAt: null } }),
      this.prisma.posPartner.count({
        where: { companyId, verificationStatus: PosVerificationStatus.PENDING, deletedAt: null },
      }),
    ]);

    return { total, active, suspended, pendingVerification };
  }
}
