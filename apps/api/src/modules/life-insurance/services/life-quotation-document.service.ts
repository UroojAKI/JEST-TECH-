import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  DocumentVerificationStatus,
  LifeDocumentType,
  LifePlanCategory,
  LifePolicyForm,
  Prisma,
  RoleType,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { RequestUser } from '../../auth/decorators/current-user.decorator';

export interface AttachLifeDocumentDto {
  documentId: string;
  documentType: LifeDocumentType;
  quotationId?: string;
}

export interface VerifyLifeDocumentDto {
  verificationStatus: DocumentVerificationStatus;
  rejectionReason?: string;
}

export interface LifeDocumentChecklistResult {
  requiredDocuments: LifeDocumentType[];
  uploadedDocuments: {
    documentId: string;
    documentType: LifeDocumentType;
    verificationStatus: DocumentVerificationStatus;
    fileName?: string;
    originalFileName?: string;
    rejectionReason?: string;
  }[];
  missingDocuments: LifeDocumentType[];
  allMandatoryVerified: boolean;
  complianceStatus: 'VERIFIED' | 'PENDING_UPLOAD' | 'PENDING_VERIFICATION' | 'REJECTED';
}

@Injectable()
export class LifeQuotationDocumentService {
  constructor(private readonly prisma: PrismaService) {}

  private caseWhereFor(user: RequestUser): Prisma.LifeQuotationCaseWhereInput {
    const where: Prisma.LifeQuotationCaseWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
    };
    if (user.role !== RoleType.AGENT) return where;

