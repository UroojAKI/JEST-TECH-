import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentService } from './services/document.service';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { S3StorageProvider } from './storage/s3-storage.provider';
import { STORAGE_PROVIDER_TOKEN } from './storage/storage-provider.interface';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DocumentsController],
  providers: [
    DocumentService,
    LocalStorageProvider,
    S3StorageProvider,
    {
      provide: STORAGE_PROVIDER_TOKEN,
      useFactory: (config: ConfigService, local: LocalStorageProvider, s3: S3StorageProvider) => {
        const provider = config.get<string>('STORAGE_PROVIDER', 'LOCAL');
        if (provider === 'S3' || provider === 'MINIO') {
          return s3;
        }
        return local;
      },
      inject: [ConfigService, LocalStorageProvider, S3StorageProvider],
    },
  ],
  exports: [DocumentService],
})
export class DocumentsModule {}
