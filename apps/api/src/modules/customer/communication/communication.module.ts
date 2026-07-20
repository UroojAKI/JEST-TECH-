import { Module } from '@nestjs/common';
import { CommunicationService } from './services/communication/communication.service';

@Module({
  providers: [CommunicationService]
})
export class CommunicationModule {}
