import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ContactType } from '@prisma/client';

@Injectable()
export class ContactAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(actorOrCompanyId?: any) {
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    const companyId =
      typeof actorOrCompanyId === 'string'
        ? actorOrCompanyId
        : actorOrCompanyId?.companyId || actorOrCompanyId?.organizationId;

    const baseWhere = {
      deletedAt: null,
      ...(companyId ? { companyId } : {}),
    };

    const [total, individual, corporate, newThisMonth] = await Promise.all([
      this.prisma.contact.count({ where: baseWhere }),
      this.prisma.contact.count({
        where: { ...baseWhere, type: ContactType.INDIVIDUAL },
      }),
      this.prisma.contact.count({
        where: { ...baseWhere, type: ContactType.CORPORATE },
      }),
      this.prisma.contact.count({
        where: { ...baseWhere, createdAt: { gte: startOfMonth } },
      }),
    ]);

    return {
      total,
      byType: {
        individual,
        corporate,
      },
      newThisMonth,
    };
  }
}
