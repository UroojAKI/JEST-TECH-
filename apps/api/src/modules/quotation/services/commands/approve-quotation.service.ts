import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { AuditAction, QuotationStatus, RoleType, DocumentVerificationStatus } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';

@Injectable()
export class ApproveQuotationService {
  constructor(
    private readonly quotationRepository: QuotationRepository,
    private readonly prisma: PrismaService,
  ) { }

  async execute(
    id: string,
    comments: string,
    approvedById: string,
    approverRole?: string,
  ) {
    const existing = await this.quotationRepository.findById(id);
    if (!existing || existing.deletedAt) {
      throw new NotFoundException(`Quotation with ID ${id} not found`);
    }

    if (
      existing.status !== QuotationStatus.PENDING_APPROVAL &&
      existing.status !== QuotationStatus.DRAFT &&
      existing.status !== QuotationStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        `Cannot approve quotation in status ${existing.status}. Must be DRAFT, PENDING_APPROVAL, or ACCEPTED.`,
      );
    }

    // ── Tiered Discount Authority Validation (EPIC-17) ──────────────────────
    const discountAmount = Number(existing.discountAmount || 0);
    const basePremium = Number(existing.basePremium || 0);
    const discountPercent =
      basePremium > 0 ? (discountAmount / basePremium) * 100 : 0;

    // Load configured limits from SystemConfig if present
    let standardLimit = 15;
    let absoluteLimit = 50;
    try {
      const stdConfig = await this.prisma.systemConfig.findFirst({
        where: { key: 'MOTOR_DISCOUNT_STANDARD_LIMIT' },
      });
      const absConfig = await this.prisma.systemConfig.findFirst({
        where: { key: 'MOTOR_DISCOUNT_ABSOLUTE_LIMIT' },
      });
      if (stdConfig) standardLimit = Number(stdConfig.value) || 15;
      if (absConfig) absoluteLimit = Number(absConfig.value) || 50;
    } catch {
      // Fallback to standard constants
    }

    if (discountPercent > absoluteLimit) {
      throw new BadRequestException(
        `Quotation discount (${discountPercent.toFixed(1)}%) exceeds absolute maximum limit of ${absoluteLimit}%. Cannot be approved.`,
      );
    }

    // Discounts > standardLimit require Branch Manager, Underwriter, or Admin
    if (discountPercent > standardLimit) {
      const allowedRoles: string[] = [RoleType.ADMIN, RoleType.BACK_OFFICE];
      if (approverRole && !allowedRoles.includes(approverRole)) {
        throw new ForbiddenException(
          `Discount of ${discountPercent.toFixed(1)}% exceeds standard threshold (${standardLimit}%). Requires Back Office or Administrator approval.`,
        );
      }
    }

    // ── Transactional Approval & Audit Log (EPIC-17) ─────────────────────────
    return this.prisma.$transaction(async (tx) => {
      const updated = await tx.quotation.update({
        where: { id },
        data: {
          status: QuotationStatus.APPROVED,
          workflowState: 'PROPOSAL_APPROVED',
          motorMetadata: existing.motorMetadata
            ? {
                ...(existing.motorMetadata as any),
                workflowStatus: 'PROPOSAL_APPROVED',
              }
            : undefined,
          updatedById: approvedById,
        },
      });

      // Auto-verify all attached quotation and health documents upon underwriter approval
      if (tx.document) {
        await tx.document.updateMany({
          where: {
            entityId: id,
            verificationStatus: { not: DocumentVerificationStatus.VERIFIED },
          },
          data: {
            verificationStatus: DocumentVerificationStatus.VERIFIED,
          },
        });
      }

      if ((existing as any).healthCaseId) {
        await tx.healthQuotationDocument.updateMany({
          where: {
            OR: [
              { quotationId: id },
              { caseId: (existing as any).healthCaseId },
            ],
            verificationStatus: { not: DocumentVerificationStatus.VERIFIED },
          },
          data: {
            verificationStatus: DocumentVerificationStatus.VERIFIED,
            verifiedById: approvedById,
            verifiedAt: new Date(),
          },
        });
      }

      await tx.quotationHistory.create({
        data: {
          quotationId: id,
          status: QuotationStatus.APPROVED,
          comments:
            comments ||
            `Quotation approved by ${approverRole || 'Manager'}. Discount applied: ${discountPercent.toFixed(1)}%`,
          createdById: approvedById,
        },
      });

      await tx.auditLog.create({
        data: {
          action: AuditAction.APPROVE,
          entity: 'QUOTATION',
          entityId: id,
          module: 'QUOTATIONS',
          userId: approvedById,
          performedById: approvedById,
          oldValue: { status: existing.status },
          newValue: { status: QuotationStatus.APPROVED },
        },
      });

      const finalQuotation = await tx.quotation.findFirst({
        where: { id },
        include: {
          contact: true,
          account: true,
          lead: true,
          versions: { orderBy: { versionNumber: 'desc' } },
          addons: true,
          discounts: true,
          histories: { orderBy: { createdAt: 'desc' } },
          documents: true,
        },
      });

      return QuotationMapper.toResponse(finalQuotation as any);
    });
  }
}
