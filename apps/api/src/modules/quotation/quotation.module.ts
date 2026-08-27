import { Module } from '@nestjs/common';

import { ContactsModule } from '../contacts/contacts.module';
import { AccountsModule } from '../accounts/accounts.module';
import { MotorModule } from '../motor/motor.module';

import { QuotationRepository } from './repositories/quotation.repository';
import { QuotationController } from './controllers/quotation.controller';

import { PremiumService } from './engine/premium.service';
import { GstService } from './engine/gst.service';
import { DiscountService } from './engine/discount.service';
import { AddonsService } from './engine/addons.service';
import { PdfService } from './engine/pdf.service';
import { IdvService } from './engine/idv.service';
import { ComparisonService } from './engine/comparison.service';
import { NcbService } from './engine/ncb.service';

import { GenerateQuotationService } from './services/commands/generate-quotation.service';
import { ApproveQuotationService } from './services/commands/approve-quotation.service';
import { RejectQuotationService } from './services/commands/reject-quotation.service';
import { ConvertQuotationService } from './services/commands/convert-quotation.service';
import { AcceptQuotationService } from './services/commands/accept-quotation.service';
import { CreateQuotationVersionService } from './services/commands/create-quotation-version.service';

import { GetQuotationService } from './services/queries/get-quotation.service';
import { CompareQuotationService } from './services/queries/compare-quotation.service';
import { GetQuotationHistoryService } from './services/queries/get-quotation-history.service';
import { QuotationListener } from './events/quotation.listener';

@Module({
  imports: [ContactsModule, AccountsModule, MotorModule],
  controllers: [QuotationController],
  providers: [
    QuotationRepository,
    PremiumService,
    GstService,
    DiscountService,
    AddonsService,
    PdfService,
    IdvService,
    ComparisonService,
    NcbService,
    GenerateQuotationService,
    ApproveQuotationService,
    RejectQuotationService,
    ConvertQuotationService,
    AcceptQuotationService,
    CreateQuotationVersionService,
    GetQuotationService,
    CompareQuotationService,
    GetQuotationHistoryService,
    QuotationListener,
  ],
  exports: [
    GenerateQuotationService,
    GetQuotationService,
    AcceptQuotationService,
    CreateQuotationVersionService,
    QuotationRepository,
    PdfService,
  ],
})
export class QuotationModule {}
