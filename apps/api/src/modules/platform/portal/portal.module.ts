import { Module } from '@nestjs/common';
import { PortalController } from './controllers/portal.controller';

@Module({
  controllers: [PortalController],
})
export class PortalModule {}
