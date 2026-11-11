import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  Optional,
  InternalServerErrorException,
  HttpException,
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
import { EncryptionUtil } from '../../../../common/utils/encryption.util';

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

  // Extended Policy & Issuance Details
  policyType?: string;
  vehicleCategory?: string;
  policyTenure?: number;
  sumInsured?: number;
  basePremium?: number;
  gstAmount?: number;
  odPremium?: number;
  tpPremium?: number;
  addonPremium?: number;
  discountAmount?: number;
  ncbPercentage?: number;
  addons?: Array<{ addonCode: string; addonName: string; premium: number }>;
  workflowState?: string;
  issuanceStatus?: string;
  proposalStatus?: string;
  proposalNumber?: string;
  caseId?: string;
  caseCode?: string;
  calculationValid?: boolean;
  paymentMethod?: string;
  paymentStatus?: string;
  paidAt?: string;
  customerAddress?: string;
  customerCity?: string;
  customerState?: string;
  customerPincode?: string;
  customerDob?: string;
  panMasked?: string;
  aadhaarMasked?: string;
  kycStatus?: string;
  vehicleDetails?: {
    registrationNumber?: string;
    makeModel?: string;
    make?: string;
    model?: string;
    category?: string;
    fuelType?: string;
    rtoLocation?: string;
    manufactureYearMonth?: string;
    dateOfRegistration?: string;
    engineNumber?: string;
    chassisNumber?: string;
    status?: string;
  };
  previousPolicy?: {
    previousPolicyType?: string;
    previousInsurerName?: string;
    previousPolicyNumber?: string;
    policyExpiryDate?: string;
    activeTpInsurer?: string;
    activeTpPolicyNumber?: string;
    activeTpExpiryDate?: string;
  };
  healthDetails?: {
    planCategory?: string;
    policyForm?: string;
    planName?: string;
    memberCount?: number;
    members?: Array<{
      firstName: string;
      lastName?: string;
      relation: string;
      dateOfBirth?: string;
      gender?: string;
    }>;
    nomineeName?: string;
    nomineeRelation?: string;
    occupation?: string;
    preExistingDiseases?: string;
  };
  documents?: Array<{
    id: string;
    documentType: string;
    verificationStatus: string;
    fileName?: string;
    fileUrl?: string;
    createdAt?: string;
    source: string;
  }>;
  issuedPolicy?: {
    id: string;
    policyNumber: string;
    status: string;
    premiumAmount: number;
    effectiveDate?: string;
    expiryDate?: string;
    odStartDate?: string;
    odExpiryDate?: string;
    tpStartDate?: string;
    tpExpiryDate?: string;
    policyTenure?: number;
  };
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
          | { search?: string; status?: string; quotationId?: string }
          | undefined;
      }

      let statusFilter: QuotationStatus[] = [
        QuotationStatus.PENDING_APPROVAL,
        QuotationStatus.APPROVED,
        QuotationStatus.ACCEPTED,
        QuotationStatus.DRAFT,
      ];

      const requestedIssuedOnly = params?.status === 'ISSUED';

      if (
        params?.status &&
        typeof params.status === 'string' &&
        !['READY', 'BLOCKED', 'ALL', 'INSPECTION_REQUIRED', 'ISSUED'].includes(
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
      if (actor && !actor.companyId && !actor.isPlatformAdmin) {
        throw new BadRequestException('Company context is required to access the Back Office queue');
      }

      const tenantFilter: Prisma.QuotationWhereInput = {
        ...(actor?.companyId ? { companyId: actor.companyId } : {}),
        ...(!isPlatformOrCompanyAdmin && !isBackOffice && actor?.branchId
          ? {
              AND: [{
                OR: [
                  { createdBy: { branchId: actor.branchId } },
                  { contact: { branchId: actor.branchId } },
                ],
              }],
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
          : requestedIssuedOnly
            ? {
                OR: [
                  { policy: { isNot: null } },
                  { status: QuotationStatus.CONVERTED_TO_POLICY },
                ],
              }
            : {
                OR: [
                  { status: { in: statusFilter } },
                  { issuanceStatus: 'ISSUANCE_PENDING' },
                  { workflowState: 'PAYMENT_DONE' },
                  { policy: { isNot: null } },
                ],
              }),
      };

      const quotations: any[] = await this.prisma.quotation.findMany({
          where,

          include: {
            contact: {
              include: {
                customer: {
                  select: {
                    id: true,
                    addressLine1: true,
                    addressLine2: true,
                    city: true,
                    state: true,
                    pincode: true,
                  },
                },
              },
            },
            account: true,
            vehicle: true,
            case: { select: { id: true, caseCode: true, status: true } },
            proposal: { select: { id: true, status: true, proposalNumber: true } },
            addons: true,
            discounts: true,
            createdBy: {
              select: { id: true, firstName: true, lastName: true, email: true },
            },
            policy: true,
            motorInspection: true,
            motorPaymentRecord: true,
            motorDocuments: {
              include: {
                document: {
                  select: {
                    id: true,
                    name: true,
                    originalFileName: true,
                    storageKey: true,
                    size: true,
                  },
                },
              },
            },
            healthDocuments: true,
            healthCase: { include: { documents: true, members: true } },
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
      if (quotationIds.length > 0) {
        allDocuments = await this.prisma.document.findMany({
          where: {
            entityId: { in: quotationIds },
            deletedAt: null,
          },
        });
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
        // Track issued policies; only include them when explicitly querying status=ISSUED
        if (q.policy) {
          const searchTerm = String(params?.search || '').toLowerCase().trim();
          const issuedSearchFields = [
            q.quotationCode, q.contact?.firstName, q.contact?.lastName,
            q.contact?.phone, q.contact?.email, q.createdBy?.firstName,
            q.createdBy?.lastName, q.insurerName, q.registrationNumber,
            q.vehicle?.registrationNumber, (q.motorMetadata as any)?.registrationNumber,
          ].filter(Boolean).map((value) => String(value).toLowerCase());
          const matchesIssuedSearch = !searchTerm || issuedSearchFields.some((value) => value.includes(searchTerm));
          if (matchesIssuedSearch && (!params?.status || params.status === 'ALL' || requestedIssuedOnly)) issuedCount++;
          if (!requestedIssuedOnly) continue;
        } else if (requestedIssuedOnly) {
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
        if (q.policy) {
          nextAction = `Policy Issued (${q.policy.actualPolicyNumber || q.policy.policyNumber})`;
        } else if (!paymentGate.passed) {
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

        const pricingDetails = this.extractPricingDetails(q, isHealth);
        const customerDetails = this.extractCustomerAndKycDetails(q);
        const { vehicleDetails, previousPolicy } =
          this.extractVehicleAndPreviousPolicyDetails(q, isMotor);
        const healthDetails = this.extractHealthDetails(q, isHealth);
        const documentsSummary = this.extractDocumentsSummary(
          documents,
          motorDocs,
          allHealthDocs,
        );
        const issuedPolicy = this.extractIssuedPolicyDetails(q.policy);

        const item: BackOfficeQueueItem = {
          id: q.id,
          quotationCode: q.quotationCode,
          status: q.status,
          customerName,
          customerPhone: q.contact?.phone || undefined,
          customerEmail: q.contact?.email || undefined,
          salesAgentName,
          productType: isHealth ? 'HEALTH' : (q.productType || 'MOTOR'),
          insurerName: q.policy?.insurerNameSnapshot || q.insurerName?.trim() || 'Insurer not recorded',
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
          ...pricingDetails,
          ...customerDetails,
          workflowState: q.workflowState || undefined,
          issuanceStatus: q.issuanceStatus || undefined,
          proposalStatus: q.proposal?.status || undefined,
          proposalNumber: q.proposal?.proposalNumber || undefined,
          caseId: q.case?.id || q.caseId || q.healthCaseId || undefined,
          caseCode: q.case?.caseCode || healthCase?.caseCode || undefined,
          paymentMethod: payment?.paymentMethod || undefined,
          paymentStatus: payment?.status || undefined,
          paidAt: payment?.paidAt ? new Date(payment.paidAt).toISOString() : undefined,
          vehicleDetails,
          previousPolicy,
          healthDetails,
          documents: documentsSummary,
          issuedPolicy,
        };

        // Search filter
        if (params?.search && params.search.trim()) {
          const query = params.search.toLowerCase().trim();
          const searchableFields = [
            item.quotationCode,
            item.customerName,
            item.salesAgentName,
            item.customerPhone,
            item.customerEmail,
            item.insurerName,
            String(item.gates?.vehicle?.detail || ''),
            item.caseCode,
            item.vehicleDetails?.registrationNumber,
            item.vehicleDetails?.makeModel,
            item.issuedPolicy?.policyNumber,
          ];
          const matches = searchableFields.some(
            (val) => val && String(val).toLowerCase().includes(query),
          );
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
      if (err instanceof HttpException) throw err;
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

  private extractPricingDetails(q: any, isHealth: boolean) {
    const snap = (q.calculationSnapshot as Record<string, any>) || {};
    const snapOutputs = snap.outputs || {};
    const snapSummary = snapOutputs.summary || snap.summary || {};
    const motorMeta = (q.motorMetadata as Record<string, any>) || {};
    const healthMeta = (q.healthMetadata as Record<string, any>) || {};

    const policyType =
      q.policyType ||
      snap.inputs?.policyType ||
      motorMeta.policyType ||
      (isHealth ? q.healthPlanCategory || 'HEALTH' : undefined);
    const normalizedPolicyType = String(policyType || '').toUpperCase();
    const isThirdPartyOnly =
      normalizedPolicyType === 'TP_ONLY' ||
      normalizedPolicyType === 'THIRD_PARTY_ONLY';

    const sumInsured = Number(
      q.sumInsured ??
        snapOutputs.idv ??
        snap.inputs?.idv ??
        healthMeta.sumInsured ??
        0,
    );
    const basePremium = Number(
      q.basePremium ?? snapSummary.netPremium ?? snap.netPremium ?? 0,
    );
    const gstAmount = Number(
      q.gstAmount ?? snapSummary.gst ?? snapSummary.totalGst ?? snap.gstAmount ?? 0,
    );
    const totalPremium = Number(q.totalPremium ?? 0);
    const calculationValid = isHealth
      ? totalPremium > 0
      : (isThirdPartyOnly || sumInsured > 0) &&
        totalPremium > 0 &&
        q.calculationSnapshot !== null &&
        q.calculationSnapshot !== undefined;

    return {
      policyType,
      vehicleCategory:
        q.vehicleCategory ||
        q.vehicle?.category ||
        motorMeta.vehicleDetails?.category ||
        undefined,
      policyTenure: Number(q.policyTenure ?? q.policy?.policyTenure ?? 1),
      sumInsured,
      basePremium,
      gstAmount,
      odPremium: Number(
        snapOutputs.od?.net ??
          snapOutputs.odGrossPremium ??
          snap.gstBreakdown?.od?.base ??
          motorMeta.odPremium ??
          0,
      ),
      tpPremium: Number(
        snapOutputs.tp?.net ??
          snapOutputs.tpGrossPremium ??
          snap.gstBreakdown?.tp?.base ??
          motorMeta.tpPremium ??
          0,
      ),
      addonPremium: Number(
        snapOutputs.addonPremium ??
          snapOutputs.od?.addons ??
          snap.addonPremium ??
          0,
      ),
      discountAmount: Number(
        q.discountAmount ?? snapSummary.totalDiscount ?? snap.totalDiscount ?? 0,
      ),
      ncbPercentage: Number(
        q.ncbPercentage ??
          snap.inputs?.effectiveNcb ??
          motorMeta.ncbPercentage ??
          0,
      ),
      addons: Array.isArray(q.addons)
        ? q.addons.map((a: any) => ({
            addonCode: a.addonCode,
            addonName: a.addonName,
            premium: Number(a.premium || 0),
          }))
        : undefined,
      calculationValid,
    };
  }

  private extractCustomerAndKycDetails(q: any) {
    const motorProposer = (q.motorMetadata as any)?.proposerDetails || {};
    const healthCaseAddr = (q.healthCase as any)?.addressSnapshot || {};
    const healthCustomerSnap = (q.healthCase as any)?.customerSnapshot || {};
    const customerRecord = q.contact?.customer || (q as any).customer || {};

    const addressLine1 =
      motorProposer.address ||
      motorProposer.communicationAddress ||
      customerRecord.addressLine1 ||
      healthCaseAddr.addressLine1 ||
      healthCustomerSnap.address ||
      undefined;
    const customerCity =
      motorProposer.city || customerRecord.city || healthCaseAddr.city || undefined;
    const customerState =
      motorProposer.state || customerRecord.state || healthCaseAddr.state || undefined;
    const customerPincode =
      motorProposer.pincode ||
      motorProposer.pinCode ||
      customerRecord.pincode ||
      healthCaseAddr.pincode ||
      undefined;
    const customerAddress = [
      addressLine1,
      customerRecord.addressLine2,
      customerCity,
      customerState,
      customerPincode,
    ]
      .filter(Boolean)
      .join(', ');

    return {
      customerAddress: customerAddress || undefined,
      customerCity,
      customerState,
      customerPincode: customerPincode ? String(customerPincode) : undefined,
      customerDob: q.contact?.dateOfBirth
        ? new Date(q.contact.dateOfBirth).toISOString()
        : undefined,
      panMasked: q.contact?.panNumber
        ? EncryptionUtil.maskPan(q.contact.panNumber) || undefined
        : undefined,
      aadhaarMasked: q.contact?.aadhaarNumber
        ? EncryptionUtil.maskAadhaar(q.contact.aadhaarNumber) || undefined
        : undefined,
      kycStatus:
        q.account?.kycStatus ||
        (q.contact?.panNumber ? 'VERIFIED' : 'NOT_REQUIRED'),
    };
  }

  private extractVehicleAndPreviousPolicyDetails(q: any, isMotor: boolean) {
    if (!isMotor) {
      return { vehicleDetails: undefined, previousPolicy: undefined };
    }

    const motorMeta = (q.motorMetadata as Record<string, any>) || {};
    const metaVeh = motorMeta.vehicleDetails || {};
    const v = q.vehicle || {};

    const vehicleDetails = {
      registrationNumber:
        q.registrationNumber ||
        v.registrationNumber ||
        motorMeta.registrationNumber ||
        motorMeta.vehicleNumber ||
        undefined,
      makeModel:
        v.makeModel ||
        [v.make, v.model].filter(Boolean).join(' ') ||
        metaVeh.makeModel ||
        undefined,
      make: v.make || metaVeh.make || undefined,
      model: v.model || metaVeh.model || undefined,
      category: v.category || q.vehicleCategory || metaVeh.category || undefined,
      fuelType: v.fuelType || metaVeh.fuelType || undefined,
      rtoLocation: v.rtoLocation || metaVeh.rtoLocation || undefined,
      manufactureYearMonth:
        v.manufactureYearMonth || metaVeh.manufactureYearMonth || undefined,
      dateOfRegistration: v.dateOfRegistration
        ? new Date(v.dateOfRegistration).toISOString()
        : metaVeh.dateOfRegistration || undefined,
      engineNumber: v.engineNumber || metaVeh.engineNumber || undefined,
      chassisNumber: v.chassisNumber || metaVeh.chassisNumber || undefined,
      status: v.status || metaVeh.vehicleStatus || undefined,
    };

    const prevRecord = q.motorPreviousPolicy;
    const prevMeta = motorMeta.previousPolicyDetails || {};
    const hasPrev = Boolean(
      prevRecord ||
        prevMeta.previousPolicyType ||
        prevMeta.previousPolicyNumber ||
        q.activeTpPolicyNumber,
    );

    const previousPolicy = hasPrev
      ? {
          previousPolicyType:
            prevRecord?.previousPolicyType ||
            prevMeta.previousPolicyType ||
            undefined,
          previousInsurerName:
            prevRecord?.previousInsurerName ||
            prevMeta.previousInsurerName ||
            undefined,
          previousPolicyNumber:
            prevRecord?.previousPolicyNumber ||
            prevMeta.previousPolicyNumber ||
            undefined,
          policyExpiryDate: prevRecord?.policyExpiryDate
            ? new Date(prevRecord.policyExpiryDate).toISOString()
            : prevMeta.policyExpiryDate || undefined,
          activeTpInsurer: q.activeTpInsurer || undefined,
          activeTpPolicyNumber: q.activeTpPolicyNumber || undefined,
          activeTpExpiryDate: q.activeTpExpiryDate
            ? new Date(q.activeTpExpiryDate).toISOString()
            : undefined,
        }
      : undefined;

    return { vehicleDetails, previousPolicy };
  }

  private extractHealthDetails(q: any, isHealth: boolean) {
    if (!isHealth) return undefined;

    const healthCase = q.healthCase || {};
    const healthMeta = (q.healthMetadata as Record<string, any>) || {};
    const planDetails = (healthCase.planDetails as Record<string, any>) || {};
    const members = Array.isArray(healthCase.members) ? healthCase.members : [];

    return {
      planCategory:
        healthCase.planCategory || q.healthPlanCategory || healthMeta.planCategory || undefined,
      policyForm: healthCase.policyForm || healthMeta.policyForm || undefined,
      planName:
        healthMeta.planName || planDetails.planName || q.title || undefined,
      memberCount: members.length || Number(healthMeta.memberCount || 1),
      members: members.map((m: any) => ({
        firstName: m.firstName,
        lastName: m.lastName || undefined,
        relation: m.relation,
        dateOfBirth: m.dateOfBirth
          ? new Date(m.dateOfBirth).toISOString()
          : undefined,
        gender: m.gender || undefined,
      })),
      nomineeName: healthCase.nomineeName || healthMeta.nomineeName || undefined,
      nomineeRelation:
        healthCase.nomineeRelation || healthMeta.nomineeRelation || undefined,
      occupation: healthCase.occupation || undefined,
      preExistingDiseases:
        members
          .map((m: any) => m.preExistingDiseases)
          .filter(Boolean)
          .join('; ') || undefined,
    };
  }

  private extractDocumentsSummary(
    documents: any[],
    motorDocs: any[],
    allHealthDocs: any[],
  ) {
    const unified = [
      ...(documents || []).map((d: any) => ({
        id: d.id,
        documentType: d.documentType || d.category || 'DOCUMENT',
        verificationStatus: d.verificationStatus || 'PENDING',
        fileName: d.fileName || d.originalFileName || d.name || undefined,
        fileUrl: d.storageKey || d.fileUrl || undefined,
        createdAt: d.createdAt ? new Date(d.createdAt).toISOString() : undefined,
        source: 'DOCUMENT',
      })),
      ...(motorDocs || []).map((md: any) => ({
        id: md.id,
        documentType: md.documentType || 'MOTOR_DOCUMENT',
        verificationStatus: md.verificationStatus || 'PENDING',
        fileName:
          md.document?.originalFileName ||
          md.document?.name ||
          md.document?.fileName ||
          undefined,
        fileUrl: md.document?.storageKey || undefined,
        createdAt: md.createdAt ? new Date(md.createdAt).toISOString() : undefined,
        source: 'MOTOR',
      })),
      ...(allHealthDocs || []).map((hd: any) => ({
        id: hd.id,
        documentType: hd.documentType || 'HEALTH_DOCUMENT',
        verificationStatus: hd.verificationStatus || 'PENDING',
        fileName:
          hd.fileName ||
          hd.originalFileName ||
          hd.name ||
          hd.document?.originalFileName ||
          undefined,
        fileUrl: hd.fileUrl || hd.storageKey || undefined,
        createdAt: hd.createdAt ? new Date(hd.createdAt).toISOString() : undefined,
        source: 'HEALTH',
      })),
    ];

    return unified;
  }

  private extractIssuedPolicyDetails(policy: any) {
    if (!policy) return undefined;
    return {
      id: policy.id,
      policyNumber: policy.actualPolicyNumber || policy.policyNumber,
      status: policy.status,
      premiumAmount: Number(policy.actualPremium ?? policy.premiumAmount ?? 0),
      effectiveDate: policy.effectiveDate
        ? new Date(policy.effectiveDate).toISOString()
        : undefined,
      expiryDate: policy.expiryDate
        ? new Date(policy.expiryDate).toISOString()
        : undefined,
      odStartDate: policy.odStartDate
        ? new Date(policy.odStartDate).toISOString()
        : undefined,
      odExpiryDate: policy.odExpiryDate
        ? new Date(policy.odExpiryDate).toISOString()
        : undefined,
      tpStartDate: policy.tpStartDate
        ? new Date(policy.tpStartDate).toISOString()
        : undefined,
      tpExpiryDate: policy.tpExpiryDate
        ? new Date(policy.tpExpiryDate).toISOString()
        : undefined,
      policyTenure: policy.policyTenure ?? 1,
    };
  }
}
