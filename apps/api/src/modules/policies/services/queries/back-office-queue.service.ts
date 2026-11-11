import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
  InternalServerErrorException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import {
  QuotationStatus,
  InspectionStatus,
  DocumentVerificationStatus,
  Prisma,
  RoleType,
} from '@prisma/client';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';
import { HealthDocumentRuleService } from '../../../health-insurance/services/health-document-rule.service';

export interface GateStatus {
  passed: boolean;
  status: string;
  detail: string;
}

export interface BackOfficeQueueItem {
  id: string; // quotationId
  quotationCode: string;
  status: QuotationStatus;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  salesAgentName: string;
  productType: string;
  insurerName: string;
  totalPremium: number;
  paymentAmount: number;
  paymentReference?: string;
  createdAt: string;
  slaRemainingHours: number;
  slaStatus: 'CRITICAL' | 'WARNING' | 'ON_TRACK';
  gates: {
    customer: GateStatus;
    vehicle: GateStatus;
    inspection: GateStatus;
    payment: GateStatus;
    documents: GateStatus;
  };
  allGatesPassed: boolean;
  nextAction: string;
}

@Injectable()
export class BackOfficeQueueService {
  private readonly logger = new Logger(BackOfficeQueueService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Optional() private readonly healthDocumentRuleService?: HealthDocumentRuleService,
  ) {}

