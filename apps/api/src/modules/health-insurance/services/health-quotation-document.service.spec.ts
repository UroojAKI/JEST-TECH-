import { DocumentVerificationStatus, HealthDocumentType, HealthPlanCategory, HealthPolicyForm } from '@prisma/client';
import { HealthQuotationDocumentService } from './health-quotation-document.service';
import { HealthDocumentRuleService } from './health-document-rule.service';

describe('HealthQuotationDocumentService checklist', () => {
  const user: any = { id: 'reviewer-1', userId: 'reviewer-1', companyId: 'company-1', role: 'BACK_OFFICE' };

  const makeService = (documents: any[]) => {
    const prisma: any = {
      healthQuotationDocument: { findMany: jest.fn().mockResolvedValue(documents) },
    };
    const caseService: any = {
      findCaseForActor: jest.fn().mockResolvedValue({
        id: 'case-1',
        caseCode: 'HC-001',
        planCategory: HealthPlanCategory.INDIVIDUAL,
        policyForm: HealthPolicyForm.NEW_POLICY,
      }),
    };
    return new HealthQuotationDocumentService(prisma, new HealthDocumentRuleService(), caseService);
  };

  it('marks rejected required uploads as rejected and incomplete', async () => {
    const service = makeService([
      { id: 'proposal-1', documentType: HealthDocumentType.PROPOSAL_FORM, verificationStatus: DocumentVerificationStatus.REJECTED },
      { id: 'kyc-1', documentType: HealthDocumentType.KYC_DOCUMENTS, verificationStatus: DocumentVerificationStatus.VERIFIED },
      { id: 'age-1', documentType: HealthDocumentType.AGE_PROOF, verificationStatus: DocumentVerificationStatus.VERIFIED },
      { id: 'health-1', documentType: HealthDocumentType.GOOD_HEALTH_DECLARATION, verificationStatus: DocumentVerificationStatus.VERIFIED },
    ]);

    const result = await service.getChecklist('case-1', user);
    const proposal = result.checklist.find((item) => item.documentType === HealthDocumentType.PROPOSAL_FORM);

    expect(proposal.status).toBe('REJECTED');
    expect(result.missingRequired).toContain(HealthDocumentType.PROPOSAL_FORM);
    expect(result.rejectedRequired).toContain(HealthDocumentType.PROPOSAL_FORM);
    expect(result.complete).toBe(false);
    expect(result.verificationComplete).toBe(false);
  });

  it('keeps pending uploads visible but does not report verification complete', async () => {
    const service = makeService([
      { id: 'proposal-1', documentType: HealthDocumentType.PROPOSAL_FORM, verificationStatus: DocumentVerificationStatus.PENDING },
      { id: 'kyc-1', documentType: HealthDocumentType.KYC_DOCUMENTS, verificationStatus: DocumentVerificationStatus.VERIFIED },
      { id: 'age-1', documentType: HealthDocumentType.AGE_PROOF, verificationStatus: DocumentVerificationStatus.VERIFIED },
      { id: 'health-1', documentType: HealthDocumentType.GOOD_HEALTH_DECLARATION, verificationStatus: DocumentVerificationStatus.VERIFIED },
    ]);

    const result = await service.getChecklist('case-1', user);
    const proposal = result.checklist.find((item) => item.documentType === HealthDocumentType.PROPOSAL_FORM);

    expect(proposal.status).toBe('UPLOADED');
    expect(result.complete).toBe(true);
    expect(result.verificationComplete).toBe(false);
  });
});
