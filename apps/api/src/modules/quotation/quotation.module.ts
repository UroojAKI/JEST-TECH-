import { Module } from '@nestjs/common';

import { ContactsModule } from '../contacts/contacts.module';
import { AccountsModule } from '../accounts/accounts.module';

import { QuotationRepository } from './repositories/quotation.repository';
import { QuotationController } from './controllers/quotation.controller';

// Engine components
import { PremiumService } from './engine/premium.service';
import { GstService } from './engine/gst.service';
import { DiscountService } from './engine/discount.service';
import { AddonsService } from './engine/addons.service';
import { PdfService } from './engine/pdf.service';
import { IdvService } from './engine/idv.service';
import { ComparisonService } from './engine/comparison.service';
import { NcbService } from './engine/ncb.service';

// CQRS Commands
import { GenerateQuotationService } from './services/commands/generate-quotation.service';
import { ApproveQuotationService } from './services/commands/approve-quotation.service';
import { RejectQuotationService } from './services/commands/reject-quotation.service';
import { ConvertQuotationService } from './services/commands/convert-quotation.service';

// CQRS Queries
import { GetQuotationService } from './services/queries/get-quotation.service';
import { CompareQuotationService } from './services/queries/compare-quotation.service';
import { GetQuotationHistoryService } from './services/queries/get-quotation-history.service';

// Event Listeners
import { QuotationListener } from './events/quotation.listener';

@Module({
  imports: [ContactsModule, AccountsModule],
  controllers: [QuotationController],
  providers: [
    QuotationRepository,
    // Engine Services
    PremiumService,
    GstService,
    DiscountService,
    AddonsService,
    PdfService,
    IdvService,
    ComparisonService,
    NcbService,
    // CQRS Commands
    GenerateQuotationService,
    ApproveQuotationService,
    RejectQuotationService,
    ConvertQuotationService,
    // CQRS Queries
    GetQuotationService,
    CompareQuotationService,
    GetQuotationHistoryService,
    // Listener
    QuotationListener,
  ],
  exports: [
    GenerateQuotationService,
    GetQuotationService,
    QuotationRepository,
    PdfService,
  ],
})
export class QuotationModule {}