  /**
   * Retrieves the Back-Office Policy Issuance Queue with multi-gate validation (G021).
   *
   * SECURITY: actor (from JWT) is the authoritative source of companyId and branchId.
   * Client-supplied params NEVER override tenant scope.
   */
  async getBackOfficeQueue(
    actorOrParams?:
      | ActorContext
      | {
          search?: string;
          status?: string;
          quotationId?: string;
          page?: number;
          limit?: number;
          productType?: 'MOTOR' | 'HEALTH';
        },
    maybeParams?: {
      search?: string;
      status?: string;
      quotationId?: string;
      page?: number;
      limit?: number;
      productType?: 'MOTOR' | 'HEALTH';
    },
  ) {
    try {
      let actor: ActorContext | undefined;
      let params:
        | { search?: string; status?: string; quotationId?: string; page?: number; limit?: number; productType?: 'MOTOR' | 'HEALTH' }
        | undefined;

      if (
        actorOrParams &&
        ('companyId' in actorOrParams ||
          'userId' in actorOrParams ||
          'role' in actorOrParams)
      ) {
        actor = actorOrParams as ActorContext;
        params = maybeParams;
      } else {
        params = actorOrParams as
          | { search?: string; status?: string; quotationId?: string; page?: number; limit?: number; productType?: 'MOTOR' | 'HEALTH' }
          | undefined;
      }

      let statusFilter: QuotationStatus[] = [
        QuotationStatus.PENDING_APPROVAL,
        QuotationStatus.APPROVED,
        QuotationStatus.ACCEPTED,
        QuotationStatus.DRAFT,
      ];

      if (
        params?.status &&
        typeof params.status === 'string' &&
        !['READY', 'BLOCKED', 'ALL', 'INSPECTION_REQUIRED'].includes(
          params.status,
        )
      ) {
        const parts = params.status
          .split(',')
          .map((s) => s.trim() as QuotationStatus)
          .filter((s) => Object.values(QuotationStatus).includes(s));
        if (parts.length > 0) {
          statusFilter = parts;
        }
      }

      // Tenant scope: JWT actor is always the source of truth
      const isPlatformOrCompanyAdmin =
        actor?.role === RoleType.ADMIN ||
        actor?.role === ('SYSTEM_ADMINISTRATOR' as any) ||
        actor?.isPlatformAdmin;
      const isBackOffice = actor?.role === RoleType.BACK_OFFICE;

      const tenantFilter: Prisma.QuotationWhereInput = {
        ...(actor?.companyId ? { companyId: actor.companyId } : {}),
        // Only restrict to branch if user is an agent and has branchId assigned
        ...(!isPlatformOrCompanyAdmin && !isBackOffice && actor?.branchId
          ? {
              OR: [
                { createdBy: { branchId: actor.branchId } },
                { contact: { branchId: actor.branchId } },
              ],
            }
          : {}),
      };

      // A quotation is not a back-office work item merely because it exists or
      // has a draft/approval status. Sales must explicitly hand off the selected
      // quotation. This keeps alternative insurer quotes in the agent workspace.
      const where: Prisma.QuotationWhereInput = {
        ...tenantFilter,
        backOfficeSubmittedAt: { not: null },
        ...(params?.productType ? { productType: params.productType } : {}),
        ...(params?.quotationId
          ? { id: params.quotationId }
          : {
              OR: [
                { status: { in: statusFilter } },
                { issuanceStatus: 'ISSUANCE_PENDING' },
                { workflowState: 'PAYMENT_DONE' },
                { policy: { isNot: null } },
              ],
            }),
      };

      // Do not fall back to a broader, branch-unscoped query when the primary
      // query fails. A degraded response must never expose records outside the
      // actor's exact tenant/branch filter or silently omit gate relations.
      const quotations: any[] = await this.prisma.quotation.findMany({
        where,
        include: {
          contact: true,
          account: true,
          vehicle: true,
          createdBy: {
            select: { id: true, firstName: true, lastName: true, email: true },
          },
          policy: true,
          motorInspection: true,
          motorPaymentRecord: true,
          motorDocuments: true,
          healthDocuments: true,
          healthCase: { include: { documents: true } },
          motorPreviousPolicy: {
            include: {
              ruleEvaluation: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      // Optimize: batch-fetch all related documents in a single roundtrip rather than N+1 queries
      const quotationIds = quotations.map((q) => q.id);
      let allDocuments: any[] = [];
      if (quotationIds.length > 0 && this.prisma?.document?.findMany) {
        try {
          allDocuments = await this.prisma.document.findMany({
            where: {
              entityId: { in: quotationIds },
              deletedAt: null,
            },
          });
        } catch {
          allDocuments = [];
        }
      }
      const docsByQuoteId = new Map<string, any[]>();
      for (const doc of allDocuments) {
        const targetEntityId = doc.entityId || (quotationIds.length === 1 ? quotationIds[0] : null);
        if (targetEntityId) {
          const list = docsByQuoteId.get(targetEntityId) || [];
          list.push(doc);
          docsByQuoteId.set(targetEntityId, list);
        }
      }

      const now = Date.now();
      const items: BackOfficeQueueItem[] = [];
      let issuedCount = 0;

      for (const q of quotations) {
        // Exclude issued policies from pending work, but keep the issued
        // metric aligned with the active search and product filter.
        if (q.policy) {
          const query = String(params?.search || '').toLowerCase().trim();
          const issuedSearchFields = [
            q.quotationCode,
            q.contact?.firstName,
            q.contact?.lastName,
            q.contact?.phone,
            q.contact?.email,
            q.createdBy?.firstName,
            q.createdBy?.lastName,
            q.insurerName,
            q.registrationNumber,
            q.vehicle?.registrationNumber,
            (q.motorMetadata as any)?.registrationNumber,
          ].filter(Boolean).map((value) => String(value).toLowerCase());
          const matchesSearch = !query || issuedSearchFields.some((value) => value.includes(query));
          if (matchesSearch && (!params?.status || params.status === 'ALL')) issuedCount++;
          continue;
        }

        const isHealth = q.productType === 'HEALTH' || !!(q as any).healthCaseId;
        const isMotor = !isHealth && (q.productType === 'MOTOR' || (q as any).lineOfBusiness === 'MOTOR');

        // 1. Customer Gate (PAN details are optional for motor, mandatory for health)
        const hasCustomer = !!q.contact || !!(q as any).account;
        const hasContactDetails = !!(q.contact?.phone || q.contact?.email);
        const hasPan = Boolean(q.contact?.panNumber);
        const hasAadhaar = Boolean(q.contact?.aadhaarNumber);
        const isKycRejected = (q as any).account?.kycStatus === 'REJECTED';

        // For Health, policy issuance strictly requires both PAN and Aadhaar on file and KYC not rejected
        // For Motor, PAN details are optional in issuance as long as KYC is not rejected
        const hasKyc = isHealth
          ? hasPan && hasAadhaar && !isKycRejected
          : !isKycRejected;
        const customerPassed = hasCustomer && hasContactDetails && hasKyc;
        const customerGate: GateStatus = {
          passed: customerPassed,
          status: customerPassed ? 'PASSED' : 'BLOCKED',
          detail: !hasCustomer
            ? 'Missing customer details'
            : !hasContactDetails
              ? 'Missing customer contact phone/email'
              : isKycRejected
                ? 'Customer KYC has been rejected'
                : !hasKyc
                  ? (!hasPan && !hasAadhaar
                      ? 'Customer PAN and Aadhaar required for Health policy issuance'
                      : !hasPan
                        ? 'Customer PAN required for Health policy issuance'
                        : 'Customer Aadhaar required for Health policy issuance')
                  : isHealth
                    ? 'Customer KYC verified (PAN & Aadhaar on file)'
                    : 'Customer verified (PAN optional)',
        };

        // 2. Vehicle Integrity Gate (only applicable to MOTOR)
        let vehicleGate: GateStatus;
        if (!isMotor) {
          vehicleGate = {
            passed: true,
            status: 'PASSED',
            detail: 'Not applicable for Health insurance',
          };
        } else {
          const vehicleMetadata = (q.motorMetadata as Record<string, any>) || {};
          const regNumber =
            (q as any).registrationNumber ||
            vehicleMetadata.registrationNumber ||
            vehicleMetadata.vehicleNumber ||
            (q as any).vehicle?.registrationNumber;
          vehicleGate = {
            passed: !!regNumber,
            status: regNumber ? 'PASSED' : 'FAILED',
            detail: regNumber
              ? `Vehicle plate ${regNumber} valid`
              : 'Missing vehicle registration plate',
          };
        }

        // 3. Inspection Gate (only applicable to MOTOR)
        let inspectionGate: GateStatus;
        if (!isMotor) {
          inspectionGate = {
            passed: true,
            status: 'PASSED',
            detail: 'Not applicable for Health insurance',
          };
        } else {
          const vehicleMetadata = (q.motorMetadata as Record<string, any>) || {};
          const inspection = q.motorInspection;
          const isInspectionRequired = Boolean(
            q.motorPreviousPolicy?.ruleEvaluation?.inspectionRequired ||
              q.workflowState === 'INSPECTION_REQUIRED' ||
              vehicleMetadata?.inspectionRequired ||
              inspection,
          );
          let inspectionPassed = true;
          let inspectionDetail = 'Inspection waived / not required';

          if (isInspectionRequired) {
            if (inspection?.status === InspectionStatus.COMPLETED) {
              inspectionPassed = true;
              inspectionDetail = 'Break-in inspection approved';
            } else if (inspection?.status === InspectionStatus.WAIVED) {
              inspectionPassed = true;
              inspectionDetail = 'Break-in inspection waived';
            } else if (
              inspection?.status === InspectionStatus.SUBMITTED_FOR_REVIEW
            ) {
              inspectionPassed = true;
              inspectionDetail =
                'Break-in inspection submitted (approved on issuance)';
            } else {
              inspectionPassed = false;
              inspectionDetail = inspection
                ? `Inspection in ${inspection.status} status (requires approval)`
                : 'Break-in inspection required but not scheduled';
            }
          }

          inspectionGate = {
            passed: inspectionPassed,
            status: inspectionPassed ? 'PASSED' : 'BLOCKED',
            detail: inspectionDetail,
          };
        }

        // 4. Payment Gate (P1-09: Exact decimal reconciliation)
        const payment = q.motorPaymentRecord;
        const paidAmt = Number(payment?.amount || 0);
        const payableAmt = Number(q.totalPremium || 0);
        const hasOverpayment = paidAmt > payableAmt;
        const isExactMatch = payment?.status === 'PAID' && Math.abs(paidAmt - payableAmt) < 0.01;
        const isPaid = isExactMatch;

        const paymentGate: GateStatus = {
          passed: isPaid,
          status: isPaid ? 'PASSED' : 'BLOCKED',
          detail: isPaid
            ? `Full premium reconciled (₹${paidAmt.toLocaleString('en-IN')})`
            : hasOverpayment
              ? `Overpayment discrepancy: Received ₹${paidAmt}, expected ₹${payableAmt}`
              : payment
                ? `Payment status ${payment.status} (received ₹${paidAmt} of ₹${payableAmt})`
                : 'No payment recorded',
        };

        // 5. Document Verification Gate (G017 / P1-10)
        // Checked via pre-fetched batched documents
        const documents = docsByQuoteId.get(q.id) || [];

        const motorDocs = (q as any).motorDocuments || [];
        const healthDocs = (q as any).healthDocuments || [];
        const healthCase = (q as any).healthCase;
        const healthCaseDocs = healthCase?.documents || [];
        const allHealthDocs = Array.from(
          new Map(
            [...healthDocs, ...healthCaseDocs].map((doc: any) => [doc.id, doc]),
          ).values(),
        ) as any[];

        let documentsPassed = true;
        let documentsDetail = 'All mandatory documents verified';

        const unverified = [
          ...documents.filter(
            (d) => d.verificationStatus !== DocumentVerificationStatus.VERIFIED,
          ),
          ...motorDocs.filter(
            (d: any) => d.verificationStatus !== 'VERIFIED',
          ),
          ...allHealthDocs.filter(
            (d: any) => d.verificationStatus !== DocumentVerificationStatus.VERIFIED,
          ),
        ];

        // Health requirements are driven by the configured category and policy form.
        // A missing case/rule context fails closed instead of silently passing issuance.
        const missingRequiredHealthDocuments =
          isHealth && healthCase && this.healthDocumentRuleService
            ? this.healthDocumentRuleService
                .getRequirements(healthCase.planCategory, healthCase.policyForm, (healthCase.previousPolicySnapshot as any)?.renewalType)
                .filter(
                  (requirement) =>
                    requirement.required &&
                    !allHealthDocs.some(
                      (doc: any) =>
                        doc.documentType === requirement.documentType &&
                        doc.verificationStatus === DocumentVerificationStatus.VERIFIED,
                    ),
                )
                .map((requirement) => requirement.label)
            : isHealth
              ? ['Health document requirements could not be evaluated']
              : [];

        // Approval/acceptance of a quotation is not evidence that its supporting
        // documents were independently verified. Required documents must be present
        // and individually verified by a reviewer before policy issuance.
        if (missingRequiredHealthDocuments.length > 0) {
          documentsPassed = false;
          documentsDetail = `Required health documents not verified: ${missingRequiredHealthDocuments.join(', ')}`;
        } else if (unverified.length > 0) {
          documentsPassed = false;
          documentsDetail = `${unverified.length} document(s) pending underwriter verification`;
        } else if (isMotor && documents.length === 0 && motorDocs.length === 0 && (q.motorPreviousPolicy?.ruleEvaluation?.inspectionRequired || q.workflowState === 'INSPECTION_REQUIRED')) {
          documentsPassed = false;
          documentsDetail = 'Inspection/Break-in documents required';
        }

        const documentsGate: GateStatus = {
          passed: documentsPassed,
          status: documentsPassed ? 'PASSED' : 'BLOCKED',
          detail: documentsDetail,
        };

        // Multi-gate synthesis
        const allGatesPassed =
          customerGate.passed &&
          vehicleGate.passed &&
          inspectionGate.passed &&
          paymentGate.passed &&
          documentsGate.passed;

        let nextAction = 'Ready to Issue Policy';
        if (!paymentGate.passed) {
          nextAction = 'Awaiting Premium Payment Confirmation';
        } else if (isMotor && !inspectionGate.passed) {
          nextAction = 'Awaiting Vehicle Break-in Inspection Sign-Off';
        } else if (!documentsGate.passed) {
          nextAction = isMotor ? 'Awaiting Document KYC/RC Verification' : 'Awaiting Document Verification';
        } else if (!customerGate.passed) {
          nextAction = 'Awaiting Customer Identity Completion';
        }

        // SLA Countdown (IRDAI target 24h from quotation approval / payment)
        const quoteTime = new Date(q.updatedAt || q.createdAt).getTime();
        const elapsedHours = (now - quoteTime) / 3600000;
        const slaRemainingHours = Math.max(
          0,
          Math.round((24 - elapsedHours) * 10) / 10,
        );

        let slaStatus: 'CRITICAL' | 'WARNING' | 'ON_TRACK' = 'ON_TRACK';
        if (slaRemainingHours <= 4) {
          slaStatus = 'CRITICAL';
        } else if (slaRemainingHours <= 12) {
          slaStatus = 'WARNING';
        }

        const customerName = q.contact
          ? `${q.contact.firstName || ''} ${q.contact.lastName || ''}`.trim() ||
            (q.contact as any).companyName ||
            'Unknown Customer'
          : (q as any).account?.name || 'Unknown Customer';

        const salesAgentName = q.createdBy
          ? `${q.createdBy.firstName || ''} ${q.createdBy.lastName || ''}`.trim() ||
            q.createdBy.email
          : (q as any).agent?.user
            ? `${(q as any).agent.user.firstName || ''} ${(q as any).agent.user.lastName || ''}`.trim()
            : 'Direct Sales';

        const item: BackOfficeQueueItem = {
          id: q.id,
          quotationCode: q.quotationCode,
          status: q.status,
          customerName,
          customerPhone: q.contact?.phone || undefined,
          customerEmail: q.contact?.email || undefined,
          salesAgentName,
          productType: isHealth ? 'HEALTH' : (q.productType || 'MOTOR'),
          insurerName: q.insurerName || 'HDFC ERGO',
          totalPremium: payableAmt,
          paymentAmount: paidAmt,
          paymentReference: payment?.referenceNumber || undefined,
          createdAt: q.createdAt ? new Date(q.createdAt).toISOString() : new Date().toISOString(),
          slaRemainingHours,
          slaStatus,
          gates: {
            customer: customerGate,
            vehicle: vehicleGate,
            inspection: inspectionGate,
            payment: paymentGate,
            documents: documentsGate,
          },
          allGatesPassed,
          nextAction,
        };

        // Search filter
        if (params?.search && params.search.trim()) {
          const query = params.search.toLowerCase().trim();
          const matches =
            item.quotationCode.toLowerCase().includes(query) ||
            item.customerName.toLowerCase().includes(query) ||
            (item.customerPhone || '').toLowerCase().includes(query) ||
            (item.customerEmail || '').toLowerCase().includes(query) ||
            item.salesAgentName.toLowerCase().includes(query) ||
            item.insurerName.toLowerCase().includes(query) ||
            String(item.gates?.vehicle?.detail || '').toLowerCase().includes(query);
          if (!matches) continue;
        }

        // Status filter
        if (params?.status === 'READY' && !item.allGatesPassed) continue;
        if (params?.status === 'BLOCKED' && item.allGatesPassed) continue;
        if (
          params?.status === 'INSPECTION_REQUIRED' &&
          item.gates.inspection.passed
        )
          continue;

        items.push(item);
      }

      // Summary metrics are derived from the same fully filtered population
      // shown by the queue, before pagination is applied.
      const readyCount = items.filter((item) => item.allGatesPassed).length;
      const blockedCount = items.length - readyCount;
      const page = Math.max(1, Math.floor(Number(params?.page) || 1));
      const limit = Math.min(100, Math.max(1, Math.floor(Number(params?.limit) || 20)));
      const total = items.length;
      const totalPages = Math.ceil(total / limit);
      const data = items.slice((page - 1) * limit, page * limit);

      return {
        data,
        meta: { page, limit, total, totalPages },
        summary: {
          totalPending: total,
          readyCount,
          blockedCount,
          issuedCount,
        },
      };
    } catch (err: any) {
      this.logger.error(`Failed to get back-office queue: ${err?.message || err}`, err?.stack);
      throw new InternalServerErrorException(
        'Unable to load the Back Office issuance queue. Please retry or contact support with the request ID.',
      );
    }
  }

  /**
   * Validates all gates before policy issuance.
   * Throws BadRequestException detailing blockers if any gate fails.
   */
  async validateIssuanceGates(quotationId: string, actor?: ActorContext) {
    const queueResult = await this.getBackOfficeQueue(actor, { quotationId });
    const item = queueResult.data.find((q) => q.id === quotationId);

    if (!item) {
      throw new NotFoundException(
        `Quotation ${quotationId} not found or not eligible for issuance`,
      );
    }

    if (
      item.status !== QuotationStatus.APPROVED &&
      item.status !== QuotationStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        `Quotation ${quotationId} is in ${item.status} status. Policy issuance requires quotation to be in APPROVED or ACCEPTED status.`,
      );
    }

    if (!item.allGatesPassed) {
      const blockers: string[] = [];
      if (!item.gates.customer.passed)
        blockers.push(`Customer Gate: ${item.gates.customer.detail}`);
      if (item.productType === 'MOTOR' && !item.gates.vehicle.passed)
        blockers.push(`Vehicle Gate: ${item.gates.vehicle.detail}`);
      if (item.productType === 'MOTOR' && !item.gates.inspection.passed)
        blockers.push(`Inspection Gate: ${item.gates.inspection.detail}`);
      if (!item.gates.payment.passed)
        blockers.push(`Payment Gate: ${item.gates.payment.detail}`);
      if (!item.gates.documents.passed)
        blockers.push(`Documents Gate: ${item.gates.documents.detail}`);

      throw new BadRequestException(
        `Policy issuance blocked by gate validator: ${blockers.join(' | ')}`,
      );
    }

    return { allowed: true, quotationCode: item.quotationCode };
  }
}
