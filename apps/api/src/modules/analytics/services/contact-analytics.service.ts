import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ContactType } from '@prisma/client';

@Injectable()
export class ContactAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const startOfMonth = new Date(
      new Date().getFullYear(),
      new Date().getMonth(),
      1,
    );

    const [total, individual, corporate, newThisMonth] = await Promise.all([
      this.prisma.contact.count({ where: { deletedAt: null } }),
      this.prisma.contact.count({
        where: { type: ContactType.INDIVIDUAL, deletedAt: null },
      }),
      this.prisma.contact.count({
        where: { type: ContactType.CORPORATE, deletedAt: null },
      }),
      this.prisma.contact.count({
        where: { createdAt: { gte: startOfMonth }, deletedAt: null },
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
