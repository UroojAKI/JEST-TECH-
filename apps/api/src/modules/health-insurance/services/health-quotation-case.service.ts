import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  HealthCaseStatus,
  HealthPlanCategory,
  HealthPolicyForm,
  InsuredRelation,
  Prisma,
  QuotationStatus,
  RoleType,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { TenantResourceAuthorizationService } from '../../auth/services/tenant-resource-authorization.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { RequestUser } from '../../auth/decorators/current-user.decorator';
import { AddHealthQuoteDto, CreateHealthQuotationCaseDto, RecordHealthPaymentDto } from '../dto/health-quotation-case.dto';
import { HealthPremiumService } from './health-premium.service';
import { HealthPlanValidationService } from './health-plan-validation.service';

/** Free-look period, Policy Form (i) field 12: 15 days (30 for electronic / distance marketing). */
const FREE_LOOK_DAYS = 15;
const QUOTE_VALIDITY_DAYS = 30;
/** The proposer (relation SELF) signs the proposal, so must be an adult. */
const PROPOSER_MIN_AGE = 18;

const caseInclude = {
  contact: { select: { id: true, contactCode: true, firstName: true, lastName: true, phone: true, email: true } },
  lead: { select: { id: true, leadCode: true, title: true } },
  members: { orderBy: { createdAt: 'asc' as const } },
  quotations: {
    include: {
      motorPaymentRecord: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
  selectedQuote: {
    include: {
      motorPaymentRecord: true,
    },
  },
  documents: true,
};

@Injectable()
export class HealthQuotationCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAuthService: TenantResourceAuthorizationService,
    private readonly numberingEngine: NumberingEngineService,
    private readonly premiumService: HealthPremiumService,
    private readonly planValidation: HealthPlanValidationService,
  ) {}
  async createCase(dto: CreateHealthQuotationCaseDto, user: RequestUser) {
    let contact: any;
    try {
      contact = await this.tenantAuthService.assertTenantResource<any>('Contact', dto.contactId, user);
    } catch (err) {
      // Check if dto.contactId was a customerId
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.contactId, companyId: user.companyId },
        include: { contact: true },
      });
      if (customer) {
        if (customer.contact) {
          contact = customer.contact;
          dto.contactId = customer.contact.id;
        } else {
          const contactCount = await this.prisma.contact.count({ where: { companyId: user.companyId } });
          contact = await this.prisma.contact.create({
            data: {
              contactCode: `CONT-${String(contactCount + 1).padStart(6, '0')}`,
              companyId: user.companyId,
              firstName: customer.firstName.trim(),
              lastName: (customer.lastName || '').trim(),
              phone: customer.mobile,
              email: customer.email,
              panNumber: customer.panNumber,
              aadhaarNumber: customer.aadhaarNumber,
              type: 'INDIVIDUAL',
              status: 'ACTIVE',
              createdById: user.id,
              updatedById: user.id,
            },
          });
          await this.prisma.customer.update({ where: { id: customer.id }, data: { contactId: contact.id } });
          dto.contactId = contact.id;
        }
      } else {
        throw err;
      }
    }
    if (dto.leadId) {
      await this.tenantAuthService.assertTenantResource('Lead', dto.leadId, user);
    }

    this.validateCategoryRules(dto);
    const planDetails = this.planValidation.validatePlanDetails(dto.planCategory, dto.planDetails, dto.members);
    const previousPolicy = this.planValidation.validateRenewal(dto.policyForm, dto.previousPolicySnapshot);

    // Common fields 9, 11, 12: email, PAN and Aadhaar are mandatory for Health.
    const kyc = {
      email: contact.email || dto.proposerKyc?.email,
      panNumber: contact.panNumber || dto.proposerKyc?.panNumber,
      aadhaarNumber: contact.aadhaarNumber || dto.proposerKyc?.aadhaarNumber,
    };
    const missingKyc = Object.entries(kyc)
      .filter(([, value]) => !value)
      .map(([field]) => field);
    if (missingKyc.length) {
      throw new BadRequestException(
        `Proposer KYC incomplete: ${missingKyc.join(', ')} required for Health. Provide them in proposerKyc.`,
      );
    }

    const contactUpdates = Object.fromEntries(
      Object.entries(kyc).filter(([field]) => !contact[field]),
    );
    if (Object.keys(contactUpdates).length) {
      // Stored on Contact the same way the Contacts module stores them (masked on read).
      await this.prisma.contact.update({ where: { id: contact.id }, data: contactUpdates });
    }

    const caseCode = await this.numberingEngine.generateNext('HEALTH_CASE');

    // The snapshot never holds raw PAN / Aadhaar, only whether they are on file.
    const customerSnapshot = {
      contactCode: contact.contactCode,
      firstName: contact.firstName,
      lastName: contact.lastName,
      phone: contact.phone,
      email: kyc.email,
      gender: contact.gender ?? null,
      dateOfBirth: contact.dateOfBirth ?? null,
      hasPan: true,
      hasAadhaar: true,
    };

    return this.prisma.healthQuotationCase.create({
      data: {
        companyId: user.companyId,
        caseCode,
        planCategory: dto.planCategory,
        policyForm: dto.policyForm,
        contactId: dto.contactId,
        leadId: dto.leadId ?? null,
        occupation: dto.occupation,
        annualIncome: dto.annualIncome ?? null,
        addressSnapshot: { ...dto.address },
        nomineeName: dto.nomineeName,
        nomineeRelation: dto.nomineeRelation,
        planDetails,
        previousPolicySnapshot: previousPolicy ?? undefined,
        customerSnapshot,
        createdById: user.id,
        members: {
          create: dto.members.map((m) => ({
            familyMemberId: m.familyMemberId ?? null,
            firstName: m.firstName,
            lastName: m.lastName ?? null,
            relation: m.relation,
            dateOfBirth: new Date(m.dateOfBirth),
            gender: m.gender,
            heightCm: m.heightCm,
            weightKg: m.weightKg,
            preExistingDiseases: m.preExistingDiseases,
            isSmoker: m.isSmoker,
          })),
        },
      },
      include: caseInclude,
    });
  }

  async getCase(caseId: string, user: RequestUser) {
    const healthCase = await this.prisma.healthQuotationCase.findFirst({
      where: { id: caseId, companyId: user.companyId },
      include: caseInclude,
    });
    if (!healthCase) {
      throw new NotFoundException(`HealthQuotationCase '${caseId}' not found or access denied`);
    }
    return healthCase;
  }

  async getCasesForLead(leadId: string, user: RequestUser) {
    await this.tenantAuthService.assertTenantResource('Lead', leadId, user);
    return this.prisma.healthQuotationCase.findMany({
      where: { leadId, companyId: user.companyId },
      include: caseInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  async getAllCases(user: RequestUser) {
    return this.prisma.healthQuotationCase.findMany({
      where: { companyId: user.companyId },
      include: caseInclude,
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Adds one insurer quote to the case. Many quotes per case are allowed
   * ("give option to add multiple quotes for 1 Health proposal").
   */
  async addQuote(caseId: string, dto: AddHealthQuoteDto, user: RequestUser) {
    const healthCase = await this.getCase(caseId, user);

    if (healthCase.status !== HealthCaseStatus.OPEN && healthCase.status !== HealthCaseStatus.QUOTED) {
      throw new BadRequestException(`Quotes cannot be added to a case in '${healthCase.status}' status`);
    }
    if (healthCase.policyForm === HealthPolicyForm.NEW_POLICY && !dto.waitingPeriod) {
      throw new BadRequestException('waitingPeriod is required for New Policy quotes');
    }

    const riders = dto.riders ?? [];
    if (healthCase.policyForm === HealthPolicyForm.RENEWAL_PORTABILITY && riders.length) {
      throw new BadRequestException('Renewal / Portability quotes do not carry riders (Policy Form ii)');
    }
    // Form (iii) field 2: rider sum insured is subject to base sum insured linked limits.
    const overLimit = riders.filter((r) => r.sumInsured > dto.sumInsured).map((r) => r.rider);
    if (overLimit.length) {
      throw new BadRequestException(`Rider sum insured cannot exceed the base sum insured: ${overLimit.join(', ')}`);
    }
    if (new Set(riders.map((r) => r.rider)).size !== riders.length) {
      throw new BadRequestException('Each rider can be selected only once');
    }

    const premium = this.premiumService.calculate({
      basePremium: dto.basePremium,
      riders,
      commissionPercent: dto.commissionPercent,
      riderCommissionPercent: dto.riderCommissionPercent,
    });

    const policyStartDate = dto.policyStartDate ? new Date(dto.policyStartDate) : null;
    const policyEndDate = policyStartDate ? this.policyEndDate(policyStartDate, dto.policyTenureYears) : null;
    const expiryDate = new Date(Date.now() + QUOTE_VALIDITY_DAYS * 24 * 60 * 60 * 1000);

    return this.prisma.$transaction(async (tx) => {
      const quotationCode = await this.numberingEngine.generateNext('QUOTATION', tx);

      const quotation = await tx.quotation.create({
        data: {
          quotationCode,
          title: `${dto.insurerName} ${dto.planName} - ${healthCase.caseCode}`,
          status: QuotationStatus.DRAFT,
          companyId: user.companyId,
          contactId: healthCase.contactId,
          leadId: healthCase.leadId,
          insurerName: dto.insurerName,
          productCode: dto.uin,
          productType: 'HEALTH',
          sumInsured: dto.sumInsured,
          basePremium: premium.basePremium,
          gstAmount: premium.gstAmount,
          totalPremium: premium.totalPremium,
          expiryDate,
          policyTenure: dto.policyTenureYears,
          healthCaseId: healthCase.id,
          healthPlanCategory: healthCase.planCategory,
          healthMetadata: {
            policyForm: healthCase.policyForm,
            planName: dto.planName,
            uin: dto.uin,
            riders: riders.map((r) => ({ ...r })),
            coPaymentPercent: dto.coPaymentPercent ?? null,
            waitingPeriod: dto.waitingPeriod ?? null,
            medicalCheckupRequired: dto.medicalCheckupRequired ?? null,
            policyStartDate: policyStartDate?.toISOString() ?? null,
            policyEndDate: policyEndDate?.toISOString() ?? null,
            freeLookDays: FREE_LOOK_DAYS,
            premium: { ...premium },
          } as unknown as Prisma.InputJsonObject,
          createdById: user.id,
        },
      });

      if (healthCase.status === HealthCaseStatus.OPEN) {
        await tx.healthQuotationCase.update({
          where: { id: healthCase.id },
          data: { status: HealthCaseStatus.QUOTED },
        });
      }

      return quotation;
    });
  }

  async selectQuote(caseId: string, quotationId: string, user: RequestUser) {
    const healthCase = await this.getCase(caseId, user);

    if (healthCase.status !== HealthCaseStatus.QUOTED) {
      throw new BadRequestException(`A quote can only be selected when the case is QUOTED (current: ${healthCase.status})`);
    }
    if (!healthCase.quotations.some((q) => q.id === quotationId)) {
      throw new BadRequestException(`Quotation '${quotationId}' does not belong to case ${healthCase.caseCode}`);
    }

    return this.prisma.$transaction(async (tx) => {
      await tx.quotation.update({
        where: { id: quotationId },
        data: { status: QuotationStatus.ACCEPTED },
      });
      return tx.healthQuotationCase.update({
        where: { id: healthCase.id },
        data: { status: HealthCaseStatus.SELECTED, selectedQuoteId: quotationId },
        include: caseInclude,
      });
    });
  }

  async recordPayment(caseId: string, dto: RecordHealthPaymentDto, user: RequestUser) {
    const healthCase = await this.getCase(caseId, user);
    if (!healthCase.selectedQuoteId) {
      throw new BadRequestException('Please select a quotation before recording payment');
    }

    const quotation = await this.prisma.quotation.findUnique({
      where: { id: healthCase.selectedQuoteId },
    });
    if (!quotation) {
      throw new NotFoundException(`Selected quotation ${healthCase.selectedQuoteId} not found`);
    }

    const isAgent = user.role === RoleType.AGENT;
    const targetStatus = dto.status || (isAgent ? 'UNDER_PROCESS' : 'PAID');
    if (isAgent && targetStatus === 'PAID') {
      throw new ForbiddenException(
        'Agents are prohibited from verifying payments as PAID. Only Back Office or Finance may verify payments.',
      );
    }

    const payableAmount = Number(quotation.totalPremium);
    const amount = dto.amount !== undefined ? Number(dto.amount) : payableAmount;

    if (targetStatus === 'PAID') {
      if (Math.abs(amount - payableAmount) > 0.01) {
        throw new BadRequestException(
          `Payment amount ₹${amount} does not match authoritative quotation premium ₹${payableAmount}`,
        );
      }
      if (!dto.referenceNumber?.trim()) {
        throw new BadRequestException('Payment reference number / UTR is required before marking as PAID');
      }
    }

    await this.prisma.motorPaymentRecord.upsert({
      where: { quotationId: quotation.id },
      create: {
        companyId: user.companyId,
        quotationId: quotation.id,
        status: targetStatus,
        amount: new Prisma.Decimal(amount),
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber,
        paidAt: targetStatus === 'PAID' ? (dto.paidAt ? new Date(dto.paidAt) : new Date()) : null,
        notes: dto.notes,
        recordedById: user.id,
      },
      update: {
        companyId: user.companyId,
        status: targetStatus,
        amount: new Prisma.Decimal(amount),
        paymentMethod: dto.paymentMethod,
        referenceNumber: dto.referenceNumber,
        paidAt: targetStatus === 'PAID' ? (dto.paidAt ? new Date(dto.paidAt) : new Date()) : null,
        notes: dto.notes,
        recordedById: user.id,
      },
    });

    const workflowState = targetStatus === 'PAID' ? 'PAYMENT_DONE' : 'PAYMENT_UNDER_PROCESS';
    await this.prisma.quotation.update({
      where: { id: quotation.id },
      data: {
        status: targetStatus === 'PAID' ? QuotationStatus.ACCEPTED : quotation.status,
        workflowState: workflowState as any,
        issuanceStatus: (targetStatus === 'PAID' ? 'ISSUANCE_PENDING' : 'PAYMENT_PENDING') as any,
      },
    });

    return this.getCase(caseId, user);
  }

  async getPayment(caseId: string, user: RequestUser) {
    const healthCase = await this.getCase(caseId, user);
    if (!healthCase.selectedQuoteId) {
      return null;
    }
    return this.prisma.motorPaymentRecord.findUnique({
      where: { quotationId: healthCase.selectedQuoteId },
    });
  }


  /** Category / policy-form rules that the PDF implies but a DTO cannot express. */
  validateCategoryRules(dto: CreateHealthQuotationCaseDto): void {
    const selfCount = dto.members.filter((m) => m.relation === InsuredRelation.SELF).length;
    if (selfCount > 1) {
      throw new BadRequestException('Only one insured member can have relation SELF');
    }

    const today = new Date();
    dto.members.forEach((m, i) => {
      const dob = new Date(m.dateOfBirth);
      if (dob > today) {
        throw new BadRequestException(`Member ${i + 1}: date of birth cannot be in the future`);
      }
      const adultOn = new Date(dob);
      adultOn.setFullYear(adultOn.getFullYear() + PROPOSER_MIN_AGE);
      if (m.relation === InsuredRelation.SELF && adultOn > today) {
        throw new BadRequestException(`Member ${i + 1} (Self) must be at least ${PROPOSER_MIN_AGE} years old`);
      }
    });

    if (dto.planCategory === HealthPlanCategory.INDIVIDUAL && dto.members.length !== 1) {
      throw new BadRequestException('Individual Health Insurance covers exactly one insured member');
    }

    if (dto.planCategory === HealthPlanCategory.FAMILY_FLOATER && dto.members.length < 2) {
      throw new BadRequestException('Family Floater requires at least two insured members');
    }
  }

  private policyEndDate(start: Date, tenureYears: number): Date {
    const end = new Date(start);
    end.setFullYear(end.getFullYear() + tenureYears);
    end.setDate(end.getDate() - 1);
    return end;
  }
}
