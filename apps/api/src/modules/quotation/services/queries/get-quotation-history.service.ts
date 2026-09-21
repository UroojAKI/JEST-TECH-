import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { RequestUser } from '../../../../modules/auth/decorators/current-user.decorator';

@Injectable()
export class GetQuotationHistoryService {
  constructor(private readonly prisma: PrismaService) {}

  async execute(id: string, actor: RequestUser) {
    // First verify access to the parent quotation
    const quotation = await this.prisma.quotation.findFirst({
      where: {
        id,
        deletedAt: null,
        ...(actor.organizationId
          ? { createdBy: { companyId: actor.organizationId } }
          : {}),
      },
    });
    if (!quotation)
      throw new NotFoundException(`Quotation ${id} not found or access denied`);

    return this.prisma.quotationHistory.findMany({
      where: { quotationId: id },
      orderBy: { createdAt: 'desc' },
    });
  }
}
