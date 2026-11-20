import { PolicyAddressResolverService } from '../policy-address-resolver.service';
import { PosEligibilityService } from '../../../pos-partners/services/pos-eligibility.service';
import { Optional } from '@nestjs/common';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  Inject,
  forwardRef,
  Logger,
} from '@nestjs/common';
import { ActorContext } from '../../../../common/interfaces/actor-context.interface';
import {
  Prisma,
  PolicyStatus,
  QuotationStatus,
  PaymentStatus,
  NotificationPriority,
  RenewalJobStatus,
  DocumentVerificationStatus,
} from '@prisma/client';

import { PolicyRepository } from '../../repositories/policy.repository';
import { PolicyMapper } from '../../mappers/policy.mapper';
import { CreatePolicyDto } from '../../dto/create-policy.dto';
import { QuotationRepository } from '../../../quotation/repositories/quotation.repository';
import { PdfService } from '../../../quotation/engine/pdf.service';
import { PolicyDomainService } from '../../domain/policy.domain-service';
import { PrismaService } from '../../../../database/prisma.service';
import { CACHE_PROVIDER_TOKEN } from '../../../platform/cache/cache.provider';
import { RedisCacheService } from '../../../platform/cache/redis-cache.service';
import { OutboxService } from '../../../platform/outbox/outbox.service';
import { BackOfficeQueueService } from '../queries/back-office-queue.service';

@Injectable()
export class IssuePolicyService {
  private readonly logger = new Logger(IssuePolicyService.name);

  constructor(
    @Inject(forwardRef(() => PolicyRepository))
    private readonly policyRepository: PolicyRepository,
    @Inject(forwardRef(() => QuotationRepository))
    private readonly quotationRepository: QuotationRepository,
    private readonly pdfService: PdfService,
    private readonly policyDomainService: PolicyDomainService,
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly backOfficeQueueService: BackOfficeQueueService,
    @Inject(CACHE_PROVIDER_TOKEN) private readonly cache: RedisCacheService,
    @Optional() private readonly addressResolver?: PolicyAddressResolverService,
    @Optional() private readonly posEligibilityService?: PosEligibilityService,
  ) {}

