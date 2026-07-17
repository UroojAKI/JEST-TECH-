import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, PolicyStatus, QuotationStatus, PaymentStatus } from '@prisma/client';

import { PolicyRepository } from '../../repositories/policy.repository';
import { PolicyMapper } from '../../mappers/policy.mapper';
import { CreatePolicyDto } from '../../dto/create-policy.dto';

import { QuotationRepository } from '../../../quotation/repositories/quotation.repository';
import { PdfService } from '../../../quotation/engine/pdf.service';
import { PolicyDomainService } from '../../domain/policy.domain-service';
import { Money } from '../../../../common/domain/value-objects/money.value-object';

@Injectable()
export class IssuePolicyService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly quotationRepository: QuotationRepository,
    private readonly pdfService: PdfService,
    private readonly policyDomainService: PolicyDomainService,
  ) {}

  async execute(dto: CreatePolicyDto, createdById: string) {
    // 1. Validate Quotation exists
    const quotation = await this.quotationRepository.findById(dto.quotationId);
    if (!quotation || quotation.deletedAt) {
      throw new NotFoundException(`Quotation with ID ${dto.quotationId} not found`);
    }

    // 2. Check if policy has already been issued for this quotation
    const existingPolicy = await this.policyRepository.findByQuotationId(dto.quotationId);

    // 3. Delegate to Domain Service for business rule validations
    this.policyDomainService.validateIssuance(quotation, dto.nominees, !!existingPolicy);

    // 5. Generate Policy Number
    const policyNumber = await this.policyRepository.generatePolicyNumber();

    // 6. Map create payload
    const policyData: Prisma.PolicyCreateInput = {
      policyNumber,
      status: PolicyStatus.ACTIVE,
      quotation: { connect: { id: dto.quotationId } },
      contact: { connect: { id: quotation.contactId } },
      premiumAmount: Money.from(quotation.totalPremium).value,
      effectiveDate: new Date(),
      expiryDate: quotation.expiryDate,
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
          amount: Money.from(dto.payment.amount).value,
          transactionId: dto.payment.transactionId,
          paymentMethod: dto.payment.paymentMethod,
          status: PaymentStatus.SUCCESS,
        },
      ],
    };

    // 7. Write to database & transition Quotation status
    const policy = await this.policyRepository.create(policyData);

    await this.quotationRepository.update(dto.quotationId, {
      status: QuotationStatus.CONVERTED_TO_POLICY,
    });

    // 8. Generate Policy documents stubs
    const schedulePdf = this.pdfService.generatePdfStub(policyNumber);
    const taxCertificatePdf = this.pdfService.generatePdfStub(`${policyNumber}_TAX`);

    await Promise.all([
      this.policyRepository.addDocument({
        policy: { connect: { id: policy.id } },
        documentType: 'POLICY_SCHEDULE',
        fileKey: schedulePdf.fileKey,
        fileName: schedulePdf.fileName,
        fileSize: schedulePdf.fileSize,
      }),

      this.policyRepository.addDocument({
        policy: { connect: { id: policy.id } },
        documentType: 'TAX_CERTIFICATE',
        fileKey: taxCertificatePdf.fileKey,
        fileName: taxCertificatePdf.fileName,
        fileSize: taxCertificatePdf.fileSize,
      }),

      this.policyRepository.addHistoryEntry(
        policy.id,
        PolicyStatus.ACTIVE,
        `Policy issued successfully under number ${policyNumber}. Initial premium payment received.`,
        createdById,
      ),
    ]);

    const finalPolicy = await this.policyRepository.findById(policy.id);
    return PolicyMapper.toResponse(finalPolicy!);
  }
}
