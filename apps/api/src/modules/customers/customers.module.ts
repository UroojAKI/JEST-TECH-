import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CrmIdentityModule } from '../crm-identity/crm-identity.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [DatabaseModule, CrmIdentityModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
