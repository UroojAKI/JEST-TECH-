import { Test, TestingModule } from '@nestjs/testing';
import { MotorQuotationDocumentService } from './motor-quotation-document.service';
import { PrismaService } from '../../../database/prisma.service';
import { NotFoundException } from '@nestjs/common';
import { MotorDocumentType, DocumentVerificationStatus } from '@prisma/client';

describe('MotorQuotationDocumentService', () => {
  let service: MotorQuotationDocumentService;

  const mockPrisma = {
    quotation: {
      findFirst: jest.fn(),
    },
    document: {
      findFirst: jest.fn(),
    },
    motorQuotationDocument: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  const mockUser = {
    id: 'user-1',
    companyId: 'comp-1',
    role: 'AGENT',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        MotorQuotationDocumentService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<MotorQuotationDocumentService>(MotorQuotationDocumentService);
  });

  describe('attachDocument', () => {
    it('creates a motor quotation document association', async () => {
      const mockQuote = { id: 'quote-1', companyId: 'comp-1', caseId: 'case-1' };
      const mockDoc = { id: 'doc-1', companyId: 'comp-1' };

      mockPrisma.quotation.findFirst.mockResolvedValue(mockQuote);
      mockPrisma.document.findFirst.mockResolvedValue(mockDoc);
      mockPrisma.motorQuotationDocument.create.mockResolvedValue({
        id: 'mqd-1',
        quotationId: 'quote-1',
        caseId: 'case-1',
        documentId: 'doc-1',
        documentType: MotorDocumentType.INSURER_QUOTE,
        verificationStatus: DocumentVerificationStatus.PENDING,
      });

      const result = await service.attachDocument(
        'quote-1',
        { documentId: 'doc-1', documentType: MotorDocumentType.INSURER_QUOTE },
        mockUser as any,
      );

      expect(mockPrisma.motorQuotationDocument.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          quotationId: 'quote-1',
          caseId: 'case-1',
          documentId: 'doc-1',
          documentType: MotorDocumentType.INSURER_QUOTE,
          verificationStatus: 'PENDING',
        }),
        include: { document: true },
      });
      expect(result.id).toBe('mqd-1');
    });

    it('throws NotFoundException if quotation does not exist or tenant mismatch', async () => {
      mockPrisma.quotation.findFirst.mockResolvedValue(null);

      await expect(
        service.attachDocument(
          'quote-foreign',
          { documentId: 'doc-1', documentType: MotorDocumentType.INSURER_QUOTE },
          mockUser as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws NotFoundException if document does not belong to tenant', async () => {
      mockPrisma.quotation.findFirst.mockResolvedValue({ id: 'quote-1', companyId: 'comp-1' });
      mockPrisma.document.findFirst.mockResolvedValue(null);

      await expect(
        service.attachDocument(
          'quote-1',
          { documentId: 'doc-foreign', documentType: MotorDocumentType.INSURER_QUOTE },
          mockUser as any,
        ),
      ).rejects.toThrow(NotFoundException);
    });
  });

  describe('verifyDocument', () => {
    it('updates verificationStatus and records verifier ID', async () => {
      const mockMqd = { id: 'mqd-1', companyId: 'comp-1' };

      mockPrisma.motorQuotationDocument.findFirst.mockResolvedValue(mockMqd);
      mockPrisma.motorQuotationDocument.update.mockResolvedValue({
        ...mockMqd,
        verificationStatus: DocumentVerificationStatus.VERIFIED,
        verifiedById: 'user-1',
      });

      const result = await service.verifyDocument(
        'mqd-1',
        { status: DocumentVerificationStatus.VERIFIED },
        mockUser as any,
      );

      expect(mockPrisma.motorQuotationDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'mqd-1' },
          data: expect.objectContaining({
            verificationStatus: 'VERIFIED',
            verifiedById: 'user-1',
          }),
        }),
      );
      expect(result.verificationStatus).toBe('VERIFIED');
    });
  });
});