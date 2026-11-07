import {
  Injectable,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { DocumentVerificationStatus, LoanEnquiryStatus, RoleType } from '@prisma/client';

@Injectable()
export class LoanDocumentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authzService: ResourceAuthorizationService,
  ) {}

  async attachDocument(
    caseId: string,
    documentId: string,
    documentType: string,
    actor: ActorContext,
  ) {
    const loanCase = await this.prisma.loanApplicationCase.findUnique({
      where: { id: caseId },
    });
    if (!loanCase || loanCase.deletedAt) {
      throw new NotFoundException(`Loan case ${caseId} not found`);
    }

    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'UPDATE', loanCase);

    const doc = await this.prisma.document.findUnique({
      where: { id: documentId },
    });
    if (!doc) {
      throw new NotFoundException(`Document ${documentId} not found`);
    }

    return this.prisma.loanDocument.create({
      data: {
        companyId: loanCase.companyId,
        loanCaseId: caseId,
        documentId,
        documentType,
        verificationStatus: DocumentVerificationStatus.PENDING,
      },
      include: {
        document: true,
      },
    });
  }

  async verifyDocument(
    loanDocId: string,
    verificationStatus: 'VERIFIED' | 'REJECTED',
    rejectionReason?: string,
    actor?: ActorContext,
  ) {
    if (
      actor &&
      actor.role !== RoleType.ADMIN &&
      actor.role !== RoleType.BACK_OFFICE
    ) {
      throw new ForbiddenException(
        'Only Back Office operators or Administrators may verify loan documents',
      );
    }

    const loanDoc = await this.prisma.loanDocument.findUnique({
      where: { id: loanDocId },
      include: { loanCase: true },
    });
    if (!loanDoc) {
      throw new NotFoundException(`Loan document ${loanDocId} not found`);
    }

    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.loanDocument.update({
        where: { id: loanDocId },
        data: {
          verificationStatus:
            verificationStatus === 'VERIFIED'
              ? DocumentVerificationStatus.VERIFIED
              : DocumentVerificationStatus.REJECTED,
          rejectionReason: rejectionReason || null,
          verifiedById: actor?.userId || null,
          verifiedAt: new Date(),
        },
        include: { document: true },
      });

      // Also update the underlying Document record
      await tx.document.update({
        where: { id: loanDoc.documentId },
        data: {
          verificationStatus:
            verificationStatus === 'VERIFIED'
              ? DocumentVerificationStatus.VERIFIED
              : DocumentVerificationStatus.REJECTED,
        },
      });

      return updated;
    });
  }

  async uploadSanctionLetter(
    offerId: string,
    documentId: string,
    actor: ActorContext,
  ) {
    const offer = await this.prisma.loanLenderOffer.findUnique({
      where: { id: offerId },
      include: {
        facility: {
          include: { loanCase: true },
        },
      },
    });
    if (!offer) {
      throw new NotFoundException(`Lender offer ${offerId} not found`);
    }

    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'UPDATE', offer.facility.loanCase);

    return this.prisma.$transaction(async (tx) => {
      const updatedOffer = await tx.loanLenderOffer.update({
        where: { id: offerId },
        data: {
          sanctionLetterDocId: documentId,
          sanctionDate: new Date(),
        },
      });

      // Update case status to SANCTIONED
      await tx.loanApplicationCase.update({
        where: { id: offer.facility.loanCaseId },
        data: {
          status: LoanEnquiryStatus.SANCTIONED,
        },
      });

      return updatedOffer;
    });
  }
}

