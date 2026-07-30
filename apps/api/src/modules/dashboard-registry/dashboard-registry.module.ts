import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { DashboardRegistryController } from './controllers/dashboard-registry.controller';
import { DashboardRegistryService } from './services/dashboard-registry.service';
import { DashboardRegistryRepository } from './repositories/dashboard-registry.repository';

@Module({
  imports: [DatabaseModule],
  controllers: [DashboardRegistryController],
  providers: [DashboardRegistryService, DashboardRegistryRepository],
  exports: [DashboardRegistryService, DashboardRegistryRepository],
})
export class DashboardRegistryModule {}
