import { Module } from '@nestjs/common';
import { DocumentsModule } from '../documents/documents.module';
import { ExotelClient } from './exotel.client';
import { ClickToCallService } from './click-to-call.service';
import { CallHistoryService } from './call-history.service';
import { RecordingArchiveService } from './recording-archive.service';
import { IncomingCallService } from './incoming-call.service';
import { TelephonyController } from './telephony.controller';
import { ExotelWebhookService } from './exotel-webhook.service';
import { ExotelWebhookController } from './exotel-webhook.controller';

@Module({
  // DocumentsModule provides the shared file storage (MinIO / S3 / local)
  imports: [DocumentsModule],
  controllers: [TelephonyController, ExotelWebhookController],
  providers: [
    ExotelClient,
    ClickToCallService,
    CallHistoryService,
    RecordingArchiveService,
    IncomingCallService,
    ExotelWebhookService,
  ],
  exports: [ExotelClient],
})
export class TelephonyModule {}
