import { ConfigService } from '@nestjs/config';
import { MinioStorageProvider } from '../storage/minio-storage.provider';

function buildConfig(values: Record<string, any>): ConfigService {
  return {
    get: jest.fn((key: string, fallback?: any) =>
      values[key] !== undefined ? values[key] : fallback,
    ),
  } as unknown as ConfigService;
}

describe('MinioStorageProvider', () => {
  it('stays inert in production when STORAGE_PROVIDER is S3 without MinIO credentials', async () => {
    const provider = new MinioStorageProvider(
      buildConfig({
        NODE_ENV: 'production',
        STORAGE_PROVIDER: 'S3',
      }),
    );

    await expect(provider.onModuleInit()).resolves.toBeUndefined();
    await expect(provider.isAvailable()).resolves.toBe(false);
  });

  it('stays inert in production when STORAGE_PROVIDER is LOCAL without MinIO credentials', async () => {
    const provider = new MinioStorageProvider(
      buildConfig({
        NODE_ENV: 'production',
        STORAGE_PROVIDER: 'LOCAL',
      }),
    );

    await expect(provider.onModuleInit()).resolves.toBeUndefined();
    await expect(provider.isAvailable()).resolves.toBe(false);
  });

  it.each(['MINIO', 'DUAL', undefined])(
    'enforces MinIO credentials in production when STORAGE_PROVIDER=%s',
    (storageProvider) => {
      expect(
        () =>
          new MinioStorageProvider(
            buildConfig({
              NODE_ENV: 'production',
              STORAGE_PROVIDER: storageProvider,
            }),
          ),
      ).toThrow(
        'Production object storage requires MINIO_HOST, MINIO_ROOT_USER and MINIO_ROOT_PASSWORD.',
      );
    },
  );
});

