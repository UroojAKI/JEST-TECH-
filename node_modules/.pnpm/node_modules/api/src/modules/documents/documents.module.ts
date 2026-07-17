import { Module } from '@nestjs/common';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentService } from './services/document.service';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DocumentsController],
  providers: [DocumentService, LocalStorageProvider],
  exports: [DocumentService],
})
export class DocumentsModule {}
