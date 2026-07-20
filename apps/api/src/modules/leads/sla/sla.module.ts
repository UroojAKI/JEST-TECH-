import { Module } from '@nestjs/common';
import { SlaMonitorService } from './services/sla-monitor/sla-monitor.service';

@Module({
  providers: [SlaMonitorService],
})
export class SlaModule {}
