import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';

import { LeadConvertedEvent } from '../../leads/events/lead-converted.event';
import { GenerateQuotationService } from '../services/commands/generate-quotation.service';
import { CreateQuotationDto } from '../dto/create-quotation.dto';

@Injectable()
export class QuotationListener {
  private readonly logger = new Logger(QuotationListener.name);

  constructor(private readonly generateQuotationService: GenerateQuotationService) {}

  @OnEvent('lead.converted')
  async handleLeadConvertedEvent(event: LeadConvertedEvent) {
    const { lead } = event;
    this.logger.log(`Processing lead.converted event for lead code: ${lead.leadCode}`);

    try {
      const draftDto = new CreateQuotationDto();
      draftDto.title = `Draft Quote - ${lead.title}`;
      draftDto.leadId = lead.id;
      draftDto.contactId = lead.contactId;
      draftDto.accountId = lead.accountId || undefined;
      draftDto.insurerName = 'JEST Partner Insurer';
      draftDto.productType = 'MOTOR';
      draftDto.sumInsured = 500000; // default Sum Insured
      draftDto.ncbPercentage = 0;
      draftDto.expiryDate = new Date(Date.now() + 30 * 86400000).toISOString(); // 30 days expiry

      const creatorId = lead.createdById || 'system';

      const quotation = await this.generateQuotationService.execute(draftDto, creatorId);
      this.logger.log(`Automatically generated draft quotation ${quotation.quotationCode} for lead ${lead.leadCode}`);
    } catch (error: any) {
      this.logger.error(
        `Failed to automatically generate draft quotation for lead ${lead.leadCode}: ${error.message}`,
        error.stack,
      );
    }
  }
}
