import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { SaodVerificationMethod, SaodVerificationStatus } from '@prisma/client';

export interface CreateSaodVerificationDto {
  quotationId: string;
  tpInsurer: string;
  tpPolicyNumber: string;
  tpStartDate: string; // ISO date string
  tpExpiryDate: string; // ISO date string
  verificationMethod: SaodVerificationMethod;
  evidenceDocumentUrl?: string;
  verifierNotes?: string;
  verifiedById: string; // Current user ID — always captured
}

@Injectable()
export class SaodVerificationService {
  private readonly logger = new Logger(SaodVerificationService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * Validate that the SAOD policyType has a valid active TP verification.
   * Called by QuotationService before saving any SAOD quote.
   * Throws BadRequestException if validation fails.
   */
  async validateSaodEligibility(
    quotationId: string,
    quotationDate: Date,
  ): Promise<void> {
    const verification = await this.prisma.saodTpVerification.findUnique({
      where: { quotationId },
    });

    if (!verification) {
      throw new BadRequestException(
        'SAOD policy requires active TP policy verification. Please complete TP verification before saving.',
      );
    }

    if (verification.verificationStatus !== SaodVerificationStatus.VERIFIED) {
      throw new BadRequestException(
        `SAOD cannot proceed: TP verification status is "${verification.verificationStatus}". Only VERIFIED status is accepted.`,
      );
    }

    // Check TP expiry — must be valid on the quotation date
    if (verification.tpExpiryDate <= quotationDate) {
      throw new BadRequestException(
        `SAOD cannot proceed: The verified TP policy (${verification.tpPolicyNumber}) expired on ${verification.tpExpiryDate.toLocaleDateString('en-IN')}. Active TP cover is required.`,
      );
    }

    this.logger.log(
      `SAOD eligibility validated for quotation ${quotationId}. TP: ${verification.tpPolicyNumber}, expires: ${verification.tpExpiryDate}`,
    );
  }

  /**
   * Create or update SAOD TP verification and record an AuditLog entry.
   */
  async createVerification(dto: CreateSaodVerificationDto): Promise<any> {
    const tpStartDate = new Date(dto.tpStartDate);
    const tpExpiryDate = new Date(dto.tpExpiryDate);

    if (tpExpiryDate <= new Date()) {
      throw new BadRequestException(
        'The TP policy expiry date must be in the future for SAOD eligibility.',
      );
    }

    const verification = await this.prisma.saodTpVerification.upsert({
      where: { quotationId: dto.quotationId },
      create: {
        quotationId: dto.quotationId,
        tpInsurer: dto.tpInsurer,
        tpPolicyNumber: dto.tpPolicyNumber,
        tpStartDate,
        tpExpiryDate,
        verificationStatus: SaodVerificationStatus.VERIFIED,
        verificationMethod: dto.verificationMethod,
        evidenceDocumentUrl: dto.evidenceDocumentUrl,
        verifierNotes: dto.verifierNotes,
        verifiedById: dto.verifiedById,
        verifiedAt: new Date(),
      },
      update: {
        tpInsurer: dto.tpInsurer,
        tpPolicyNumber: dto.tpPolicyNumber,
        tpStartDate,
        tpExpiryDate,
        verificationStatus: SaodVerificationStatus.VERIFIED,
        verificationMethod: dto.verificationMethod,
        evidenceDocumentUrl: dto.evidenceDocumentUrl,
        verifierNotes: dto.verifierNotes,
        verifiedById: dto.verifiedById,
        verifiedAt: new Date(),
      },
    });

    // Record audit trail — this is compliance-critical
    await this.prisma.auditLog.create({
      data: {
        action: 'SAOD_TP_VERIFICATION_RECORDED',
        module: 'QUOTATIONS',
        entityId: dto.quotationId,
        entityType: 'QUOTATION',
        entity: 'QUOTATION',
        performedById: dto.verifiedById,
        metadata: {
          quotationId: dto.quotationId,
          tpInsurer: dto.tpInsurer,
          tpPolicyNumber: dto.tpPolicyNumber,
          tpStartDate: dto.tpStartDate,
          tpExpiryDate: dto.tpExpiryDate,
          verificationMethod: dto.verificationMethod,
          verificationStatus: 'VERIFIED',
          verifiedAt: new Date().toISOString(),
        } as any,
      },
    });

    this.logger.log(
      `SAOD TP verification recorded for quotation ${dto.quotationId} by user ${dto.verifiedById}`,
    );
    return verification;
  }
}
