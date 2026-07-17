import { Test, TestingModule } from '@nestjs/testing';
import { DocumentsController } from '../controllers/documents.controller';
import { DocumentService } from '../services/document.service';
import { RequestUser } from '../../auth/decorators/current-user.decorator';
import { RoleType, DocumentStatus, DocumentVerificationStatus } from '@prisma/client';

describe('DocumentsController', () => {
  let controller: DocumentsController;
  let service: DocumentService;

  const mockUser: RequestUser = {
    id: 'user-123',
    email: 'agent@jestpolicy.com',
    role: RoleType.SALES_AGENT,
  };

  const mockDoc = {
    id: 'doc-123',
    documentNumber: 'DOC-1234',
    name: 'Aadhaar Card',
    originalFileName: 'aadhaar.pdf',
    mimeType: 'application/pdf',
    size: 2048,
    storageKey: 'POLICY/entity-123/doc-123-aadhaar.pdf',
    storageProvider: 'LOCAL',
    hash: 'mock-hash',
    entityType: 'POLICY',
    entityId: 'policy-123',
    uploadedById: 'user-123',
    status: DocumentStatus.ACTIVE,
    version: 1,
    verificationStatus: DocumentVerificationStatus.PENDING,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [DocumentsController],
      providers: [
        {
          provide: DocumentService,
          useValue: {
            uploadDocument: jest.fn().mockResolvedValue(mockDoc),
            replaceDocument: jest.fn().mockResolvedValue({ ...mockDoc, version: 2 }),
            getEntityDocuments: jest.fn().mockResolvedValue([mockDoc]),
            getDocumentDetails: jest.fn().mockResolvedValue(mockDoc),
            softDeleteDocument: jest.fn().mockResolvedValue(undefined),
            restoreDocument: jest.fn().mockResolvedValue(undefined),
            getAccessLogs: jest.fn().mockResolvedValue([]),
            downloadDocument: jest.fn().mockResolvedValue({
              fileBuffer: Buffer.from('mock-file-content'),
              originalFileName: 'aadhaar.pdf',
              mimeType: 'application/pdf',
            }),
          },
        },
      ],
    }).compile();

    controller = module.get<DocumentsController>(DocumentsController);
    service = module.get<DocumentService>(DocumentService);
  });

  describe('Documents API', () => {
    it('should upload a document', async () => {
      const mockFile = {
        fieldname: 'file',
        originalname: 'aadhaar.pdf',
        encoding: '7bit',
        mimetype: 'application/pdf',
        buffer: Buffer.from('mock-file-content'),
        size: 2048,
      } as Express.Multer.File;

      const result = await controller.uploadDocument(
        mockFile,
        'Aadhaar Card',
        'POLICY',
        'policy-123',
        'KYC',
        '',
        'tag1,tag2',
        mockUser,
        '127.0.0.1',
      );

      expect(result).toEqual(mockDoc);
      expect(service.uploadDocument).toHaveBeenCalled();
    });

    it('should get entity documents', async () => {
      const result = await controller.getEntityDocuments('POLICY', 'policy-123');
      expect(result).toEqual([mockDoc]);
      expect(service.getEntityDocuments).toHaveBeenCalledWith('POLICY', 'policy-123');
    });

    it('should soft delete document', async () => {
      const result = await controller.deleteDocument('doc-123', mockUser, '127.0.0.1');
      expect(result).toEqual({ success: true, message: 'Document soft-deleted' });
      expect(service.softDeleteDocument).toHaveBeenCalledWith('doc-123', mockUser.id, '127.0.0.1');
    });
  });
});
