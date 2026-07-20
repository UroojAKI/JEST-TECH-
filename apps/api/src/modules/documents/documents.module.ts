import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentsController } from './controllers/documents.controller';
import { DocumentService } from './services/document.service';
import { LocalStorageProvider } from './storage/local-storage.provider';
import { S3StorageProvider } from './storage/s3-storage.provider';
import { MinioStorageProvider } from './storage/minio-storage.provider';
import { STORAGE_PROVIDER_TOKEN } from './storage/storage-provider.interface';
import { DatabaseModule } from '../../database/database.module';

@Module({
  imports: [DatabaseModule],
  controllers: [DocumentsController],
  providers: [
    DocumentService,
    LocalStorageProvider,
    S3StorageProvider,
    MinioStorageProvider,
    {
      provide: STORAGE_PROVIDER_TOKEN,
      useFactory: (
        config: ConfigService,
        local: LocalStorageProvider,
        s3: S3StorageProvider,
        minio: MinioStorageProvider,
      ) => {
        const provider = config.get<string>('STORAGE_PROVIDER', 'LOCAL');
        if (provider === 'MINIO') {
          return minio;
        }
        if (provider === 'S3') {
          return s3;
        }
        return local;
      },
      inject: [
        ConfigService,
        LocalStorageProvider,
        S3StorageProvider,
        MinioStorageProvider,
      ],
    },
  ],
  exports: [DocumentService],
})
export class DocumentsModule {}
