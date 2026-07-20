export interface StorageProvider {
  getProviderName(): string;
  uploadFile(fileBuffer: Buffer, key: string, mimeType: string): Promise<string>;
  downloadFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
}

export const STORAGE_PROVIDER_TOKEN = 'StorageProvider';
