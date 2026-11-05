import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { DocumentVerificationStatus, LifeDocumentType, LifePlanCategory, RoleType } from '@prisma/client';
import { LifeQuotationDocumentService } from './life-quotation-document.service';

describe('LifeQuotationDocumentService', () => {
  let service: LifeQuotationDocumentService;
  let prisma: any;

  const mockUser: any = {
    id: 'user-bo-1',
    userId: 'user-bo-1',
    companyId: 'company-1',
    role: RoleType.BACK_OFFICE,
  };

  const mockAgentUser: any = {
    id: 'user-agent-1',
    userId: 'user-agent-1',
    agentId: 'agent-1',
    companyId: 'company-1',
    role: RoleType.AGENT,
  };

  beforeEach(() => {
    prisma = {
      lifeQuotationCase: { findFirst: jest.fn() },
      document: { findFirst: jest.fn() },
      quotation: { findFirst: jest.fn() },
      lifeQuotationDocument: {
        create: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
      },
    };
    service = new LifeQuotationDocumentService(prisma);
  });

  describe('Document Checklist Evaluation', () => {
    it('evaluates dynamic checklist for minor nominee and smoker life assured', async () => {
      const lifeCase = {
        id: 'case-1',
        companyId: 'company-1',
        isLifeAssuredDifferent: true,
        isNomineeMinor: true, // Requires GUARDIAN_APPOINTEE_KYC
        smokerStatus: 'SMOKER', // Requires MEDICAL_REPORT
        annualIncome: 2000000, // Requires INCOME_PROOF_ITR
        planCategory: LifePlanCategory.TERM_INSURANCE,
        policyForm: 'NEW_POLICY',
        documents: [
          {
            documentId: 'doc-1',
            documentType: LifeDocumentType.PROPOSER_PAN,
            verificationStatus: DocumentVerificationStatus.VERIFIED,
            document: { name: 'PAN.pdf' },
          },
        ],
      };

      prisma.lifeQuotationCase.findFirst.mockResolvedValue(lifeCase);

      const checklist = await service.evaluateChecklist('case-1', mockUser);

      expect(checklist.requiredDocuments).toContain(LifeDocumentType.PROPOSER_PAN);
      expect(checklist.requiredDocuments).toContain(LifeDocumentType.PROPOSER_AADHAAR);
      expect(checklist.requiredDocuments).toContain(LifeDocumentType.LIFE_ASSURED_AGE_PROOF);
      expect(checklist.requiredDocuments).toContain(LifeDocumentType.GUARDIAN_APPOINTEE_KYC);
      expect(checklist.requiredDocuments).toContain(LifeDocumentType.MEDICAL_REPORT);
      expect(checklist.requiredDocuments).toContain(LifeDocumentType.INCOME_PROOF_ITR);

      expect(checklist.missingDocuments).toContain(LifeDocumentType.GUARDIAN_APPOINTEE_KYC);
      expect(checklist.allMandatoryVerified).toBe(false);
      expect(checklist.complianceStatus).toBe('PENDING_UPLOAD');
    });
  });

  describe('Document Verification & Authorization', () => {
    it('prohibits AGENT role from verifying documents', async () => {
      await expect(
        service.verifyDocument(
          'doc-record-1',
          { verificationStatus: DocumentVerificationStatus.VERIFIED },
          mockAgentUser, // RoleType.AGENT
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('requires rejectionReason when document is marked REJECTED', async () => {
      prisma.lifeQuotationDocument.findFirst.mockResolvedValue({
        id: 'doc-record-1',
        companyId: 'company-1',
      });

      await expect(
        service.verifyDocument(
          'doc-record-1',
          { verificationStatus: DocumentVerificationStatus.REJECTED, rejectionReason: '' },
          mockUser, // RoleType.BACK_OFFICE
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('successfully verifies document by Back Office', async () => {
      prisma.lifeQuotationDocument.findFirst.mockResolvedValue({
        id: 'doc-record-1',
        companyId: 'company-1',
      });
      prisma.lifeQuotationDocument.update.mockResolvedValue({
        id: 'doc-record-1',
        verificationStatus: DocumentVerificationStatus.VERIFIED,
        verifiedById: 'user-bo-1',
      });

      const result = await service.verifyDocument(
        'doc-record-1',
        { verificationStatus: DocumentVerificationStatus.VERIFIED },
        mockUser,
      );

      expect(prisma.lifeQuotationDocument.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'doc-record-1' },
          data: expect.objectContaining({
            verificationStatus: DocumentVerificationStatus.VERIFIED,
            verifiedById: 'user-bo-1',
          }),
        }),
      );
      expect(result.verificationStatus).toBe(DocumentVerificationStatus.VERIFIED);
    });
  });

  describe('Document Attachment', () => {
    it('verifies quotation belongs to case and company when attaching quote-specific document', async () => {
      prisma.lifeQuotationCase.findFirst.mockResolvedValue({
        id: 'case-1',
        companyId: 'company-1',
      });
      prisma.document.findFirst.mockResolvedValue({
        id: 'doc-1',
      });
      prisma.quotation.findFirst.mockResolvedValue(null); // quotation not found or doesn't belong

      await expect(
        service.attachDocument(
          'case-1',
          {
            documentId: 'doc-1',
            documentType: LifeDocumentType.PROPOSER_PAN,
            quotationId: 'unrelated-quote-id',
          },
          mockUser,
        ),
      ).rejects.toBeInstanceOf(BadRequestException);
    });
  });
});

