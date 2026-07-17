export interface StorageProvider {
  uploadFile(fileBuffer: Buffer, key: string, mimeType: string): Promise<string>;
  downloadFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
}
