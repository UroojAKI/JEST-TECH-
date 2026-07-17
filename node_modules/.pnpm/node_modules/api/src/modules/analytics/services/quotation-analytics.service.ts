import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { QuotationStatus } from '@prisma/client';

@Injectable()
export class QuotationAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview() {
    const total = await this.prisma.quotation.count({ where: { deletedAt: null } });
    const pendingApproval = await this.prisma.quotation.count({
      where: { status: QuotationStatus.PENDING_APPROVAL, deletedAt: null },
    });
    const approved = await this.prisma.quotation.count({
      where: { status: QuotationStatus.APPROVED, deletedAt: null },
    });
    const converted = await this.prisma.quotation.count({
      where: { status: QuotationStatus.CONVERTED_TO_POLICY, deletedAt: null },
    });

    return {
      total,
      pendingApproval,
      approved,
      converted,
    };
  }
}
