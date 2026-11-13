import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  HealthCaseStatus,
  HealthPlanCategory,
  HealthPolicyForm,
  InsuredRelation,
  PaymentTrackingStatus,
  Prisma,
  QuotationStatus,
  RoleType,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { EncryptionUtil } from '../../../common/utils/encryption.util';
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
import { AgentIdentityResolverService } from '../../agents/agent-identity-resolver.service';

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
    private readonly agentIdentityResolver: AgentIdentityResolverService,
  ) {}

  private caseWhereFor(user: RequestUser): Prisma.HealthQuotationCaseWhereInput {
    const where: Prisma.HealthQuotationCaseWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
    };
    if (user.role !== RoleType.AGENT) return where;

    const ownership: Prisma.HealthQuotationCaseWhereInput[] = [];
    if (user.agentId) ownership.push({ agentId: user.agentId });
    ownership.push({ agentId: null, createdById: user.userId || user.id });
    return { ...where, OR: ownership };
  }

  private maskPiiData(value: any): any {
    if (Array.isArray(value)) return value.map((item) => this.maskPiiData(item));
    if (!value || typeof value !== 'object') return value;

    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => {
        if (typeof item === 'string' && /pan(?:number)?$/i.test(key)) {
          return [key, EncryptionUtil.maskPan(item)];
        }
        if (typeof item === 'string' && /aadhaar/i.test(key)) {
          return [key, EncryptionUtil.maskAadhaar(item)];
        }
        return [key, this.maskPiiData(item)];
      }),
    );
  }

  private toSafeCase<T extends Record<string, any>>(healthCase: T): T {
    const maskQuote = (quote: any) => {
      if (!quote) return quote;
      return {
        ...quote,
        healthMetadata: this.maskPiiData(quote.healthMetadata),
        calculationSnapshot: this.maskPiiData(quote.calculationSnapshot),
      };
    };

    return {
      ...healthCase,
      customerSnapshot: this.maskPiiData(healthCase.customerSnapshot),
      contact: healthCase.contact
        ? {
            ...healthCase.contact,
            panNumber: EncryptionUtil.maskPan(healthCase.contact.panNumber),
            aadhaarNumber: EncryptionUtil.maskAadhaar(healthCase.contact.aadhaarNumber),
          }
        : healthCase.contact,
      quotations: Array.isArray(healthCase.quotations)
        ? healthCase.quotations.map(maskQuote)
        : healthCase.quotations,
      selectedQuote: maskQuote(healthCase.selectedQuote),
    } as T;
  }

  private async assertLeadAccess(leadId: string, user: RequestUser) {
    const lead = await this.prisma.lead.findFirst({
      where: { id: leadId, companyId: user.companyId, deletedAt: null },
      select: {
        id: true,
        contactId: true,
        agentId: true,
        assignedToId: true,
        createdById: true,
      },
    });
    if (!lead) throw new NotFoundException(`Lead '${leadId}' not found or access denied`);

    if (user.role === RoleType.AGENT) {
      const ownsLead =
        (Boolean(user.agentId) && lead.agentId === user.agentId) ||
        (!lead.agentId && lead.assignedToId === (user.userId || user.id)) ||
        (!lead.agentId && lead.createdById === (user.userId || user.id));
      if (!ownsLead) throw new NotFoundException(`Lead '${leadId}' not found or access denied`);
    }
    return lead;
  }

  private async assertFamilyMembersBelongToContact(
    contactId: string,
    members: CreateHealthQuotationCaseDto['members'],
    companyId: string,
  ) {
    const providedIds = members.map((member) => member.familyMemberId).filter(Boolean) as string[];
    const familyMemberIds = [...new Set(providedIds)];
    if (familyMemberIds.length !== providedIds.length) {
      throw new BadRequestException('A family member can only be selected once per Health case');
    }
    if (!familyMemberIds.length) return;

    const ownedMembers = await this.prisma.familyMember.findMany({
      where: {
        id: { in: familyMemberIds },
        contactId,
        contact: { companyId },
      },
      select: { id: true },
    });
    if (ownedMembers.length !== familyMemberIds.length) {
      throw new BadRequestException('Every selected family member must belong to the proposer contact');
    }
  }

  async findCaseForActor(caseId: string, user: RequestUser) {
    const healthCase = await this.prisma.healthQuotationCase.findFirst({
      where: { id: caseId, ...this.caseWhereFor(user) },
    });
    if (!healthCase) {
      throw new NotFoundException(`HealthQuotationCase '${caseId}' not found or access denied`);
    }
    return healthCase;
  }

  async createCase(dto: CreateHealthQuotationCaseDto, user: RequestUser) {
    let contact: any;
    try {
      contact = await this.tenantAuthService.assertTenantResource<any>('Contact', dto.contactId, user);
    } catch (err) {
      // Check if dto.contactId was a customerId
      const customer = await this.prisma.customer.findFirst({
        where: { id: dto.contactId, companyId: user.companyId, deletedAt: null },
        include: { contact: true },
      });
      if (customer) {
        if (customer.contact) {
          contact = customer.contact;
          dto.contactId = customer.contact.id;
        } else {
          let contactSeq = 1n;
          try {
            const seqRes = await this.prisma.$queryRaw<[{ nextval: bigint }]>`SELECT nextval('contact_number_seq')`;
            if (seqRes?.[0]?.nextval !== undefined) contactSeq = seqRes[0].nextval;
          } catch {
            // Fallback handled safely
          }
          contact = await this.prisma.contact.create({
            data: {
              contactCode: `CONT-${contactSeq.toString().padStart(6, '0')}`,
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
    const proposerContact = await this.prisma.contact.findFirst({
      where: { id: contact.id, companyId: user.companyId, deletedAt: null },
      include: {
        customer: {
          select: {
            companyId: true,
            primaryAgentId: true,
            primaryAgentExternalCodeId: true,
          },
        },
      },
    });
    if (!proposerContact) throw new NotFoundException('Proposer contact not found or access denied');
    contact = proposerContact;

    const lead = dto.leadId ? await this.assertLeadAccess(dto.leadId, user) : null;
    if (lead && lead.contactId !== contact.id) {
      throw new BadRequestException('The selected lead does not belong to the proposer contact');
    }

    if (user.role === RoleType.AGENT) {
      if (!user.agentId) {
        throw new ForbiddenException('An active Agent profile is required to create Health cases');
      }
      const customerAgentId = contact.customer?.primaryAgentId;
      const ownsContact = customerAgentId
        ? customerAgentId === user.agentId
        : contact.createdById === (user.userId || user.id) ||
          lead?.agentId === user.agentId ||
          lead?.assignedToId === (user.userId || user.id);
      if (!ownsContact) {
        throw new NotFoundException(`Contact '${contact.id}' not found or access denied`);
      }
      if (dto.agentId && dto.agentId !== user.agentId) {
        throw new ForbiddenException('Agents cannot assign a Health case to another agent');
      }
    }

    let assignedAgentId =
      user.role === RoleType.AGENT
        ? user.agentId!
        : dto.agentId || lead?.agentId || contact.customer?.primaryAgentId || null;
    if (assignedAgentId) {
      await this.tenantAuthService.assertAssignableAgent(assignedAgentId, user);
      const canonical = await this.agentIdentityResolver.validateAgentOwnership(
        assignedAgentId,
        user.companyId,
      );
      assignedAgentId = canonical.id;
    }
    const assignedExternalCodeId = assignedAgentId
      ? contact.assignedAgentId === assignedAgentId
        ? contact.assignedExternalCodeId
        : contact.customer?.primaryAgentId === assignedAgentId
          ? contact.customer.primaryAgentExternalCodeId
          : null
      : null;

    await this.assertFamilyMembersBelongToContact(contact.id, dto.members, user.companyId);

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
        agentId: assignedAgentId,
        agentExternalCodeId: assignedExternalCodeId,
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
    }).then((healthCase) => this.toSafeCase(healthCase));
  }

  async getCase(caseId: string, user: RequestUser) {
    const healthCase = await this.prisma.healthQuotationCase.findFirst({
      where: { id: caseId, ...this.caseWhereFor(user) },
      include: caseInclude,
    });
    if (!healthCase) {
      throw new NotFoundException(`HealthQuotationCase '${caseId}' not found or access denied`);
    }
    return this.toSafeCase(healthCase);
  }

  async getCasesForLead(leadId: string, user: RequestUser) {
    await this.assertLeadAccess(leadId, user);
    const cases = await this.prisma.healthQuotationCase.findMany({
      where: { leadId, ...this.caseWhereFor(user) },
      include: caseInclude,
      orderBy: { createdAt: 'desc' },
    });
    return cases.map((healthCase) => this.toSafeCase(healthCase));
  }

  async getAllCases(user: RequestUser) {
    const cases = await this.prisma.healthQuotationCase.findMany({
      where: this.caseWhereFor(user),
      include: caseInclude,
      orderBy: { createdAt: 'desc' },
    });
    return cases.map((healthCase) => this.toSafeCase(healthCase));
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

    const previousPolicySnapshot = (healthCase.previousPolicySnapshot || {}) as Record<string, any>;
    const renewalSourcePolicyId = typeof previousPolicySnapshot.sourcePolicyId === 'string'
      ? previousPolicySnapshot.sourcePolicyId
      : null;
    if (renewalSourcePolicyId && healthCase.policyForm !== HealthPolicyForm.RENEWAL_PORTABILITY) {
      throw new BadRequestException('A predecessor policy can only be linked to a Renewal / Portability health case');
    }
    if (healthCase.policyForm === HealthPolicyForm.RENEWAL_PORTABILITY && renewalSourcePolicyId) {
      const sourcePolicy = await this.prisma.policy.findFirst({
        where: {
          id: renewalSourcePolicyId,
          companyId: user.companyId,
          contactId: healthCase.contactId,
          deletedAt: null,
          status: { notIn: ['CANCELLED', 'DRAFT'] },
        },
        select: { id: true },
      });
      if (!sourcePolicy) {
        throw new NotFoundException('Predecessor health policy was not found for this customer and company');
      }
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
          agentId: healthCase.agentId,
          agentExternalCodeId: healthCase.agentExternalCodeId,
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
          renewalOfPolicyId: renewalSourcePolicyId,
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

    const selectedCase = await this.prisma.$transaction(async (tx) => {
      // Compare-and-set the case first. Only one concurrent request can move
      // QUOTED + unselected to SELECTED.
      const caseClaim = await tx.healthQuotationCase.updateMany({
        where: {
          ...this.caseWhereFor(user),
          id: healthCase.id,
          status: HealthCaseStatus.QUOTED,
          selectedQuoteId: null,
        },
        data: {
          status: HealthCaseStatus.SELECTED,
          selectedQuoteId: quotationId,
        },
      });
      if (caseClaim.count !== 1) {
        throw new ConflictException('This health quotation case has already been selected or changed. Refresh and try again.');
      }

      const quoteClaim = await tx.quotation.updateMany({
        where: {
          id: quotationId,
          companyId: user.companyId,
          healthCaseId: healthCase.id,
        },
        data: { status: QuotationStatus.ACCEPTED },
      });
      if (quoteClaim.count !== 1) {
        throw new BadRequestException('The selected quotation is no longer available for this health case.');
      }

      const updatedCase = await tx.healthQuotationCase.findFirst({
        where: { ...this.caseWhereFor(user), id: healthCase.id },
        include: caseInclude,
      });
      if (!updatedCase) {
        throw new NotFoundException('Health quotation case was not found after selection.');
      }
      return updatedCase;
    });
    return this.toSafeCase(selectedCase);
  }

  async recordPayment(caseId: string, dto: RecordHealthPaymentDto, user: RequestUser) {
    const isAgent = user.role === RoleType.AGENT;
    const targetStatus = dto.status || (isAgent ? PaymentTrackingStatus.UNDER_PROCESS : PaymentTrackingStatus.PAID);
    if (isAgent && targetStatus === 'PAID') {
      throw new ForbiddenException(
        'Agents are prohibited from verifying payments as PAID. Only Back Office or Finance may verify payments.',
      );
    }
    const amount = dto.amount !== undefined ? Number(dto.amount) : undefined;
    const referenceNumber = dto.referenceNumber.trim();
    const paymentMethod = dto.paymentMethod.trim();

    await this.prisma.$transaction(async (tx) => {
      const healthCase = await tx.healthQuotationCase.findFirst({
        where: { id: caseId, ...this.caseWhereFor(user) },
        select: { id: true, selectedQuoteId: true },
      });
      if (!healthCase) {
        throw new NotFoundException(`HealthQuotationCase '${caseId}' not found or access denied`);
      }
      if (!healthCase.selectedQuoteId) {
        throw new BadRequestException('Please select a quotation before recording payment');
      }

      const quotation = await tx.quotation.findFirst({
        where: {
          id: healthCase.selectedQuoteId,
          companyId: user.companyId,
          healthCaseId: healthCase.id,
        },
      });
      if (!quotation) {
        throw new NotFoundException(`Selected quotation ${healthCase.selectedQuoteId} not found`);
      }
      if (!quotation.backOfficeSubmittedAt) {
        throw new BadRequestException(
          'Quotation must be sent to Back Office before payment can be recorded',
        );
      }
      const isBackOfficeApproved =
        quotation.status === QuotationStatus.APPROVED ||
        String(quotation.workflowState || '').toUpperCase() === 'PROPOSAL_APPROVED' ||
        String(quotation.workflowState || '').toUpperCase() === 'PAYMENT_UNDER_PROCESS' ||
        String(quotation.workflowState || '').toUpperCase() === 'PAYMENT_DONE';
      if (!isBackOfficeApproved) {
        throw new BadRequestException(
          'Quotation must be approved by Back Office before payment can be recorded',
        );
      }

      const payableAmount = Number(quotation.totalPremium);
      const submittedAmount = amount ?? payableAmount;
      if (targetStatus === PaymentTrackingStatus.PAID) {
        if (Math.abs(submittedAmount - payableAmount) > 0.01) {
          throw new BadRequestException(
            `Payment amount ₹${submittedAmount} does not match authoritative quotation premium ₹${payableAmount}`,
          );
        }
        if (!referenceNumber) {
          throw new BadRequestException('Payment reference number / UTR is required before marking as PAID');
        }
      }

      const existingPayment = await tx.motorPaymentRecord.findUnique({
        where: { quotationId: quotation.id },
      });
      const samePayment = Boolean(
        existingPayment &&
        Number(existingPayment.amount) === submittedAmount &&
        existingPayment.referenceNumber === referenceNumber &&
        existingPayment.paymentMethod === paymentMethod,
      );

      if (existingPayment?.status === PaymentTrackingStatus.PAID) {
        throw new BadRequestException(
          'Payment has already been recorded as PAID for this quotation and cannot be recorded again.',
        );
      } else if (existingPayment?.status === PaymentTrackingStatus.UNDER_PROCESS && !samePayment) {
        throw new BadRequestException('An in-process payment cannot be replaced; reconcile it before resubmission');
      } else if (
        existingPayment?.status === PaymentTrackingStatus.NOT_DONE &&
        (existingPayment.amount !== null || existingPayment.referenceNumber !== null) &&
        !samePayment
      ) {
        throw new BadRequestException('Existing payment evidence must be reconciled before replacement');
      }

      if (!samePayment || existingPayment?.status === PaymentTrackingStatus.NOT_DONE) {
        const paymentData = {
          companyId: user.companyId,
          status: targetStatus,
          amount: new Prisma.Decimal(submittedAmount),
          paymentMethod,
          referenceNumber,
          paidAt:
            targetStatus === PaymentTrackingStatus.PAID
              ? (dto.paidAt ? new Date(dto.paidAt) : new Date())
              : null,
          notes: dto.notes,
          recordedById: user.userId || user.id,
        };
        if (existingPayment) {
          await tx.motorPaymentRecord.update({
            where: { quotationId: quotation.id },
            data: paymentData,
          });
        } else {
          await tx.motorPaymentRecord.create({
            data: { ...paymentData, quotationId: quotation.id },
          });
        }
      } else if (
        existingPayment?.status === PaymentTrackingStatus.UNDER_PROCESS &&
        targetStatus === PaymentTrackingStatus.PAID
      ) {
        await tx.motorPaymentRecord.update({
          where: { quotationId: quotation.id },
          data: {
            status: PaymentTrackingStatus.PAID,
            paidAt: dto.paidAt ? new Date(dto.paidAt) : new Date(),
            recordedById: user.userId || user.id,
          },
        });
      }

      const paid = targetStatus === PaymentTrackingStatus.PAID;
      await tx.quotation.update({
        where: { id: quotation.id, companyId: user.companyId, healthCaseId: healthCase.id },
        data: {
          status: paid ? QuotationStatus.ACCEPTED : quotation.status,
          workflowState: (paid ? 'PAYMENT_DONE' : 'PAYMENT_UNDER_PROCESS') as any,
          issuanceStatus: (paid ? 'ISSUANCE_PENDING' : 'PAYMENT_PENDING') as any,
        },
      });
    });

    return this.getCase(caseId, user);
  }

  async getPayment(caseId: string, user: RequestUser) {
    const healthCase = await this.getCase(caseId, user);
    if (!healthCase.selectedQuoteId) {
      return null;
    }
    // getCase scopes the health case to this tenant. Also assert quotation ownership
    // explicitly and scope the payment record itself to the authenticated company.
    await this.tenantAuthService.assertTenantResource('Quotation', healthCase.selectedQuoteId, user);
    return this.prisma.motorPaymentRecord.findFirst({
      where: {
        quotationId: healthCase.selectedQuoteId,
        companyId: user.companyId,
      },
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
      where: { id: caseId, ...this.caseWhereFor(user) },
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
        where: {
          companyId_id: {
            companyId: user.companyId,
            id: healthCase.contactId,
          },
        },
        data: contactUpdates,
      });

      // Also sync customer if linked to this contact
      await this.prisma.customer.updateMany({
        where: { contactId: healthCase.contactId, companyId: user.companyId },
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
        where: { contactId: healthCase.contactId, companyId: user.companyId },
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
    if (dto.address) {
      const prevAddr = ((healthCase.addressSnapshot as object) || {}) as Record<string, any>;
      const normalizedPrev: Record<string, any> = {
        line1: prevAddr.line1 || prevAddr.addressLine1 || undefined,
        line2: prevAddr.line2 || prevAddr.addressLine2 || undefined,
        city: prevAddr.city || undefined,
        state: prevAddr.state || undefined,
        pincode: prevAddr.pincode || undefined,
      };
      const mergedAddress: Record<string, any> = { ...normalizedPrev };
      for (const [key, val] of Object.entries(dto.address)) {
        if (val !== undefined && val !== null) {
          mergedAddress[key] = typeof val === 'string' ? val.trim() : val;
        }
      }
      caseUpdates.addressSnapshot = mergedAddress;
    }

    // Update customer snapshot to reflect current KYC presence
    const prevSnapshot = (healthCase.customerSnapshot as Record<string, any>) || {};
    const snapshotWithoutPii = { ...prevSnapshot };
    delete snapshotWithoutPii.panNumber;
    delete snapshotWithoutPii.aadhaarNumber;
    delete snapshotWithoutPii.proposerPan;
    delete snapshotWithoutPii.proposerAadhaar;
    const updatedCustomerSnapshot = {
      ...snapshotWithoutPii,
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
        const nextMeta = { ...prevMeta };
        delete nextMeta.proposerPan;
        delete nextMeta.proposerAadhaar;
        await this.prisma.quotation.update({
          where: { id: q.id },
          data: {
            healthMetadata: {
              ...nextMeta,
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
