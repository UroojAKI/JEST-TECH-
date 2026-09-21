import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { QuotationStatus } from '@prisma/client';
import { RequestUser } from '../../auth/decorators/current-user.decorator';

@Injectable()
export class QuotationAnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOverview(actor: RequestUser) {
    const orgScope = actor?.organizationId
      ? { createdBy: { is: { companyId: actor.organizationId } } }
      : {};
    const [total, pendingApproval, approved, converted] = await Promise.all([
      this.prisma.quotation.count({ where: { deletedAt: null, ...orgScope } }),
      this.prisma.quotation.count({
        where: {
          status: QuotationStatus.PENDING_APPROVAL,
          deletedAt: null,
          ...orgScope,
        },
      }),
      this.prisma.quotation.count({
        where: {
          status: QuotationStatus.APPROVED,
          deletedAt: null,
          ...orgScope,
        },
      }),
      this.prisma.quotation.count({
        where: {
          status: QuotationStatus.CONVERTED_TO_POLICY,
          deletedAt: null,
          ...orgScope,
        },
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