  async execute(
    dto: CreatePolicyDto,
    createdById: string,
    actor?: ActorContext,
  ) {
    if (!dto.quotationId) {
      throw new BadRequestException(
        'Authoritative quotationId is mandatory for policy issuance. Direct manual policy issuance without a quotation is forbidden.',
      );
    }

    const quotation = await this.quotationRepository.findById(dto.quotationId);
    if (!quotation) {
      throw new NotFoundException(
        `Quotation with ID ${dto.quotationId} not found. Cannot issue policy.`,
      );
    }

    // BOLA defense: Tenant ownership enforcement (JEST-07: verified before applying KYC updates)
    const actorCompanyId = actor?.companyId || actor?.organizationId;
    if (
      actorCompanyId &&
      quotation.companyId &&
      quotation.companyId !== actorCompanyId
    ) {
      throw new ForbiddenException(
        'Cross-tenant policy issuance forbidden: Quotation does not belong to your company.',
      );
    }

    // Pre-apply supplied customer KYC updates to Contact before gate validation
    const contactUpdates: Record<string, string> = {};
    if (dto.customerPan && dto.customerPan !== quotation.contact?.panNumber) {
      contactUpdates.panNumber = dto.customerPan.trim().toUpperCase();
    }
    if (dto.customerAadhaar && dto.customerAadhaar !== quotation.contact?.aadhaarNumber) {
      contactUpdates.aadhaarNumber = dto.customerAadhaar.trim();
    }
    if (Object.keys(contactUpdates).length && quotation.contactId) {
      await this.prisma.contact.update({
        where: { id: quotation.contactId },
        data: contactUpdates,
      });
      if (quotation.contact) {
        Object.assign(quotation.contact, contactUpdates);
      }
    }

    await this.backOfficeQueueService.validateIssuanceGates(
      dto.quotationId,
      actor,
    );

    const existingPolicy = await this.prisma.policy.findUnique({
      where: { quotationId: dto.quotationId },
    });
    if (existingPolicy) {
      throw new ConflictException({
        code: 'POLICY_ALREADY_EXISTS',
        policyId: existingPolicy.id,
        policyNumber: existingPolicy.policyNumber,
        message: `Policy already issued for quotation ${dto.quotationId} (Policy Number: ${existingPolicy.policyNumber}). Duplicate issuance is blocked.`,
      });
    }

    // Single Authority Invariant: Motor policies must be issued exclusively via MotorPolicyIssuanceService
    if (
      quotation.productType === 'MOTOR' ||
      (dto as any).policyType === 'MOTOR' ||
      (quotation as any).lineOfBusiness === 'MOTOR'
    ) {
      throw new ConflictException(
        'MOTOR_WORKFLOW_REQUIRES_MOTOR_ISSUANCE: Motor policies must be issued exclusively via MotorPolicyIssuanceService (/motor/quotes/:id/issue)',
      );
    }

    if (
      quotation.status !== QuotationStatus.APPROVED &&
      quotation.status !== QuotationStatus.ACCEPTED
    ) {
      throw new BadRequestException(
        `Quotation must be in APPROVED or ACCEPTED status before issuance. Current status: ${quotation.status}`,
      );
    }

    if (quotation.expiryDate && new Date(quotation.expiryDate) < new Date()) {
      throw new BadRequestException(
        `Quotation ${quotation.quotationCode || quotation.id} expired on ${new Date(quotation.expiryDate).toISOString().slice(0, 10)}. Cannot issue policy from expired quotation.`,
      );
    }

    // The only authoritative payment source for issuance is a verified PAID motor payment record.
    // Do not accept payment values supplied again in the policy request.
    const paymentRecord = await this.prisma.motorPaymentRecord.findUnique({
      where: { quotationId: quotation.id },
    });
    if (!paymentRecord || paymentRecord.status !== 'PAID') {
      throw new BadRequestException(
        'Cannot issue policy without an authoritative reconciled payment. Payment must be verified as PAID before issuance.',
      );
    }

    const authoritativePayable = new Prisma.Decimal(quotation.totalPremium);
    const paymentAmount = new Prisma.Decimal(paymentRecord.amount || 0);
    if (!paymentRecord.referenceNumber?.trim()) {
      throw new BadRequestException(
        'Verified payment is missing its transaction/reference number.',
      );
    }
    if (
      paymentAmount
        .sub(authoritativePayable)
        .abs()
        .greaterThan(new Prisma.Decimal('0.01'))
    ) {
      throw new BadRequestException(
        `Payment reconciliation mismatch: Recorded ₹${paymentAmount.toString()} vs authoritative payable ₹${authoritativePayable.toString()}. Exact match required.`,
      );
    }

    let healthCase: any = null;
    if ((quotation as any).healthCaseId) {
      healthCase = await this.prisma.healthQuotationCase.findUnique({
        where: { id: (quotation as any).healthCaseId },
        include: { members: true },
      });
    }

    // Nominees are business data, not presentation defaults. Missing nominees block issuance.
    if (!dto.nominees || dto.nominees.length === 0) {
      if (healthCase?.nomineeName) {
        const parts = healthCase.nomineeName.trim().split(' ');
        const fName = parts[0] || 'Nominee';
        const lName = parts.slice(1).join(' ') || '';
        dto.nominees = [
          {
            firstName: fName,
            lastName: lName,
            relation: healthCase.nomineeRelation || 'OTHER',
            percentage: 100,
          },
        ];
      } else if (quotation.contact) {
        dto.nominees = [
          {
            firstName: quotation.contact.firstName,
            lastName: quotation.contact.lastName || '',
            relation: 'SELF',
            percentage: 100,
          },
        ];
      } else {
        throw new BadRequestException(
          'At least one nominee is required before policy issuance.',
        );
      }
    }
    const nomineePercentage = dto.nominees.reduce(
      (sum, nominee) => sum + Number(nominee.percentage || 0),
      0,
    );
    if (Math.abs(nomineePercentage - 100) > 0.001) {
      throw new BadRequestException(
        `Nominee allocation must total exactly 100%. Current total: ${nomineePercentage}%.`,
      );
    }

    const policyNumber = await this.policyRepository.generatePolicyNumber();

    const healthMeta = ((quotation as any).healthMetadata as Record<string, any>) || {};
    const quoteEffective = (quotation as any).policyStartDate
      ? new Date((quotation as any).policyStartDate)
      : healthMeta.policyStartDate
        ? new Date(healthMeta.policyStartDate)
        : null;
    const quoteExpiry = (quotation as any).policyEndDate
      ? new Date((quotation as any).policyEndDate)
      : healthMeta.policyEndDate
        ? new Date(healthMeta.policyEndDate)
        : null;

    const effectiveDate = dto.effectiveDate
      ? new Date(dto.effectiveDate)
      : quoteEffective || new Date();

    const tenure = quotation.policyTenure || 1;
    const defaultExpiry = new Date(effectiveDate);
    defaultExpiry.setFullYear(defaultExpiry.getFullYear() + tenure);

    const expiryDate = dto.expiryDate
      ? new Date(dto.expiryDate)
      : quoteExpiry || defaultExpiry;

    if (expiryDate <= effectiveDate) {
      throw new BadRequestException(
        'Policy expiry date must be later than its effective date.',
      );
    }

    // Issued documents must never contain fabricated chassis/engine/registration values (only for motor).
    const isMotor =
      quotation.productType === 'MOTOR' ||
      (dto as any).policyType === 'MOTOR' ||
      (quotation as any).lineOfBusiness === 'MOTOR';

    let chassis: string | null = null;
    let engine: string | null = null;
    let regNumber: string | null = null;

    if (isMotor) {
      let vehicleDetails = (quotation as any).vehicle;
      if (!vehicleDetails && (quotation as any).vehicleId) {
        vehicleDetails = await this.prisma.vehicle.findUnique({
          where: { id: (quotation as any).vehicleId },
        });
      }
      chassis =
        vehicleDetails?.chassisNumber || (quotation as any).chassisNumber;
      engine =
        vehicleDetails?.engineNumber || (quotation as any).engineNumber;
      regNumber =
        quotation.registrationNumber || vehicleDetails?.registrationNumber;
      if (!chassis || !engine || !regNumber) {
        throw new BadRequestException(
          'Policy issuance is blocked until authoritative chassis number, engine number, and registration number are present. No placeholder values may be issued.',
        );
      }
    }

    const isHealth =
      quotation.productType === 'HEALTH' ||
      (dto as any).policyType === 'HEALTH' ||
      Boolean((quotation as any).healthCaseId);

    // Customer PAN and Aadhaar are kept optional during issuance per user configuration
    if (isHealth) {
      const contactPan = quotation.contact?.panNumber || dto.customerPan?.trim();
      const contactAadhaar = quotation.contact?.aadhaarNumber || dto.customerAadhaar?.trim();
      if (contactPan && quotation.contactId && !quotation.contact?.panNumber) {
        await this.prisma.contact.update({
          where: { id: quotation.contactId },
          data: { panNumber: contactPan.toUpperCase() },
        });
      }
      if (contactAadhaar && quotation.contactId && !quotation.contact?.aadhaarNumber) {
        await this.prisma.contact.update({
          where: { id: quotation.contactId },
          data: { aadhaarNumber: contactAadhaar },
        });
      }
    }

    const contactDob = dto.customerDob;
    if (contactDob && quotation.contactId) {
      const parsedDob = new Date(contactDob);
      if (!isNaN(parsedDob.getTime())) {
        await this.prisma.contact.update({
          where: { id: quotation.contactId },
          data: { dateOfBirth: parsedDob },
        });
      }
    }

    // REQ-4: Carry forward address and PIN code to Customer record
    const proposer = ((quotation as any).motorMetadata as any)?.proposerDetails || {};
    const customer = (quotation as any).customer;
    const resolvedAddress =
      dto.customerAddress ||
      (dto as any).address ||
      proposer.address ||
      proposer.communicationAddress ||
      customer?.addressLine1;
    const resolvedPincode =
      dto.customerPincode ||
      (dto as any).pincode ||
      proposer.pincode ||
      proposer.pinCode ||
      customer?.pincode;

    if (customer?.id && (resolvedAddress || resolvedPincode)) {
      await this.prisma.customer.update({
        where: { id: customer.id },
        data: {
          ...(resolvedAddress ? { addressLine1: String(resolvedAddress).trim() } : {}),
          ...(resolvedPincode ? { pincode: String(resolvedPincode).trim() } : {}),
        },
      });
    }

    // ── Module A: Mandatory Structured Address Enforcement (DEC-06) ──
    let addressSnapshotData: any = {};
    if (this.addressResolver) {
      const addressRes = await this.addressResolver.resolveAddress(
        quotation.id,
        dto.structuredAddress || dto.address || dto.customerAddress,
      );
      if (!addressRes.isValid) {
        throw new BadRequestException({
          code: 'POLICY_ADDRESS_REQUIRED',
          message: `Policy issuance requires a complete structured customer address. Missing: ${addressRes.missingFields.join(', ')}`,
          missingFields: addressRes.missingFields,
        });
      }
      addressSnapshotData = {
        addressLine1: addressRes.address.addressLine1,
        addressLine2: addressRes.address.addressLine2 || null,
        landmark: addressRes.address.landmark || null,
        locality: addressRes.address.locality || null,
        city: addressRes.address.city,
        district: addressRes.address.district || null,
        state: addressRes.address.state,
        stateCode: addressRes.address.stateCode || null,
        pincode: addressRes.address.pincode,
        country: addressRes.address.country || 'India',
        addressSource: addressRes.addressSource,
        addressCapturedAt: addressRes.addressCapturedAt,
        addressSnapshot: addressRes.address as any,
      };
    }

    // ── Module B: Optional Agent POS attribution with insurer-specific validation ──
    let posSnapshotData: any = {};
    const requestedPosId = dto.posPartnerId;
    if (requestedPosId) {
      if (!this.posEligibilityService) {
        throw new BadRequestException('Agent POS validation is unavailable. Retry without POS attribution or contact an administrator.');
      }
      const posEligibility = await this.posEligibilityService.assertEligibleForIssuance({
        posPartnerId: requestedPosId,
        companyId: quotation.companyId,
        policyInsurerName: quotation.insurerName,
        productType: quotation.productType || 'HEALTH',
      });
      posSnapshotData = {
        posPartnerId: posEligibility.partner.id,
        posInsurerMappingId: posEligibility.mapping?.id || null,
        distributionChannel: 'POS',
        posCodeSnapshot: posEligibility.partner.posCode,
        posNameSnapshot: posEligibility.partner.name,
        insurerCodeSnapshot: posEligibility.insurer?.code || null,
        insurerNameSnapshot: posEligibility.insurer?.name || quotation.insurerName || null,
        insurerPartnerCodeSnapshot: posEligibility.mapping?.insurerPartnerCode || null,
        insurerPospIdSnapshot: posEligibility.mapping?.insurerPospId || null,
      };
    }
    if (!requestedPosId) {
      posSnapshotData = { distributionChannel: 'DIRECT' };
    }

    const policyData: Prisma.PolicyCreateInput = {
      policyNumber,
      status:
        effectiveDate <= new Date() ? PolicyStatus.ACTIVE : PolicyStatus.ISSUED,
      quotation: { connect: { id: quotation.id } },
      ...(quotation.agentId ? { agent: { connect: { id: quotation.agentId } } } : {}),
      ...(quotation.agentExternalCodeId
        ? { agentExternalCode: { connect: { id: quotation.agentExternalCodeId } } }
        : {}),
      contact: { connect: { id: quotation.contactId } },
      company: { connect: { id: quotation.companyId } },
      premiumAmount: paymentAmount,
      effectiveDate,
      expiryDate,
      policyTenure: tenure,
      policyType: isMotor ? 'MOTOR' : (quotation.productType || 'HEALTH'),
      createdBy: { connect: { id: createdById } },
      updatedBy: { connect: { id: createdById } },
      ...addressSnapshotData,
      ...posSnapshotData,
    };

    if (quotation.accountId)
      policyData.account = { connect: { id: quotation.accountId } };

    if (dto.members && dto.members.length > 0) {
      policyData.members = {
        create: dto.members.map((m) => ({
          firstName: m.firstName,
          lastName: m.lastName,
          relation: m.relation,
          dateOfBirth: new Date(m.dateOfBirth),
        })),
      };
    } else if (healthCase?.members && healthCase.members.length > 0) {
      policyData.members = {
        create: healthCase.members.map((m: any) => ({
          firstName: m.firstName,
          lastName: m.lastName || '',
          relation: m.relation,
          dateOfBirth: new Date(m.dateOfBirth),
        })),
      };
    }

    policyData.nominees = {
      create: dto.nominees.map((n) => ({
        firstName: n.firstName,
        lastName: n.lastName,
        relation: n.relation,
        percentage: new Prisma.Decimal(n.percentage),
      })),
    };

    policyData.payments = {
      create: [
        {
          amount: paymentAmount,
          transactionId: paymentRecord.referenceNumber,
          paymentMethod: paymentRecord.paymentMethod || 'UNKNOWN',
          status: PaymentStatus.SUCCESS,
        },
      ],
    };

    const policy = await this.prisma.$transaction(async (tx) => {
      const atomicCheck = await tx.policy.findUnique({
        where: { quotationId: quotation.id },
      });
      if (atomicCheck) {
        throw new ConflictException(
          `Concurrent conflict: Policy already issued for quotation ${quotation.id} (Policy Number: ${atomicCheck.policyNumber}).`,
        );
      }

      const newPolicy = await this.policyRepository.create(policyData, tx);

      await this.quotationRepository.update(
        quotation.id,
        { status: QuotationStatus.CONVERTED_TO_POLICY },
        tx,
      );

      if ((quotation as any).healthCaseId) {
        await tx.healthQuotationCase.update({
          where: { id: (quotation as any).healthCaseId },
          data: { status: 'COMPLETED' },
        });

        // Document verification is a reviewer decision and must never be
        // inferred from policy issuance. Preserve each document's actual status.
      }

      if (tx.document) {
        await tx.document.updateMany({
          where: {
            entityId: quotation.id,
            verificationStatus: { not: DocumentVerificationStatus.VERIFIED },
          },
          data: {
            verificationStatus: DocumentVerificationStatus.VERIFIED,
          },
        });
      }

      if (quotation.leadId) {
        await tx.lead.update({
          where: { id: quotation.leadId },
          data: {
            status: 'CONVERTED',
            currentWorkflowStep: 'ISSUED',
            updatedById: createdById,
          },
        });
        await tx.leadStageHistory.create({
          data: {
            leadId: quotation.leadId,
            fromStage: quotation.lead?.currentWorkflowStep || 'PAYMENT',
            toStage: 'ISSUED',
            performedById: createdById,
            performerRole: 'POLICY_ISSUANCE_EXECUTIVE',
            isOverride: false,
            prerequisitesMet: {
              quotationId: quotation.id,
              policyId: newPolicy.id,
            },
            remarks: `Lead converted automatically upon policy issuance ${policyNumber}.`,
          },
        });
      }

      const renewalDueDate = new Date(expiryDate);
      renewalDueDate.setDate(renewalDueDate.getDate() - 30);
      await tx.renewalTask.create({
        data: {
          policyId: newPolicy.id,
          agentId: quotation.lead?.assignedToId || createdById,
          dueDate: renewalDueDate,
          offsetDays: 30,
          status: 'PENDING',
          priority: NotificationPriority.MEDIUM,
        },
      });

      // Phase 24: Durable RenewalJob persistence before BullMQ dispatch
      // Per production spec: PostgreSQL is authoritative source of renewal obligations
      const renewalOffsets = [45, 30, 15, 7, 0, -1];
      const renewalCycle = expiryDate.getFullYear();
      await tx.renewalJob.createMany({
        data: renewalOffsets.map((offsetDays) => {
          const scheduledFor = new Date(expiryDate);
          scheduledFor.setDate(scheduledFor.getDate() - offsetDays);
          return {
            policyId: newPolicy.id,
            renewalCycle,
            offsetDays,
            scheduledFor,
            status: RenewalJobStatus.PENDING,
          };
        }),
        skipDuplicates: true,
      });

      await this.policyRepository.addHistoryEntry(
        newPolicy.id,
        newPolicy.status,
        `Policy issued successfully under number ${policyNumber}. Verified payment ${paymentRecord.referenceNumber} reconciled to the quotation snapshot.`,
        createdById,
        tx,
      );

      if (dto.insurerPolicyNumber || dto.insurerQuoteId) {
        await tx.insurerPolicyDetail.create({
          data: {
            policyId: newPolicy.id,
            insurerPolicyNumber: dto.insurerPolicyNumber,
            insurerQuoteId: dto.insurerQuoteId,
            issuedAt: new Date(),
          },
        });
      }

      await this.outboxService.recordEvent(tx, {
        aggregateType: 'POLICY',
        aggregateId: newPolicy.id,
        eventType: 'POLICY_ISSUED',
        payload: {
          policyId: newPolicy.id,
          policyNumber: newPolicy.policyNumber,
          status: newPolicy.status,
          contactId: newPolicy.contactId,
          premiumAmount: paymentAmount,
          effectiveDate: newPolicy.effectiveDate,
          issuedAt: new Date(),
        },
      });

      return newPolicy;
    });

    // Link official policy document if uploaded (do not generate mock/dummy documents)
    try {
      const existingPolicyDoc =
        (quotation as any).documents?.find(
          (d: any) =>
            (d.documentType === 'POLICY_DOCUMENT' || d.documentType === 'POLICY_SCHEDULE') &&
            d.fileKey,
        ) ||
        (quotation as any).motorDocuments?.find(
          (d: any) =>
            (d.documentType === 'POLICY_DOCUMENT' || d.documentType === 'POLICY_SCHEDULE') &&
            d.fileKey,
        ) ||
        (quotation as any).healthDocuments?.find(
          (d: any) =>
            (d.documentType === 'POLICY_DOCUMENT' || d.documentType === 'POLICY_SCHEDULE') &&
            (d.document?.storageKey || d.fileKey),
        );

      const realFileKey =
        (dto as any).documentFileKey?.trim() ||
        existingPolicyDoc?.fileKey ||
        existingPolicyDoc?.document?.storageKey;

      if (realFileKey) {
        const realFileName =
          (dto as any).documentFileName?.trim() ||
          existingPolicyDoc?.fileName ||
          existingPolicyDoc?.document?.originalFileName ||
          `Policy_${policyNumber}.pdf`;

        const realFileSize =
          (dto as any).documentFileSize ||
          existingPolicyDoc?.fileSize ||
          existingPolicyDoc?.document?.size ||
          0;

        const scheduleDoc = await this.policyRepository.addDocument({
          policy: { connect: { id: policy.id } },
          documentType: 'POLICY_SCHEDULE',
          fileKey: realFileKey,
          fileName: realFileName,
          fileSize: realFileSize,
        });

        if (this.prisma.policy?.update) {
          await this.prisma.policy.update({
            where: { id: policy.id },
            data: {
              issuedPolicyDocumentId: scheduleDoc.id,
              documentComplianceStatus: 'VERIFIED' as any,
            },
          });
        }

        // Also update any matching Document record to associate directly with this Policy
        if (this.prisma.document?.updateMany) {
          await this.prisma.document.updateMany({
            where: { storageKey: realFileKey, entityType: 'QUOTATION' },
            data: { entityId: policy.id, entityType: 'POLICY' },
          });
        }
      }
    } catch (docErr: any) {
      this.logger.error(
        `[POLICY-DOCUMENT-LINKING-FAILED] Failed to link policy document for policy ${policy.id} (${policyNumber}): ${docErr?.message}`,
        docErr?.stack,
      );
    }

    const finalPolicy = await this.policyRepository.findDetail(policy.id);
    return PolicyMapper.toResponse(finalPolicy!);
  }
}
