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

    await this.backOfficeQueueService.validateIssuanceGates(dto.quotationId);

    const existingPolicy = await this.prisma.policy.findUnique({
      where: { quotationId: dto.quotationId },
    });
    if (existingPolicy) {
      throw new ConflictException(
        `Policy already issued for quotation ${dto.quotationId} (Policy Number: ${existingPolicy.policyNumber}). Duplicate issuance is blocked.`,
      );
    }

    const quotation = await this.quotationRepository.findById(dto.quotationId);
    if (!quotation) {
      throw new NotFoundException(`Quotation with ID ${dto.quotationId} not found. Cannot issue policy.`);
    }

    if (quotation.status !== QuotationStatus.APPROVED && quotation.status !== QuotationStatus.ACCEPTED) {
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
      throw new BadRequestException('Verified payment is missing its transaction/reference number.');
    }
    if (paymentAmount.sub(authoritativePayable).abs().greaterThan(new Prisma.Decimal('0.01'))) {
      throw new BadRequestException(
        `Payment reconciliation mismatch: Recorded ₹${paymentAmount.toString()} vs authoritative payable ₹${authoritativePayable.toString()}. Exact match required.`,
      );
    }

    // Nominees are business data, not presentation defaults. Missing nominees block issuance.
    if (!dto.nominees || dto.nominees.length === 0) {
      throw new BadRequestException('At least one nominee is required before policy issuance.');
    }
    const nomineePercentage = dto.nominees.reduce((sum, nominee) => sum + Number(nominee.percentage || 0), 0);
    if (Math.abs(nomineePercentage - 100) > 0.001) {
      throw new BadRequestException(`Nominee allocation must total exactly 100%. Current total: ${nomineePercentage}%.`);
    }

    const policyNumber = await this.policyRepository.generatePolicyNumber();

    const quoteEffective = (quotation as any).policyStartDate ? new Date((quotation as any).policyStartDate) : null;
    const quoteExpiry = (quotation as any).policyEndDate ? new Date((quotation as any).policyEndDate) : null;
    const effectiveDate = quoteEffective || (dto.effectiveDate ? new Date(dto.effectiveDate) : new Date());
    const expiryDate = quoteExpiry || (dto.expiryDate ? new Date(dto.expiryDate) : null);

    if (!expiryDate) {
      throw new BadRequestException('Authoritative quotation expiry date is required before policy issuance.');
    }

    if (quoteEffective && dto.effectiveDate && new Date(dto.effectiveDate).getTime() !== quoteEffective.getTime()) {
      throw new BadRequestException('Policy effective date must match the accepted quotation snapshot.');
    }
    if (quoteExpiry && dto.expiryDate && new Date(dto.expiryDate).getTime() !== quoteExpiry.getTime()) {
      throw new BadRequestException('Policy expiry date must match the accepted quotation snapshot.');
    }

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    if (effectiveDate < todayStart) {
      throw new BadRequestException(
        `Backdated policy issuance is strictly forbidden. Effective date (${effectiveDate.toISOString().slice(0, 10)}) cannot be earlier than today.`,
      );
    }
    if (expiryDate <= effectiveDate) {
      throw new BadRequestException(
        `Policy expiryDate (${expiryDate.toISOString().slice(0, 10)}) must be strictly greater than effectiveDate (${effectiveDate.toISOString().slice(0, 10)}).`,
      );
    }

    // Issued documents must never contain fabricated chassis/engine/registration values.
    const vehicleDetails = (quotation as any).vehicle;
    const chassis = vehicleDetails?.chassisNumber || (quotation as any).chassisNumber;
    const engine = vehicleDetails?.engineNumber || (quotation as any).engineNumber;
    const regNumber = quotation.registrationNumber || vehicleDetails?.registrationNumber;
    if (!chassis || !engine || !regNumber) {
      throw new BadRequestException(
        'Policy issuance is blocked until authoritative chassis number, engine number, and registration number are present. No placeholder values may be issued.',
      );
    }

    const policyData: Prisma.PolicyCreateInput = {
      policyNumber,
      status: effectiveDate <= new Date() ? PolicyStatus.ACTIVE : PolicyStatus.ISSUED,
      quotation: { connect: { id: quotation.id } },
      contact: { connect: { id: quotation.contactId } },
      premiumAmount: paymentAmount,
      effectiveDate,
      expiryDate,
      createdBy: { connect: { id: createdById } },
      updatedBy: { connect: { id: createdById } },
    };

    if (quotation.accountId) policyData.account = { connect: { id: quotation.accountId } };

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
      const atomicCheck = await tx.policy.findUnique({ where: { quotationId: quotation.id } });
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

      const insuredName = quotation.contact
        ? `${quotation.contact.firstName || ''} ${quotation.contact.lastName || ''}`.trim()
        : 'Insured Customer';

      const schedulePdf = await this.pdfService.generateDocumentPdf('Policy Schedule', policyNumber, {
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
        'Total Premium Paid': `Rs. ${paymentAmount.toString()}`,
        'Payment Transaction': paymentRecord.referenceNumber,
      });

      const taxCertificatePdf = await this.pdfService.generateDocumentPdf('Tax Exemption / GST Certificate', `${policyNumber}_TAX`, {
        'Policy Number': policyNumber,
        'GST Amount': `Rs. ${(quotation.gstAmount ?? 0).toString()}`,
        'Tax Component': 'Statutory 18% GST on Gross Base Premium',
        'Invoice Date': new Date().toISOString().slice(0, 10),
      });

      await Promise.all([
        this.policyRepository.addDocument({
          policy: { connect: { id: newPolicy.id } },
          documentType: 'POLICY_SCHEDULE',
          fileKey: schedulePdf.fileKey,
          fileName: schedulePdf.fileName,
          fileSize: schedulePdf.fileSize,
        }, tx),
        this.policyRepository.addDocument({
          policy: { connect: { id: newPolicy.id } },
          documentType: 'TAX_CERTIFICATE',
          fileKey: taxCertificatePdf.fileKey,
          fileName: taxCertificatePdf.fileName,
          fileSize: taxCertificatePdf.fileSize,
        }, tx),
        this.policyRepository.addHistoryEntry(
          newPolicy.id,
          newPolicy.status,
          `Policy issued successfully under number ${policyNumber}. Verified payment ${paymentRecord.referenceNumber} reconciled to the quotation snapshot.`,
          createdById,
          tx,
        ),
      ]);

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

    const finalPolicy = await this.policyRepository.findDetail(policy.id);
    return PolicyMapper.toResponse(finalPolicy!);
  }
}
