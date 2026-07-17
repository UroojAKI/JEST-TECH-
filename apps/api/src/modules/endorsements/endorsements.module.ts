import { Module } from '@nestjs/common';
import { EndorsementsController } from './controllers/endorsements.controller';
import { EndorsementService } from './services/endorsement.service';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [EndorsementsController],
  providers: [EndorsementService],
  exports: [EndorsementService],
})
export class EndorsementModule {}
