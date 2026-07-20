import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { QuotationStatus } from '@prisma/client';

@Injectable()
export class QuotationAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const [total, pendingApproval, approved, converted] = await Promise.all([
      this.prisma.quotation.count({ where: { deletedAt: null } }),
      this.prisma.quotation.count({
        where: { status: QuotationStatus.PENDING_APPROVAL, deletedAt: null },
      }),
      this.prisma.quotation.count({
        where: { status: QuotationStatus.APPROVED, deletedAt: null },
      }),
      this.prisma.quotation.count({
        where: { status: QuotationStatus.CONVERTED_TO_POLICY, deletedAt: null },
      }),
    ]);

    return {
      total,
      pendingApproval,
      approved,
      converted,
    };
  }
}
