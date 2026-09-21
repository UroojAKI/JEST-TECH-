import {
  BadRequestException,
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import type { RequestUser } from '../../../../modules/auth/decorators/current-user.decorator';

import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';
import { ComparisonService } from '../../engine/comparison.service';

@Injectable()
export class CompareQuotationService {
  constructor(
    private readonly quotationRepository: QuotationRepository,
    private readonly comparisonService: ComparisonService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(ids: string[], actor: RequestUser) {
    if (!ids || ids.length === 0) {
      throw new BadRequestException(
        'At least one quotation ID must be provided for comparison',
      );
    }

    const quotationsVerify = await this.prisma.quotation.findMany({
      where: {
        id: { in: ids },
        deletedAt: null,
        ...(actor.organizationId
          ? { createdBy: { companyId: actor.organizationId } }
          : {}),
      },
    });

    if (quotationsVerify.length !== ids.length) {
      throw new ForbiddenException(
        'One or more quotations not found or access denied',
      );
    }

    const quotations = await Promise.all(
      ids.map(async (id) => {
        const q = await this.quotationRepository.findDetail(id);
        if (!q) {
          throw new NotFoundException(`Quotation with ID ${id} not found`);
        }
        return QuotationMapper.toResponse(q);
      }),
    );

    return this.comparisonService.compare(quotations);
  }
}
