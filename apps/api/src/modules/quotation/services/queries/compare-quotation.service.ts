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
    if (!Array.isArray(ids) || ids.length < 2 || ids.length > 10) {
      throw new BadRequestException(
        'Provide between 2 and 10 saved quotation IDs for comparison',
      );
    }
    if (new Set(ids).size !== ids.length) {
      throw new BadRequestException('Duplicate quotation IDs are not allowed');
    }
    const companyId = actor.companyId || actor.organizationId;
    if (!companyId) {
      throw new ForbiddenException('Company context is required to compare quotations');
    }

    const quotationsVerify = await this.prisma.quotation.findMany({
      where: {
        id: { in: ids },
        companyId,
        deletedAt: null,
      },
    });

    if (quotationsVerify.length !== ids.length) {
      throw new ForbiddenException(
        'One or more quotations not found or access denied',
      );
    }

    // Comparisons must represent alternatives for the same customer requirement.
    // Case-backed products must stay within the same persisted case; legacy/non-case
    // quotations are restricted to the same contact and product category.
    const first = quotationsVerify[0];
    const allMotorCase = Boolean(first.caseId);
    const allHealthCase = Boolean(first.healthCaseId);
    const sameComparisonContext = quotationsVerify.every((quotation) => {
      if (allMotorCase) return quotation.caseId === first.caseId;
      if (allHealthCase) return quotation.healthCaseId === first.healthCaseId;
      return (
        !quotation.caseId &&
        !quotation.healthCaseId &&
        quotation.contactId === first.contactId &&
        quotation.productType === first.productType
      );
    });
    if (!sameComparisonContext) {
      throw new BadRequestException(
        'Only quotations belonging to the same customer and renewal/quotation case can be compared',
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
