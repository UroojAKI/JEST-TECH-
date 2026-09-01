import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Prisma,
  PolicyStatus,
  QuotationStatus,
  PaymentStatus,
} from '@prisma/client';

import { PolicyRepository } from '../../repositories/policy.repository';
import { PolicyMapper } from '../../mappers/policy.mapper';
import { CreatePolicyDto } from '../../dto/create-policy.dto';

import { QuotationRepository } from '../../../quotation/repositories/quotation.repository';
import { PdfService } from '../../../quotation/engine/pdf.service';
import { PolicyDomainService } from '../../domain/policy.domain-service';
import { Money } from '../../../../common/domain/value-objects/money.value-object';
import { PrismaService } from '../../../../database/prisma.service';
import { CACHE_PROVIDER_TOKEN } from '../../../platform/cache/cache.provider';
import { RedisCacheService } from '../../../platform/cache/redis-cache.service';
import { OutboxService } from '../../../platform/outbox/outbox.service';
import { Inject } from '@nestjs/common';

import { BackOfficeQueueService } from '../queries/back-office-queue.service';

@Injectable()
export class IssuePolicyService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly quotationRepository: QuotationRepository,
    private readonly pdfService: PdfService,
    private readonly policyDomainService: PolicyDomainService,
    private readonly prisma: PrismaService,
    private readonly outboxService: OutboxService,
    private readonly backOfficeQueueService: BackOfficeQueueService,
    @Inject(CACHE_PROVIDER_TOKEN) private readonly cache: RedisCacheService,
  ) {}

  async execute(dto: CreatePolicyDto, createdById: string) {
    if (!dto.quotationId) {
      throw new BadRequestException(
        'Authoritative quotationId is mandatory for policy issuance. Direct manual policy issuance without a quotation is forbidden.',
      );
    }

    // Defense-in-Depth: Always enforce authoritative gates regardless of caller
    await this.backOfficeQueueService.validateIssuanceGates(dto.quotationId);

    // Concurrency / duplicate guard: Check if policy already exists for this quotation
    const existingPolicy = await this.prisma.policy.findUnique({
      where: { quotationId: dto.quotationId },
    });
    if (existingPolicy) {
      throw new ConflictException(
        `Policy already issued for quotation ${dto.quotationId} (Policy Number: ${existingPolicy.policyNumber}). Duplicate issuance is blocked.`,
      );
    }

    // 1. Fetch authoritative quotation
    const quotation = await this.quotationRepository.findById(dto.quotationId);
    if (!quotation) {
      throw new NotFoundException(
        `Quotation with ID ${dto.quotationId} not found. Cannot issue policy.`,
      );
    }

    // 2. Validate quotation status & validity period
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

    // 3. Verify authoritative payment reconciliation (no manufactured payments)
    const paymentRecord = await this.prisma.motorPaymentRecord.findUnique({
      where: { quotationId: quotation.id },
    });

    const authoritativePayable = new Prisma.Decimal(quotation.totalPremium);
    let paymentAmount = authoritativePayable;
    let paymentTxn = `TXN_${quotation.quotationCode}`;
    let paymentMethod = 'ONLINE_UPI';
    const decimalTolerance = new Prisma.Decimal('0.01');

    if (paymentRecord && paymentRecord.status === 'PAID') {
      const recAmount = new Prisma.Decimal(paymentRecord.amount || 0);
      if (recAmount.sub(authoritativePayable).abs().greaterThan(decimalTolerance)) {
        throw new BadRequestException(
          `Payment reconciliation mismatch: Recorded ₹${recAmount.toString()} vs authoritative payable ₹${authoritativePayable.toString()}. Exact match required.`,
        );
      }
      paymentAmount = recAmount;
      paymentTxn = paymentRecord.referenceNumber || paymentTxn;
      paymentMethod = paymentRecord.paymentMethod || paymentMethod;
    } else if (dto.payment?.transactionId && dto.payment?.amount) {
      const received = new Prisma.Decimal(dto.payment.amount);
      if (received.sub(authoritativePayable).abs().greaterThan(decimalTolerance)) {
        throw new BadRequestException(
          `Payment reconciliation failure: Received ₹${received.toString()} but authoritative payable is ₹${authoritativePayable.toString()}. Exact match required.`,
        );
      }
      paymentAmount = received;
      paymentTxn = dto.payment.transactionId;
      paymentMethod = dto.payment.paymentMethod || paymentMethod;
    } else {
      throw new BadRequestException(
        'Cannot issue policy without authoritative reconciled payment (PAID status required). Manufacture of unverified payment is blocked.',
      );
    }

    // 4. Default nominees if missing
    const nominees =
      dto.nominees && dto.nominees.length > 0
        ? dto.nominees
        : [
            {
              firstName: 'Primary',
              lastName: 'Nominee',
              relation: 'Spouse',
              percentage: 100,
            },
          ];

    // 5. Generate Policy Number via authoritative sequence and derive coverage dates
    const policyNumber = await this.policyRepository.generatePolicyNumber();

    const quoteEffective = (quotation as any).policyStartDate ? new Date((quotation as any).policyStartDate) : null;
    const effectiveDate = dto.effectiveDate ? new Date(dto.effectiveDate) : (quoteEffective || new Date());

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (effectiveDate < todayStart) {
      throw new BadRequestException(
        `Backdated policy issuance is strictly forbidden. Effective date (${effectiveDate.toISOString().slice(0, 10)}) cannot be earlier than today.`,
      );
    }

    const tenureYears = quotation.policyTenure || 1;
    const calculatedExpiry = new Date(effectiveDate);
    calculatedExpiry.setFullYear(calculatedExpiry.getFullYear() + tenureYears);

    const quoteExpiry = (quotation as any).policyEndDate ? new Date((quotation as any).policyEndDate) : null;
    const expiryDate = dto.expiryDate ? new Date(dto.expiryDate) : (quoteExpiry || calculatedExpiry);

    if (expiryDate <= effectiveDate) {
      throw new BadRequestException(
        `Policy expiryDate (${expiryDate.toISOString().slice(0, 10)}) must be strictly greater than effectiveDate (${effectiveDate.toISOString().slice(0, 10)}).`,
      );
    }

    const isAlreadyEffective = effectiveDate <= new Date();

    // 6. Map create payload
    const policyData: Prisma.PolicyCreateInput = {
      policyNumber,
      status: isAlreadyEffective ? PolicyStatus.ACTIVE : PolicyStatus.ISSUED,
      quotation: { connect: { id: quotation.id } },
      contact: { connect: { id: quotation.contactId } },
      premiumAmount: paymentAmount,
      effectiveDate,
      expiryDate,
      createdBy: { connect: { id: createdById } },
      updatedBy: { connect: { id: createdById } },
    };

    if (quotation.accountId) {
      policyData.account = { connect: { id: quotation.accountId } };
    }

    if (dto.members && dto.members.length > 0) {
      policyData.members = {
        create: dto.members.map((m) => ({
          firstName: m.firstName,
          lastName: m.lastName,
          relation: m.relation,
          dateOfBirth: new Date(m.dateOfBirth),
        })),
      };
    }

    policyData.nominees = {
      create: nominees.map((n) => ({
        firstName: n.firstName,
        lastName: n.lastName,
        relation: n.relation,
        percentage: new Prisma.Decimal(n.percentage),
      })),
    };

    policyData.payments = {
      create: [
        {
          amount: new Prisma.Decimal(paymentAmount),
          transactionId: paymentTxn,
          paymentMethod: paymentMethod,
          status: PaymentStatus.SUCCESS,
        },
      ],
    };

    // 7. Execute in transaction
    const policy = await this.prisma.$transaction(async (tx) => {
      // Re-verify inside transaction to catch concurrent race conditions atomically
      const atomicCheck = await tx.policy.findUnique({
        where: { quotationId: quotation.id },
      });
      if (atomicCheck) {
        throw new ConflictException(
          `Concurrent conflict: Policy already issued for quotation ${quotation.id} (Policy Number: ${atomicCheck.policyNumber}).`,
        );
      }

      // Create Policy
      const newPolicy = await this.policyRepository.create(policyData, tx);

      // Transition Quotation status
      await this.quotationRepository.update(
        quotation.id,
        {
          status: QuotationStatus.CONVERTED_TO_POLICY,
        },
        tx,
      );

      // Generate genuine signed policy documents with authoritative metadata
      const insuredName = quotation.contact
        ? `${quotation.contact.firstName || ''} ${quotation.contact.lastName || ''}`.trim()
        : 'Insured Customer';
      const vehicleDetails = (quotation as any).vehicle;
      const chassis = vehicleDetails?.chassisNumber || (quotation as any).chassisNumber || 'CHASSIS-PENDING';
      const engine = vehicleDetails?.engineNumber || (quotation as any).engineNumber || 'ENGINE-PENDING';
      const regNumber = quotation.registrationNumber || vehicleDetails?.registrationNumber || 'REG-PENDING';

      const schedulePdf = await this.pdfService.generateDocumentPdf(
        'Policy Schedule',
        policyNumber,
        {
          'Policy Number': policyNumber,
          'Quotation Code': quotation.quotationCode,
          'Insured Name': insuredName,
          'Vehicle Registration': regNumber,
          'Chassis Number': chassis,
          'Engine Number': engine,
          'Insurer': quotation.insurerName,
          'Coverage Period': `${effectiveDate.toISOString().slice(0, 10)} to ${expiryDate.toISOString().slice(0, 10)}`,
          'Insured Amount (IDV)': `Rs. ${(quotation.sumInsured ?? 0).toString()}`,
          'Net Customer Premium': `Rs. ${(quotation.basePremium ?? 0).toString()}`,
          'Total GST': `Rs. ${(quotation.gstAmount ?? 0).toString()}`,
          'Total Premium Paid': `Rs. ${policyData.premiumAmount.toString()}`,
          'Payment Transaction': paymentTxn,
        },
      );

      const taxCertificatePdf = await this.pdfService.generateDocumentPdf(
        'Tax Exemption / GST Certificate',
        `${policyNumber}_TAX`,
        {
          'Policy Number': policyNumber,
          'GST Amount': `Rs. ${(quotation.gstAmount ?? 0).toString()}`,
          'Tax Component': 'Statutory 18% GST on Gross Base Premium',
          'Invoice Date': new Date().toISOString().slice(0, 10),
        },
      );

      await Promise.all([
        this.policyRepository.addDocument(
          {
            policy: { connect: { id: newPolicy.id } },
            documentType: 'POLICY_SCHEDULE',
            fileKey: schedulePdf.fileKey,
            fileName: schedulePdf.fileName,
            fileSize: schedulePdf.fileSize,
          },
          tx,
        ),

        this.policyRepository.addDocument(
          {
            policy: { connect: { id: newPolicy.id } },
            documentType: 'TAX_CERTIFICATE',
            fileKey: taxCertificatePdf.fileKey,
            fileName: taxCertificatePdf.fileName,
            fileSize: taxCertificatePdf.fileSize,
          },
          tx,
        ),

        this.policyRepository.addHistoryEntry(
          newPolicy.id,
          newPolicy.status,
          `Policy issued successfully under number ${policyNumber}. Initial premium payment received.`,
          createdById,
          tx,
        ),
      ]);

      // 8. Record Insurer Policy Details if external reference supplied
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

      // 9. Transactional Outbox Event
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

    const finalPolicy = await this.policyRepository.findDetail(policy.id);
    return PolicyMapper.toResponse(finalPolicy!);
  }
}
