import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ContactType } from '@prisma/client';

@Injectable()
export class ContactAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const total = await this.prisma.contact.count({ where: { deletedAt: null } });
    const individual = await this.prisma.contact.count({
      where: { type: ContactType.INDIVIDUAL, deletedAt: null },
    });
    const corporate = await this.prisma.contact.count({
      where: { type: ContactType.CORPORATE, deletedAt: null },
    });

    const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
    const newThisMonth = await this.prisma.contact.count({
      where: {
        createdAt: { gte: startOfMonth },
        deletedAt: null,
      },
    });

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
