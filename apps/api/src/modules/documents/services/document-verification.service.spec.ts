import { Test, TestingModule } from '@nestjs/testing';
import { DocumentVerificationService } from './document-verification.service';
import { PrismaService } from '../../../database/prisma.service';
import {
  DocumentStatus,
  DocumentVerificationStatus,
} from '@prisma/client';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

describe('DocumentVerificationService (G017 Lifecycle & Segregation of Duties)', () => {
  let service: DocumentVerificationService;
  let prisma: PrismaService;

  const mockPrisma = {
    document: {
      findFirst: jest.fn(),
      update: jest.fn(),
    },
    documentAccessLog: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DocumentVerificationService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<DocumentVerificationService>(DocumentVerificationService);
    prisma = module.get<PrismaService>(PrismaService);
  });

  describe('startReview', () => {
    it('moves uploaded document to UNDER_REVIEW', async () => {
      const doc = {
        id: 'doc-1',
        uploadedById: 'agent-1',
        metadata: { lifecycleState: 'UPLOADED' },
      };

      mockPrisma.document.findFirst.mockResolvedValue(doc);
      mockPrisma.document.update.mockResolvedValue({
        id: 'doc-1',
        verificationStatus: DocumentVerificationStatus.PENDING,
      });

      const result = await service.startReview('doc-1', 'underwriter-1');

      expect(result.lifecycleState).toBe('UNDER_REVIEW');
      expect(mockPrisma.document.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            metadata: expect.objectContaining({
              lifecycleState: 'UNDER_REVIEW',
              reviewerId: 'underwriter-1',
            }),
          }),
        }),
      );
    });

    it('rejects review if document is already verified', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-2',
        metadata: { lifecycleState: 'VERIFIED' },
      });

      await expect(
        service.startReview('doc-2', 'underwriter-1'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('submitVerification', () => {
    it('rejects self-verification when uploader attempts to verify their own document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-3',
        uploadedById: 'agent-1',
        metadata: { lifecycleState: 'UNDER_REVIEW' },
      });

      await expect(
        service.submitVerification(
          'doc-3',
          { status: 'VERIFIED' },
          'agent-1', // Same user!
        ),
      ).rejects.toThrow(ForbiddenException);
    });

    it('rejects verification if document has not been placed under review', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-4',
        uploadedById: 'agent-1',
        metadata: { lifecycleState: 'UPLOADED' }, // Still in UPLOADED
      });

      await expect(
        service.submitVerification(
          'doc-4',
          { status: 'VERIFIED' },
          'underwriter-1',
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('successfully verifies document by independent underwriter', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-5',
        uploadedById: 'agent-1',
        metadata: { lifecycleState: 'UNDER_REVIEW' },
      });

      mockPrisma.document.update.mockResolvedValue({
        id: 'doc-5',
        verificationStatus: DocumentVerificationStatus.VERIFIED,
      });

      const result = await service.submitVerification(
        'doc-5',
        { status: 'VERIFIED', notes: 'All RC details match Vahan database' },
        'underwriter-2',
      );

      expect(result.lifecycleState).toBe('VERIFIED');
      expect(result.verificationStatus).toBe(DocumentVerificationStatus.VERIFIED);
      expect(mockPrisma.documentAccessLog.create).toHaveBeenCalled();
    });

    it('requires a mandatory rejectionReason when rejecting document', async () => {
      mockPrisma.document.findFirst.mockResolvedValue({
        id: 'doc-6',
        uploadedById: 'agent-1',
        metadata: { lifecycleState: 'UNDER_REVIEW' },
      });

      await expect(
        service.submitVerification(
          'doc-6',
          { status: 'REJECTED', rejectionReason: '' },
          'underwriter-2',
        ),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
