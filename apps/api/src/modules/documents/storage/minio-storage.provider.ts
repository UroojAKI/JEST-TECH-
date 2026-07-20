import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as Minio from 'minio';
import { StorageProvider } from './storage-provider.interface';

@Injectable()
export class MinioStorageProvider implements StorageProvider, OnModuleInit {
  private readonly logger = new Logger(MinioStorageProvider.name);
  private readonly client: Minio.Client;
  private readonly bucket: string;

  constructor(private readonly config: ConfigService) {
    this.bucket = this.config.get<string>('MINIO_BUCKET', 'jest-documents');
    this.client = new Minio.Client({
      endPoint: this.config.get<string>('MINIO_HOST', 'localhost'),
      port: this.config.get<number>('MINIO_PORT', 9000),
      useSSL: this.config.get<string>('NODE_ENV') === 'production',
      accessKey: this.config.get<string>('MINIO_ROOT_USER', 'minioadmin'),
      secretKey: this.config.get<string>('MINIO_ROOT_PASSWORD', 'minioadmin'),
    });
  }

  async onModuleInit() {
    try {
      const exists = await this.client.bucketExists(this.bucket);
      if (!exists) {
        await this.client.makeBucket(this.bucket, 'us-east-1');
        this.logger.log(`Created MinIO bucket: ${this.bucket}`);
      }
    } catch (error: any) {
      this.logger.warn(`MinIO initialization failed: ${error.message}. Falling back to local storage.`);
    }
  }

  async uploadFile(buffer: Buffer, key: string, mimeType: string): Promise<string> {
    await this.client.putObject(this.bucket, key, buffer, buffer.length, {
      'Content-Type': mimeType,
    });
    return key;
  }

  async downloadFile(key: string): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      this.client.getObject(this.bucket, key, (err, stream) => {
        if (err) return reject(err);
        stream.on('data', (chunk: Buffer) => chunks.push(chunk));
        stream.on('end', () => resolve(Buffer.concat(chunks)));
        stream.on('error', reject);
      });
    });
  }

  async deleteFile(key: string): Promise<void> {
    await this.client.removeObject(this.bucket, key);
  }

  async getFileUrl(key: string, expiresInSeconds = 3600): Promise<string> {
    return this.client.presignedGetObject(this.bucket, key, expiresInSeconds);
  }
}
