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
import {
  AddHealthQuoteDto,
  CreateHealthQuotationCaseDto,
  RecordHealthPaymentDto,
  UpdateHealthCaseLeftoverDetailsDto,
} from '../dto/health-quotation-case.dto';
import { HealthPremiumService } from './health-premium.service';
import { HealthPlanValidationService } from './health-plan-validation.service';

/** Free-look period, Policy Form (i) field 12: 15 days (30 for electronic / distance marketing). */
const FREE_LOOK_DAYS = 15;
const QUOTE_VALIDITY_DAYS = 30;
/** The proposer (relation SELF) signs the proposal, so must be an adult. */
const PROPOSER_MIN_AGE = 18;

const caseInclude = {
  contact: {
    select: {
      id: true,
      contactCode: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      panNumber: true,
      aadhaarNumber: true,
    },
  },
  lead: { select: { id: true, leadCode: true, title: true } },
  members: { orderBy: { createdAt: 'asc' as const } },
  quotations: {
    include: {
      motorPaymentRecord: true,
      policy: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
  selectedQuote: {
    include: {
      motorPaymentRecord: true,
      policy: true,
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
      } else if (!dto.contactId) {
        throw err;
      } else {
        // A contact may be omitted from the user journey; retain the required
        // case/contact relation with a minimal placeholder rather than blocking quoting.
        const contactCount = await this.prisma.contact.count({ where: { companyId: user.companyId } });
        contact = await this.prisma.contact.create({
          data: {
            contactCode: `CONT-${String(contactCount + 1).padStart(6, '0')}`,
            companyId: user.companyId,
            firstName: 'Quotation',
            lastName: 'Customer',
            phone: null,
            type: 'INDIVIDUAL',
            status: 'ACTIVE',
            createdById: user.id,
            updatedById: user.id,
          },
        });
        dto.contactId = contact.id;
      }
    }
    if (dto.leadId) {
      await this.tenantAuthService.assertTenantResource('Lead', dto.leadId, user);
    }

    this.validateCategoryRules(dto);
    const planDetails = this.planValidation.validatePlanDetails(dto.planCategory, dto.planDetails, dto.members);
    const previousPolicy = this.planValidation.validateRenewal(dto.policyForm, dto.previousPolicySnapshot);

    // Proposer KYC is optional for initial health quote creation (IRDAI fields stored if provided)
    const effectiveEmail = contact.email || dto.proposerKyc?.email || undefined;
    const effectivePan = contact.panNumber || dto.proposerKyc?.panNumber || undefined;
    const effectiveAadhaar = contact.aadhaarNumber || dto.proposerKyc?.aadhaarNumber || undefined;

    const contactUpdates: Record<string, string> = {};
    if (effectiveEmail && !contact.email) contactUpdates.email = effectiveEmail;
    if (effectivePan && !contact.panNumber) contactUpdates.panNumber = effectivePan;
    if (effectiveAadhaar && !contact.aadhaarNumber) contactUpdates.aadhaarNumber = effectiveAadhaar;

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
      email: effectiveEmail ?? null,
      gender: contact.gender ?? null,
      dateOfBirth: contact.dateOfBirth ?? null,
      hasPan: Boolean(effectivePan),
      hasAadhaar: Boolean(effectiveAadhaar),
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
      gstPercent: dto.gstPercent,
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

  /**
   * Updates leftover proposer KYC, address, and nominee details on an existing health quotation case.
   */
  async updateLeftoverDetails(caseId: string, dto: UpdateHealthCaseLeftoverDetailsDto, user: RequestUser) {
    const healthCase = await this.prisma.healthQuotationCase.findFirst({
      where: { id: caseId, companyId: user.companyId },
      include: { contact: true, quotations: true },
    });

    if (!healthCase) {
      throw new NotFoundException(`Health quotation case ${caseId} not found`);
    }

    // 1. Update Contact if KYC/contact details provided
    const contactUpdates: Record<string, string> = {};
    if (dto.panNumber) contactUpdates.panNumber = dto.panNumber.trim().toUpperCase();
    if (dto.aadhaarNumber) contactUpdates.aadhaarNumber = dto.aadhaarNumber.trim();
    if (dto.email) contactUpdates.email = dto.email.trim();
    if (dto.phone) contactUpdates.phone = dto.phone.trim();

    let updatedContact = healthCase.contact;
    if (Object.keys(contactUpdates).length) {
      updatedContact = await this.prisma.contact.update({
        where: { id: healthCase.contactId },
        data: contactUpdates,
      });

      // Also sync customer if linked to this contact
      await this.prisma.customer.updateMany({
        where: { contactId: healthCase.contactId },
        data: {
          ...(contactUpdates.panNumber ? { panNumber: contactUpdates.panNumber } : {}),
          ...(contactUpdates.aadhaarNumber ? { aadhaarNumber: contactUpdates.aadhaarNumber } : {}),
          ...(contactUpdates.email ? { email: contactUpdates.email } : {}),
          ...(contactUpdates.phone ? { mobile: contactUpdates.phone } : {}),
          ...(dto.address?.line1 ? { addressLine1: dto.address.line1.trim() } : {}),
          ...(dto.address?.line2 ? { addressLine2: dto.address.line2.trim() } : {}),
          ...(dto.address?.city ? { city: dto.address.city.trim() } : {}),
          ...(dto.address?.state ? { state: dto.address.state.trim() } : {}),
          ...(dto.address?.pincode ? { pincode: dto.address.pincode.trim() } : {}),
        },
      });
    } else if (dto.address) {
      await this.prisma.customer.updateMany({
        where: { contactId: healthCase.contactId },
        data: {
          ...(dto.address?.line1 ? { addressLine1: dto.address.line1.trim() } : {}),
          ...(dto.address?.line2 ? { addressLine2: dto.address.line2.trim() } : {}),
          ...(dto.address?.city ? { city: dto.address.city.trim() } : {}),
          ...(dto.address?.state ? { state: dto.address.state.trim() } : {}),
          ...(dto.address?.pincode ? { pincode: dto.address.pincode.trim() } : {}),
        },
      });
    }

    // 2. Update HealthQuotationCase leftover fields
    const caseUpdates: Prisma.HealthQuotationCaseUpdateInput = {};
    if (dto.nomineeName) caseUpdates.nomineeName = dto.nomineeName.trim();
    if (dto.nomineeRelation) caseUpdates.nomineeRelation = dto.nomineeRelation;
    if (dto.occupation) caseUpdates.occupation = dto.occupation;
    if (dto.annualIncome !== undefined) caseUpdates.annualIncome = new Prisma.Decimal(dto.annualIncome);
    if (dto.address) caseUpdates.addressSnapshot = { ...((healthCase.addressSnapshot as object) || {}), ...dto.address };

    // Update customer snapshot to reflect current KYC presence
    const prevSnapshot = (healthCase.customerSnapshot as Record<string, any>) || {};
    const updatedCustomerSnapshot = {
      ...prevSnapshot,
      firstName: updatedContact.firstName,
      lastName: updatedContact.lastName,
      phone: updatedContact.phone,
      email: updatedContact.email,
      hasPan: Boolean(updatedContact.panNumber),
      hasAadhaar: Boolean(updatedContact.aadhaarNumber),
    };
    caseUpdates.customerSnapshot = updatedCustomerSnapshot;

    await this.prisma.healthQuotationCase.update({
      where: { id: caseId },
      data: caseUpdates,
    });

    // 3. Keep linked quotations' healthMetadata synchronized with updated proposer and nominee
    if (healthCase.quotations.length > 0) {
      for (const q of healthCase.quotations) {
        const prevMeta = (q.healthMetadata as Record<string, any>) || {};
        await this.prisma.quotation.update({
          where: { id: q.id },
          data: {
            healthMetadata: {
              ...prevMeta,
              proposerPan: updatedContact.panNumber || prevMeta.proposerPan,
              proposerAadhaar: updatedContact.aadhaarNumber || prevMeta.proposerAadhaar,
              proposerEmail: updatedContact.email || prevMeta.proposerEmail,
              nomineeName: dto.nomineeName?.trim() || prevMeta.nomineeName,
              nomineeRelation: dto.nomineeRelation || prevMeta.nomineeRelation,
            },
          },
        });
      }
    }

    return this.getCase(caseId, user);
  }
}
