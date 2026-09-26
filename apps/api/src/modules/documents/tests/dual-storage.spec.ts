import * as crypto from 'crypto';
import { Test, TestingModule } from '@nestjs/testing';
import { DualStorageProvider } from '../storage/dual-storage.provider';
import { LocalStorageProvider } from '../storage/local-storage.provider';
import { MinioStorageProvider } from '../storage/minio-storage.provider';
import { DocumentService } from '../services/document.service';
import { PrismaService } from '../../../database/prisma.service';
import { STORAGE_PROVIDER_TOKEN } from '../storage/storage-provider.interface';
import { RoleType, DocumentStatus, DocumentVerificationStatus } from '@prisma/client';

describe('Phase 28: DualStorageProvider, Replication & Read-Repair', () => {
  let dualStorage: DualStorageProvider;
  let mockMinio: jest.Mocked<MinioStorageProvider>;
  let mockLocal: jest.Mocked<LocalStorageProvider>;

  beforeEach(() => {
    mockMinio = {
      getProviderName: jest.fn().mockReturnValue('MINIO'),
      isAvailable: jest.fn().mockResolvedValue(true),
      uploadFile: jest.fn().mockImplementation(async (buf, key) => key),
      downloadFile: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockLocal = {
      getProviderName: jest.fn().mockReturnValue('LOCAL'),
      isAvailable: jest.fn().mockResolvedValue(true),
      uploadFile: jest.fn().mockImplementation(async (buf, key) => key),
      downloadFile: jest.fn(),
      deleteFile: jest.fn().mockResolvedValue(undefined),
    } as any;

    dualStorage = new DualStorageProvider(mockMinio, mockLocal);
  });

  describe('uploadWithFailover', () => {
    it('should upload to primary MinIO and return SYNCED status when MinIO is available', async () => {
      const buffer = Buffer.from('test content');
      const key = 'test/doc-1.pdf';

      const result = await dualStorage.uploadWithFailover(buffer, key, 'application/pdf');

      expect(mockMinio.uploadFile).toHaveBeenCalledWith(buffer, key, 'application/pdf');
      expect(mockLocal.uploadFile).toHaveBeenCalledWith(buffer, key, 'application/pdf');
      expect(result).toEqual({
        key,
        provider: 'MINIO',
        replicationStatus: 'SYNCED',
      });
    });

    it('should failover to Local storage when MinIO is unavailable', async () => {
      mockMinio.isAvailable.mockResolvedValue(false);
      const buffer = Buffer.from('test content');
      const key = 'test/doc-2.pdf';

      const result = await dualStorage.uploadWithFailover(buffer, key, 'application/pdf');

      expect(mockMinio.uploadFile).not.toHaveBeenCalled();
      expect(mockLocal.uploadFile).toHaveBeenCalledWith(buffer, key, 'application/pdf');
      expect(result).toEqual({
        key,
        provider: 'LOCAL',
        replicationStatus: 'PENDING_REPLICATION',
      });
    });

    it('should failover to Local storage when MinIO upload throws an error', async () => {
      mockMinio.isAvailable.mockResolvedValue(true);
      mockMinio.uploadFile.mockRejectedValue(new Error('MinIO connection timeout'));
      const buffer = Buffer.from('test content');
      const key = 'test/doc-3.pdf';

      const result = await dualStorage.uploadWithFailover(buffer, key, 'application/pdf');

      expect(mockMinio.uploadFile).toHaveBeenCalled();
      expect(mockLocal.uploadFile).toHaveBeenCalledWith(buffer, key, 'application/pdf');
      expect(result).toEqual({
        key,
        provider: 'LOCAL',
        replicationStatus: 'PENDING_REPLICATION',
      });
    });
  });

  describe('downloadWithReadRepair', () => {
    it('should serve locally without repair when MinIO remains offline', async () => {
      const buffer = Buffer.from('local file content');
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const key = 'test/doc-local.pdf';

      mockLocal.downloadFile.mockResolvedValue(buffer);
      mockMinio.isAvailable.mockResolvedValue(false);

      const result = await dualStorage.downloadWithReadRepair(key, {
        storageProvider: 'LOCAL',
        hash,
        metadata: { replicationStatus: 'PENDING_REPLICATION' },
      });

      expect(result.fileBuffer).toEqual(buffer);
      expect(result.repaired).toBe(false);
      expect(mockMinio.uploadFile).not.toHaveBeenCalled();
    });

    it('should perform read-repair, verify SHA-256 checksum, and signal repaired=true when MinIO becomes available', async () => {
      const buffer = Buffer.from('repair target content');
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const key = 'test/doc-repair.pdf';

      mockLocal.downloadFile.mockResolvedValue(buffer);
      mockMinio.isAvailable.mockResolvedValue(true);
      mockMinio.uploadFile.mockResolvedValue(key);
      mockMinio.downloadFile.mockResolvedValue(buffer); // Verified remote content

      const result = await dualStorage.downloadWithReadRepair(key, {
        storageProvider: 'LOCAL',
        hash,
        mimeType: 'application/pdf',
        metadata: { replicationStatus: 'PENDING_REPLICATION' },
      });

      expect(result.fileBuffer).toEqual(buffer);
      expect(result.repaired).toBe(true);
      expect(mockMinio.uploadFile).toHaveBeenCalledWith(buffer, key, 'application/pdf');
      expect(mockMinio.downloadFile).toHaveBeenCalledWith(key);
    });

    it('should NOT signal repaired if MinIO checksum verification fails', async () => {
      const buffer = Buffer.from('original content');
      const hash = crypto.createHash('sha256').update(buffer).digest('hex');
      const corruptedBuffer = Buffer.from('corrupted content');
      const key = 'test/doc-corrupt.pdf';

      mockLocal.downloadFile.mockResolvedValue(buffer);
      mockMinio.isAvailable.mockResolvedValue(true);
      mockMinio.uploadFile.mockResolvedValue(key);
      mockMinio.downloadFile.mockResolvedValue(corruptedBuffer); // Corrupted

      const result = await dualStorage.downloadWithReadRepair(key, {
        storageProvider: 'LOCAL',
        hash,
        metadata: { replicationStatus: 'PENDING_REPLICATION' },
      });

      expect(result.fileBuffer).toEqual(buffer);
      expect(result.repaired).toBe(false);
    });

    it('should fallback to local storage if MinIO download throws for MINIO-stored document', async () => {
      const localBuffer = Buffer.from('local mirror content');
      const key = 'test/doc-fallback.pdf';

      mockMinio.downloadFile.mockRejectedValue(new Error('S3 500 internal error'));
      mockLocal.downloadFile.mockResolvedValue(localBuffer);

      const result = await dualStorage.downloadWithReadRepair(key, {
        storageProvider: 'MINIO',
        hash: 'somehash',
        metadata: { replicationStatus: 'SYNCED' },
      });

      expect(result.fileBuffer).toEqual(localBuffer);
      expect(result.repaired).toBe(false);
      expect(mockLocal.downloadFile).toHaveBeenCalledWith(key);
    });
  });

  describe('DocumentService Integration with Read-Repair', () => {
    let documentService: DocumentService;
    let mockPrisma: any;

    beforeEach(async () => {
      mockPrisma = {
        document: {
          create: jest.fn(),
          update: jest.fn(),
          findUnique: jest.fn(),
        },
        documentVersion: {
          create: jest.fn(),
        },
        documentAccessLog: {
          create: jest.fn(),
        },
        lead: { findUnique: jest.fn().mockResolvedValue({ companyId: 'org-1' }) },
        policy: { findUnique: jest.fn().mockResolvedValue({ companyId: 'org-1' }) },
      };

      const module: TestingModule = await Test.createTestingModule({
        providers: [
          DocumentService,
          { provide: PrismaService, useValue: mockPrisma },
          { provide: STORAGE_PROVIDER_TOKEN, useValue: dualStorage },
        ],
      }).compile();

      documentService = module.get<DocumentService>(DocumentService);
    });

    it('should update database to MINIO and SYNCED when downloadDocument performs read-repair', async () => {
      const fileBuffer = Buffer.from('test read repair file');
      const hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

      const mockDoc = {
        id: 'doc-repair-123',
        documentNumber: 'DOC-123',
        storageKey: 'POLICY/entity-1/doc.pdf',
        storageProvider: 'LOCAL',
        hash,
        originalFileName: 'doc.pdf',
        mimeType: 'application/pdf',
        status: DocumentStatus.ACTIVE,
        uploadedById: 'user-1',
        uploadedBy: {
          id: 'user-1',
          companyId: 'org-1',
        },
        metadata: { replicationStatus: 'PENDING_REPLICATION' },
      };

      mockPrisma.document.findUnique.mockResolvedValue(mockDoc);
      mockLocal.downloadFile.mockResolvedValue(fileBuffer);
      mockMinio.isAvailable.mockResolvedValue(true);
      mockMinio.uploadFile.mockResolvedValue('POLICY/entity-1/doc.pdf');
      mockMinio.downloadFile.mockResolvedValue(fileBuffer);

      const actor = {
        id: 'user-1',
        userId: 'user-1',
        role: RoleType.ADMIN,
        companyId: 'org-1',
        organizationId: 'org-1',
      };

      const download = await documentService.downloadDocument(
        'doc-repair-123',
        'user-1',
        '127.0.0.1',
        actor as any,
      );

      expect(download.fileBuffer).toEqual(fileBuffer);
      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-repair-123' },
          data: expect.objectContaining({
            storageProvider: 'MINIO',
            metadata: expect.objectContaining({
              replicationStatus: 'SYNCED',
            }),
          }),
        }),
      );
    });
  });
});
