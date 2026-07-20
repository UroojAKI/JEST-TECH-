import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { QuotationStatus } from '@prisma/client';

import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';

@Injectable()
export class ConvertQuotationService {
  constructor(private readonly quotationRepository: QuotationRepository) {}

  async execute(id: string, convertedById: string) {
    const existing = await this.quotationRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    if (existing.status !== QuotationStatus.APPROVED) {
      throw new BadRequestException(
        `Cannot convert quotation in status ${existing.status}. Must be APPROVED first.`,
      );
    }

    const updated = await this.quotationRepository.update(id, {
      status: QuotationStatus.CONVERTED_TO_POLICY,
      updatedBy: { connect: { id: convertedById } },
    });

    await this.quotationRepository.addHistoryEntry(
      id,
      QuotationStatus.CONVERTED_TO_POLICY,
      'Quotation converted successfully to Policy.',
      convertedById,
    );

    const quotation = await this.quotationRepository.findDetail(id);
    const mappedResponse = QuotationMapper.toResponse(quotation!);

    return {
      message: `Quotation ${existing.quotationCode} converted successfully to Policy.`,
      quotation: mappedResponse,
      // Stub policy creation details for future sprints
      policyStub: {
        policyNumber: `POL-${existing.quotationCode.substring(3)}-01`,
        contactId: existing.contactId,
        accountId: existing.accountId,
        premiumAmount: Number(existing.totalPremium),
        effectiveDate: new Date(),
        expiryDate: existing.expiryDate,
      },
    };
  }
}
