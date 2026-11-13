import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';

import { PosPartnersController } from './controllers/pos-partners.controller';
import { PosPartnerRepository } from './repositories/pos-partner.repository';
import { PosPartnerService } from './services/pos-partner.service';
import { PosInsurerMappingService } from './services/pos-insurer-mapping.service';
import { PosEligibilityService } from './services/pos-eligibility.service';
import { PosDocumentService } from './services/pos-document.service';
import { PosCommissionAgreementService } from './services/pos-commission-agreement.service';

@Module({
  imports: [DatabaseModule],
  controllers: [PosPartnersController],
  providers: [
    PosPartnerRepository,
    PosPartnerService,
    PosInsurerMappingService,
    PosEligibilityService,
    PosDocumentService,
    PosCommissionAgreementService,
  ],
  exports: [
    PosPartnerService,
    PosEligibilityService,
    PosInsurerMappingService,
    PosPartnerRepository,
  ],
})
export class PosPartnersModule {}