    const ownership: Prisma.LifeQuotationCaseWhereInput[] = [];
    if (user.agentId) ownership.push({ agentId: user.agentId });
    ownership.push({ agentId: null, createdById: user.userId || user.id });
    return { ...where, OR: ownership };
  }

  async attachDocument(
    caseId: string,
    dto: AttachLifeDocumentDto,
    user: RequestUser,
  ) {
    const lifeCase = await this.prisma.lifeQuotationCase.findFirst({
      where: { id: caseId, ...this.caseWhereFor(user) },
    });
    if (!lifeCase) {
      throw new NotFoundException(`LifeQuotationCase '${caseId}' not found or access denied`);
    }

    // Verify document exists and belongs to company (via uploadedBy)
    const document = await this.prisma.document.findFirst({
      where: {
        id: dto.documentId,
        uploadedBy: { companyId: user.companyId },
        deletedAt: null,
      },
    });
    if (!document) {
      throw new NotFoundException(`Document '${dto.documentId}' not found or access denied`);
    }

    // If quotationId is supplied, verify it belongs to this case and tenant
    if (dto.quotationId) {
      const quote = await this.prisma.quotation.findFirst({
        where: {
          id: dto.quotationId,
          lifeCaseId: caseId,
          companyId: user.companyId,
          deletedAt: null,
        },
      });
      if (!quote) {
        throw new BadRequestException(
          `Quotation '${dto.quotationId}' does not belong to Life case '${caseId}'`,
        );
      }
    }

    return this.prisma.lifeQuotationDocument.create({
      data: {
        companyId: user.companyId,
        caseId,
        quotationId: dto.quotationId || null,
        documentId: dto.documentId,
        documentType: dto.documentType,
        verificationStatus: DocumentVerificationStatus.PENDING,
      },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            originalFileName: true,
            mimeType: true,
            size: true,
          },
        },
      },
    });
  }

  async verifyDocument(
    documentRecordId: string,
    dto: VerifyLifeDocumentDto,
    user: RequestUser,
  ) {
    if (user.role === RoleType.AGENT) {
      throw new ForbiddenException(
        'Agents cannot verify Life insurance documents. Back Office or Admin authorization required.',
      );
    }

    const docRecord = await this.prisma.lifeQuotationDocument.findFirst({
      where: {
        id: documentRecordId,
        companyId: user.companyId,
      },
      include: { case: true },
    });
    if (!docRecord) {
      throw new NotFoundException(`LifeQuotationDocument '${documentRecordId}' not found`);
    }

    if (
      dto.verificationStatus === DocumentVerificationStatus.REJECTED &&
      !dto.rejectionReason?.trim()
    ) {
      throw new BadRequestException('A reason is mandatory when rejecting a document');
    }

    return this.prisma.lifeQuotationDocument.update({
      where: { id: documentRecordId },
      data: {
        verificationStatus: dto.verificationStatus,
        rejectionReason:
          dto.verificationStatus === DocumentVerificationStatus.REJECTED
            ? dto.rejectionReason?.trim()
            : null,
        verifiedById: user.userId || user.id,
        verifiedAt: new Date(),
      },
    });
  }

  async getCaseDocuments(caseId: string, user: RequestUser) {
    const lifeCase = await this.prisma.lifeQuotationCase.findFirst({
      where: { id: caseId, ...this.caseWhereFor(user) },
    });
    if (!lifeCase) {
      throw new NotFoundException(`LifeQuotationCase '${caseId}' not found or access denied`);
    }

    return this.prisma.lifeQuotationDocument.findMany({
      where: { caseId, companyId: user.companyId },
      include: {
        document: {
          select: {
            id: true,
            name: true,
            originalFileName: true,
            mimeType: true,
            size: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async evaluateChecklist(
    caseId: string,
    user: RequestUser,
  ): Promise<LifeDocumentChecklistResult> {
    const lifeCase = await this.prisma.lifeQuotationCase.findFirst({
      where: { id: caseId, ...this.caseWhereFor(user) },
      include: {
        documents: {
          include: { document: true },
        },
      },
    });
    if (!lifeCase) {
      throw new NotFoundException(`LifeQuotationCase '${caseId}' not found or access denied`);
    }

    const requiredDocs: LifeDocumentType[] = [
      LifeDocumentType.PROPOSER_PAN,
      LifeDocumentType.PROPOSER_AADHAAR,
    ];

    if (lifeCase.isLifeAssuredDifferent) {
      requiredDocs.push(
        LifeDocumentType.LIFE_ASSURED_AGE_PROOF,
        LifeDocumentType.LIFE_ASSURED_PHOTO,
      );
    }

    if (lifeCase.isNomineeMinor) {
      requiredDocs.push(LifeDocumentType.GUARDIAN_APPOINTEE_KYC);
    }

    if (
      Number(lifeCase.annualIncome || 0) >= 1500000 ||
      lifeCase.planCategory === LifePlanCategory.TERM_INSURANCE
    ) {
      requiredDocs.push(LifeDocumentType.INCOME_PROOF_ITR);
    }

    if (lifeCase.smokerStatus === 'SMOKER' || lifeCase.hasPreExistingIllness) {
      requiredDocs.push(LifeDocumentType.MEDICAL_REPORT);
    }

    if (lifeCase.planCategory === LifePlanCategory.GROUP_INSURANCE) {
      requiredDocs.push(LifeDocumentType.GROUP_EMPLOYEE_LIST);
    }

    if (lifeCase.planCategory === LifePlanCategory.INVESTMENT_PLANS) {
      requiredDocs.push(LifeDocumentType.INVESTMENT_RISK_PROFILE);
    }

    if (lifeCase.policyForm === LifePolicyForm.RENEWAL) {
      requiredDocs.push(LifeDocumentType.PREVIOUS_POLICY_COPY);
    }

    const uploadedDocuments = lifeCase.documents.map((d) => ({
      documentId: d.documentId,
      documentType: d.documentType,
      verificationStatus: d.verificationStatus,
      fileName: d.document?.name,
      originalFileName: d.document?.originalFileName,
      rejectionReason: d.rejectionReason || undefined,
    }));

    const verifiedDocTypes = new Set(
      lifeCase.documents
        .filter((d) => d.verificationStatus === DocumentVerificationStatus.VERIFIED)
        .map((d) => d.documentType),
    );

    const uploadedDocTypes = new Set(lifeCase.documents.map((d) => d.documentType));

    const missingDocuments = requiredDocs.filter((req) => !uploadedDocTypes.has(req));
    const allMandatoryVerified = requiredDocs.every((req) => verifiedDocTypes.has(req));

    const hasRejections = lifeCase.documents.some(
      (d) => d.verificationStatus === DocumentVerificationStatus.REJECTED,
    );

    let complianceStatus: LifeDocumentChecklistResult['complianceStatus'] = 'PENDING_UPLOAD';
    if (hasRejections) {
      complianceStatus = 'REJECTED';
    } else if (missingDocuments.length > 0) {
      complianceStatus = 'PENDING_UPLOAD';
    } else if (allMandatoryVerified) {
      complianceStatus = 'VERIFIED';
    } else {
      complianceStatus = 'PENDING_VERIFICATION';
    }

    return {
      requiredDocuments: requiredDocs,
      uploadedDocuments,
      missingDocuments,
      allMandatoryVerified,
      complianceStatus,
    };
  }
}

