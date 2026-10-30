import { Module } from '@nestjs/common';
import { PortalController } from './controllers/portal.controller';
import { CrmIdentityModule } from '../../crm-identity/crm-identity.module';

@Module({
  imports: [CrmIdentityModule],
  controllers: [PortalController],
})
export class PortalModule {}
