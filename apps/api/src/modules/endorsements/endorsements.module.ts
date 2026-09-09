import { Module } from '@nestjs/common';
import { EndorsementsController } from './controllers/endorsements.controller';
import { EndorsementService } from './services/endorsement.service';
import { DatabaseModule } from '../../database/database.module';

import { AdministrationModule } from '../administration/administration.module';

@Module({
  imports: [DatabaseModule, AdministrationModule],
  controllers: [EndorsementsController],
  providers: [EndorsementService],
  exports: [EndorsementService],
})
export class EndorsementModule {}
