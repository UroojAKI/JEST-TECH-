import { Module } from '@nestjs/common';
import { CrmIdentityService } from './services/crm-identity.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  providers: [CrmIdentityService],
  exports: [CrmIdentityService],
})
export class CrmIdentityModule {}
