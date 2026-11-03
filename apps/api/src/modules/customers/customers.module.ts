import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { CrmIdentityModule } from '../crm-identity/crm-identity.module';
import { AgentsModule } from '../agents/agents.module';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';

@Module({
  imports: [DatabaseModule, CrmIdentityModule, AgentsModule],
  controllers: [CustomersController],
  providers: [CustomersService],
  exports: [CustomersService],
})
export class CustomersModule {}
