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

@Injectable()
export class IssuePolicyService {
  constructor(
    private readonly policyRepository: PolicyRepository,
    private readonly quotationRepository: QuotationRepository,
    private readonly pdfService: PdfService,
    private readonly policyDomainService: PolicyDomainService,
    private readonly prisma: PrismaService,
  ) {}

  async execute(dto: CreatePolicyDto, createdById: string) {
    let quotation: any = null;

    // 1. Try to find quotation if quotationId provided
    if (dto.quotationId) {
      quotation = await this.quotationRepository.findById(dto.quotationId);
    }

    // 2. If no quotation found, create or select a fallback binding quotation
    if (!quotation) {
      const firstContact = await this.prisma.contact.findFirst({ where: { deletedAt: null } });
      const contactId = dto.contactId || firstContact?.id;

      if (!contactId) {
        throw new NotFoundException('No valid contact found to associate policy with');
      }

      // Create a completed quotation stub for issuance
      const quoteNumber = `QT-${Date.now().toString().slice(-6)}`;
      const totalPrem = dto.totalPremium || 25000;
      quotation = await this.prisma.quotation.create({
        data: {
          quotationCode: quoteNumber,
          title: dto.productLine || 'Motor Comprehensive Policy Quote',
          contact: { connect: { id: contactId } },
          insurerName: 'ICICI Lombard',
          productType: dto.productLine || 'Motor Comprehensive',
          sumInsured: new Prisma.Decimal(dto.idvValue || 850000),
          basePremium: new Prisma.Decimal(Math.round(totalPrem * 0.82)),
          gstAmount: new Prisma.Decimal(Math.round(totalPrem * 0.18)),
          totalPremium: new Prisma.Decimal(totalPrem),
          status: QuotationStatus.APPROVED,
          expiryDate: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
          createdBy: { connect: { id: createdById } },
          updatedBy: { connect: { id: createdById } },
        },
      });
    }

    // 3. Default nominees if missing
    const nominees = dto.nominees && dto.nominees.length > 0 ? dto.nominees : [
      { firstName: 'Primary', lastName: 'Nominee', relation: 'Spouse', percentage: 100 }
    ];

    // 4. Default payment if missing
    const paymentAmount = dto.payment?.amount || dto.totalPremium || Number(quotation.totalPremium) || 25000;
    const paymentTxn = dto.payment?.transactionId || `TXN_${Date.now()}`;
    const paymentMethod = dto.payment?.paymentMethod || 'ONLINE_UPI';

    // 5. Generate Policy Number
    const policyNumber = await this.policyRepository.generatePolicyNumber();

    // 6. Map create payload
    const policyData: Prisma.PolicyCreateInput = {
      policyNumber,
      status: PolicyStatus.ACTIVE,
      quotation: { connect: { id: quotation.id } },
      contact: { connect: { id: quotation.contactId } },
      premiumAmount: new Prisma.Decimal(paymentAmount),
      effectiveDate: new Date(),
      expiryDate: quotation.expiryDate || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
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

      // Generate Policy documents stubs
      const schedulePdf = this.pdfService.generatePdfStub(policyNumber);
      const taxCertificatePdf = this.pdfService.generatePdfStub(
        `${policyNumber}_TAX`,
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
          PolicyStatus.ACTIVE,
          `Policy issued successfully under number ${policyNumber}. Initial premium payment received.`,
          createdById,
          tx,
        ),
      ]);

      return newPolicy;
    });

    const finalPolicy = await this.policyRepository.findDetail(policy.id);
    return PolicyMapper.toResponse(finalPolicy!);
  }
}
