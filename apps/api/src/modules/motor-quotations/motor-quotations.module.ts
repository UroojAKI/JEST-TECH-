import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../database/database.module';
import { LeadsModule } from '../leads/leads.module';
import { MotorQuotationsController } from './motor-quotations.controller';
import { MotorQuotationsService } from './motor-quotations.service';

@Module({
  imports: [DatabaseModule, LeadsModule],
  controllers: [MotorQuotationsController],
  providers: [MotorQuotationsService],
  exports: [MotorQuotationsService],
})
export class MotorQuotationsModule {}
