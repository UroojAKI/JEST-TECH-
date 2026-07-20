import { Module } from '@nestjs/common';
import { SystemConfigService } from './services/system-config/system-config.service';
import { SystemConfigController } from './controllers/system-config/system-config.controller';
import { LookupService } from './services/lookup/lookup.service';
import { LookupController } from './controllers/lookup/lookup.controller';
import { NumberingEngineService } from './services/numbering-engine/numbering-engine.service';
import { OrganizationService } from './services/organization/organization.service';
import { OrganizationController } from './controllers/organization/organization.controller';

import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [SystemConfigService, LookupService, NumberingEngineService, OrganizationService],
  controllers: [SystemConfigController, LookupController, OrganizationController],
  exports: [SystemConfigService, LookupService, NumberingEngineService, OrganizationService],
})
export class AdministrationModule {}
