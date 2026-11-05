import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  Gender,
  LifeCaseStatus,
  LifePlanCategory,
  PaymentTrackingStatus,
  Prisma,
  QuotationStatus,
  RoleType,
} from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { EncryptionUtil } from '../../../common/utils/encryption.util';
import { TenantResourceAuthorizationService } from '../../auth/services/tenant-resource-authorization.service';
import { NumberingEngineService } from '../../administration/services/numbering-engine/numbering-engine.service';
import { AgentIdentityResolverService } from '../../agents/agent-identity-resolver.service';
import { RequestUser } from '../../auth/decorators/current-user.decorator';
import {
  AddLifeQuoteDto,
  CreateLifeQuotationCaseDto,
  LifeCaseFilterDto,
  RecordLifePaymentDto,
  UpdateLifeQuotationCaseDto,
} from '../dto/life-quotation-case.dto';
import { LifeQuotationCalculationService } from './life-quotation-calculation.service';
import { LifeQuotationDocumentService } from './life-quotation-document.service';

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
      dateOfBirth: true,
      gender: true,
    },
  },
  lead: { select: { id: true, leadCode: true, title: true } },
  agent: { select: { id: true, agentCode: true, userId: true } },
  quotations: {
    include: {
      lifeRiders: true,
      motorPaymentRecord: true,
      policy: true,
    },
    orderBy: { createdAt: 'desc' as const },
  },
  selectedQuote: {
    include: {
      lifeRiders: true,
      motorPaymentRecord: true,
      policy: true,
    },
  },
  documents: {
    include: {
      document: {
        select: {
          id: true,
          name: true,
          originalFileName: true,
          mimeType: true,
          size: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' as const },
  },
};

@Injectable()
export class LifeQuotationCaseService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tenantAuthService: TenantResourceAuthorizationService,
    private readonly numberingEngine: NumberingEngineService,
    private readonly calculationService: LifeQuotationCalculationService,
    private readonly documentService: LifeQuotationDocumentService,
    private readonly agentIdentityResolver: AgentIdentityResolverService,
  ) {}

  private caseWhereFor(user: RequestUser): Prisma.LifeQuotationCaseWhereInput {
    const where: Prisma.LifeQuotationCaseWhereInput = {
      companyId: user.companyId,
      deletedAt: null,
    };
    if (user.role !== RoleType.AGENT) return where;

    const ownership: Prisma.LifeQuotationCaseWhereInput[] = [];
    if (user.agentId) ownership.push({ agentId: user.agentId });
    ownership.push({ agentId: null, createdById: user.userId || user.id });
    return { ...where, OR: ownership };
  }

  private calculateAge(dob: Date): number {
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const m = today.getMonth() - dob.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  }

  private calculateBmi(heightCm?: number, weightKg?: number): number | undefined {
    if (!heightCm || !weightKg || heightCm <= 0 || weightKg <= 0) return undefined;
    const heightM = heightCm / 100;
    const bmi = weightKg / (heightM * heightM);
    return Math.round((bmi + Number.EPSILON) * 10) / 10;
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

  private toSafeCase<T extends Record<string, any>>(lifeCase: T): T {
    const maskQuote = (quote: any) => {
      if (!quote) return quote;
      return {
        ...quote,
        lifeMetadata: this.maskPiiData(quote.lifeMetadata),
        calculationSnapshot: this.maskPiiData(quote.calculationSnapshot),
      };
    };

    return {
      ...lifeCase,
      customerSnapshot: this.maskPiiData(lifeCase.customerSnapshot),
      contact: lifeCase.contact
        ? {
            ...lifeCase.contact,
            panNumber: EncryptionUtil.maskPan(lifeCase.contact.panNumber),
            aadhaarNumber: EncryptionUtil.maskAadhaar(lifeCase.contact.aadhaarNumber),
          }
        : lifeCase.contact,
      quotations: Array.isArray(lifeCase.quotations)
        ? lifeCase.quotations.map(maskQuote)
        : lifeCase.quotations,
      selectedQuote: maskQuote(lifeCase.selectedQuote),
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

  async findCaseForActor(caseId: string, user: RequestUser) {
    const lifeCase = await this.prisma.lifeQuotationCase.findFirst({
      where: { id: caseId, ...this.caseWhereFor(user) },
    });
    if (!lifeCase) {
      throw new NotFoundException(`LifeQuotationCase '${caseId}' not found or access denied`);
    }
    return lifeCase;
  }

  async createCase(dto: CreateLifeQuotationCaseDto, user: RequestUser) {
    // 1. Proposer Contact Verification
    const contact = await this.tenantAuthService.assertTenantResource<any>('Contact', dto.contactId, user);
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

    // 2. Lead Verification
    const lead = dto.leadId ? await this.assertLeadAccess(dto.leadId, user) : null;
    if (lead && lead.contactId !== contact.id) {
      throw new BadRequestException('The selected lead does not belong to the proposer contact');
    }

    // 3. Agent Authorization
    if (user.role === RoleType.AGENT) {
      if (!user.agentId) {
        throw new ForbiddenException('An active Agent profile is required to create Life proposals');
      }
      const customerAgentId = proposerContact.customer?.primaryAgentId;
      const ownsContact = customerAgentId
        ? customerAgentId === user.agentId
        : proposerContact.createdById === (user.userId || user.id) ||
          lead?.agentId === user.agentId ||
          lead?.assignedToId === (user.userId || user.id);
      if (!ownsContact) {
        throw new NotFoundException(`Contact '${contact.id}' not found or access denied`);
      }
      if (dto.agentId && dto.agentId !== user.agentId) {
        throw new ForbiddenException('Agents cannot assign a Life case to another agent');
      }
    }

    let assignedAgentId =
      user.role === RoleType.AGENT
        ? user.agentId!
        : dto.agentId || lead?.agentId || proposerContact.customer?.primaryAgentId || null;
    if (assignedAgentId) {
      await this.tenantAuthService.assertAssignableAgent(assignedAgentId, user);
      const canonical = await this.agentIdentityResolver.validateAgentOwnership(
        assignedAgentId,
        user.companyId,
      );
      assignedAgentId = canonical.id;
    }

    const assignedExternalCodeId = assignedAgentId
      ? proposerContact.assignedAgentId === assignedAgentId
        ? proposerContact.assignedExternalCodeId
        : proposerContact.customer?.primaryAgentId === assignedAgentId
          ? proposerContact.customer.primaryAgentExternalCodeId
          : null
      : null;

    // 4. Life Assured Demographics & Proposer Separation
    const isLifeAssuredDifferent = Boolean(dto.isLifeAssuredDifferent);
    let lifeAssuredName = dto.lifeAssuredName?.trim() || null;
    let lifeAssuredDob = dto.lifeAssuredDob ? new Date(dto.lifeAssuredDob) : null;
    let lifeAssuredGender = dto.lifeAssuredGender || null;
    const proposerRelation = dto.proposerRelation || 'SELF';

    if (!isLifeAssuredDifferent) {
      lifeAssuredName = `${proposerContact.firstName} ${proposerContact.lastName || ''}`.trim();
      lifeAssuredDob = proposerContact.dateOfBirth;
      lifeAssuredGender = proposerContact.gender;
    } else {
      if (!lifeAssuredName) {
        throw new BadRequestException('Life Assured full name is required when different from proposer');
      }
      if (!lifeAssuredDob) {
        throw new BadRequestException('Life Assured date of birth is required when different from proposer');
      }
      if (!lifeAssuredGender) {
        throw new BadRequestException('Life Assured gender is required when different from proposer');
      }
      if (proposerRelation === 'SELF') {
        throw new BadRequestException("Proposer relationship cannot be 'SELF' when Life Assured is different");
      }
    }

    // 5. Nominee & Minor Appointee Calendar Age Validation
    let isNomineeMinor = false;
    let nomineeDobDate: Date | null = null;
    if (dto.nomineeDob) {
      nomineeDobDate = new Date(dto.nomineeDob);
      const nomineeAge = this.calculateAge(nomineeDobDate);
      if (nomineeAge < 0) {
        throw new BadRequestException('Nominee date of birth cannot be in the future');
      }
      isNomineeMinor = nomineeAge < 18;
    }

    if (isNomineeMinor) {
      if (!dto.appointeeName?.trim()) {
        throw new BadRequestException(
          'Appointee name is mandatory because nominee is a minor (< 18 years old)',
        );
      }
      if (!dto.appointeeDob) {
        throw new BadRequestException(
          'Appointee date of birth is mandatory because nominee is a minor (< 18 years old)',
        );
      }
      const appointeeDobDate = new Date(dto.appointeeDob);
      const appointeeAge = this.calculateAge(appointeeDobDate);
      if (appointeeAge < 18) {
        throw new BadRequestException(
          `Appointee must be an adult (>= 18 years old). Provided age: ${appointeeAge}`,
        );
      }
      if (!dto.appointeeRelation) {
        throw new BadRequestException('Appointee relation to minor nominee is mandatory');
      }
    }

    // 6. Joint Life Annuity Underwriting (Category 1.7)
    if (dto.planCategory === LifePlanCategory.ANNUITY) {
      const categoryData = dto.categoryData || {};
      const annuityOption = categoryData.annuityOption || '';
      if (/JOINT_LIFE/i.test(annuityOption)) {
        if (!dto.secondaryLifeAssured) {
          throw new BadRequestException(
            'Secondary Life Assured details are mandatory for Joint Life Annuity option',
          );
        }
        if (!dto.secondaryLifeAssured.name?.trim()) {
          throw new BadRequestException('Secondary Life Assured name is required');
        }
        if (!dto.secondaryLifeAssured.dateOfBirth) {
          throw new BadRequestException('Secondary Life Assured date of birth is required');
        }
      }
    }

    // 7. BMI Calculation
    const bmi = this.calculateBmi(dto.heightCm, dto.weightKg);

    // 8. Contact KYC Updates (if supplied in proposal)
    const effectivePan = dto.proposerKyc?.panNumber?.trim().toUpperCase() || proposerContact.panNumber;
    const effectiveAadhaar = dto.proposerKyc?.aadhaarNumber?.trim() || proposerContact.aadhaarNumber;
    const effectiveEmail = dto.proposerKyc?.email?.trim() || proposerContact.email;

    const contactUpdates: Record<string, string> = {};
    if (effectivePan && effectivePan !== proposerContact.panNumber) contactUpdates.panNumber = effectivePan;
    if (effectiveAadhaar && effectiveAadhaar !== proposerContact.aadhaarNumber) contactUpdates.aadhaarNumber = effectiveAadhaar;
    if (effectiveEmail && effectiveEmail !== proposerContact.email) contactUpdates.email = effectiveEmail;

    if (Object.keys(contactUpdates).length) {
      await this.prisma.contact.update({
        where: { id: proposerContact.id },
        data: contactUpdates,
      });
    }

    // 9. Generate Numbering Case Code
    const caseCode = await this.numberingEngine.generateNext('LIFE_CASE');

    // 10. Customer Snapshot (masked PAN / Aadhaar indicator)
    const customerSnapshot = {
      contactCode: proposerContact.contactCode,
      firstName: proposerContact.firstName,
      lastName: proposerContact.lastName,
      phone: proposerContact.phone,
      email: effectiveEmail || null,
      gender: proposerContact.gender || null,
      dateOfBirth: proposerContact.dateOfBirth || null,
      hasPan: Boolean(effectivePan),
      hasAadhaar: Boolean(effectiveAadhaar),
    };

    const createdCase = await this.prisma.lifeQuotationCase.create({
      data: {
        companyId: user.companyId,
        caseCode,
        planCategory: dto.planCategory,
        policyForm: dto.policyForm || 'NEW_POLICY',
        status: LifeCaseStatus.DRAFT,
        contactId: proposerContact.id,
        agentId: assignedAgentId,
        agentExternalCodeId: assignedExternalCodeId,
        leadId: dto.leadId || null,
        proposerOccupation: dto.occupation,
        annualIncome: dto.annualIncome ? new Prisma.Decimal(dto.annualIncome) : null,
        addressSnapshot: dto.address ? { ...dto.address } : undefined,
        customerSnapshot,
        isLifeAssuredDifferent,
        proposerRelation,
        lifeAssuredName,
        lifeAssuredDob,
        lifeAssuredGender,
        smokerStatus: dto.smokerStatus || 'UNKNOWN',
        heightCm: dto.heightCm ? new Prisma.Decimal(dto.heightCm) : null,
        weightKg: dto.weightKg ? new Prisma.Decimal(dto.weightKg) : null,
        bmi: bmi ? new Prisma.Decimal(bmi) : null,
        occupationRiskCategory: dto.occupationRiskCategory,
        hasPreExistingIllness: Boolean(dto.hasPreExistingIllness),
        medicalHistoryDetails: dto.medicalHistoryDetails,
        secondaryLifeAssured: dto.secondaryLifeAssured ? { ...dto.secondaryLifeAssured } : undefined,
        nomineeName: dto.nomineeName,
        nomineeDob: nomineeDobDate,
        nomineeRelation: dto.nomineeRelation,
        isNomineeMinor,
        appointeeName: isNomineeMinor ? dto.appointeeName : null,
        appointeeDob: isNomineeMinor && dto.appointeeDob ? new Date(dto.appointeeDob) : null,
        appointeeRelation: isNomineeMinor ? dto.appointeeRelation : null,
        categoryData: dto.categoryData ? { ...dto.categoryData } : undefined,
        previousPolicySnapshot: dto.previousPolicySnapshot ? { ...dto.previousPolicySnapshot } : undefined,
        createdById: user.userId || user.id,
      },
      include: caseInclude,
    });

    return this.toSafeCase(createdCase);
  }

  async getAllCases(user: RequestUser, filter?: LifeCaseFilterDto) {
    const where: Prisma.LifeQuotationCaseWhereInput = {
      ...this.caseWhereFor(user),
    };

    if (filter?.planCategory) where.planCategory = filter.planCategory;
    if (filter?.status) where.status = filter.status;
    if (filter?.leadId) where.leadId = filter.leadId;
    if (filter?.contactId) where.contactId = filter.contactId;

    if (filter?.search?.trim()) {
      const q = filter.search.trim();
      where.OR = [
        { caseCode: { contains: q, mode: 'insensitive' } },
        { contact: { firstName: { contains: q, mode: 'insensitive' } } },
        { contact: { lastName: { contains: q, mode: 'insensitive' } } },
        { contact: { phone: { contains: q } } },
        { contact: { email: { contains: q, mode: 'insensitive' } } },
      ];
    }

    const cases = await this.prisma.lifeQuotationCase.findMany({
      where,
      include: caseInclude,
      orderBy: { createdAt: 'desc' },
    });

    return cases.map((c) => this.toSafeCase(c));
  }

  async getCase(id: string, user: RequestUser) {
    const lifeCase = await this.prisma.lifeQuotationCase.findFirst({
      where: { id, ...this.caseWhereFor(user) },
      include: caseInclude,
    });
    if (!lifeCase) {
      throw new NotFoundException(`Life proposal case '${id}' not found or access denied`);
    }
    return this.toSafeCase(lifeCase);
  }

  async updateCase(id: string, dto: UpdateLifeQuotationCaseDto, user: RequestUser) {
    const existing = await this.findCaseForActor(id, user);

    if (existing.status === LifeCaseStatus.CONVERTED || existing.status === LifeCaseStatus.CANCELLED) {
      throw new BadRequestException(
        `Cannot update a Life case in status '${existing.status}'`,
      );
    }

    const updateData: Prisma.LifeQuotationCaseUpdateInput = {};

    if (dto.planCategory) updateData.planCategory = dto.planCategory;
    if (dto.status) updateData.status = dto.status;
    if (dto.occupation) updateData.proposerOccupation = dto.occupation;
    if (dto.annualIncome !== undefined) {
      updateData.annualIncome = new Prisma.Decimal(dto.annualIncome);
    }
    if (dto.address) updateData.addressSnapshot = { ...dto.address };

    if (dto.isLifeAssuredDifferent !== undefined) {
      updateData.isLifeAssuredDifferent = dto.isLifeAssuredDifferent;
    }
    if (dto.proposerRelation) updateData.proposerRelation = dto.proposerRelation;
    if (dto.lifeAssuredName !== undefined) updateData.lifeAssuredName = dto.lifeAssuredName;
    if (dto.lifeAssuredDob) updateData.lifeAssuredDob = new Date(dto.lifeAssuredDob);
    if (dto.lifeAssuredGender) updateData.lifeAssuredGender = dto.lifeAssuredGender;

    if (dto.smokerStatus) updateData.smokerStatus = dto.smokerStatus;
    if (dto.heightCm !== undefined) updateData.heightCm = new Prisma.Decimal(dto.heightCm);
    if (dto.weightKg !== undefined) updateData.weightKg = new Prisma.Decimal(dto.weightKg);

    const effectiveHeight = dto.heightCm ?? (existing.heightCm ? Number(existing.heightCm) : undefined);
    const effectiveWeight = dto.weightKg ?? (existing.weightKg ? Number(existing.weightKg) : undefined);
    const updatedBmi = this.calculateBmi(effectiveHeight, effectiveWeight);
    if (updatedBmi !== undefined) updateData.bmi = new Prisma.Decimal(updatedBmi);

    if (dto.occupationRiskCategory !== undefined) {
      updateData.occupationRiskCategory = dto.occupationRiskCategory;
    }
    if (dto.hasPreExistingIllness !== undefined) {
      updateData.hasPreExistingIllness = dto.hasPreExistingIllness;
    }
    if (dto.medicalHistoryDetails !== undefined) {
      updateData.medicalHistoryDetails = dto.medicalHistoryDetails;
    }
    if (dto.secondaryLifeAssured) {
      updateData.secondaryLifeAssured = { ...dto.secondaryLifeAssured };
    }

    if (dto.nomineeName !== undefined) updateData.nomineeName = dto.nomineeName;
    if (dto.nomineeRelation) updateData.nomineeRelation = dto.nomineeRelation;
    if (dto.nomineeDob) {
      const nomDob = new Date(dto.nomineeDob);
      const isMinor = this.calculateAge(nomDob) < 18;
      updateData.nomineeDob = nomDob;
      updateData.isNomineeMinor = isMinor;
    }
    if (dto.appointeeName !== undefined) updateData.appointeeName = dto.appointeeName;
    if (dto.appointeeDob) updateData.appointeeDob = new Date(dto.appointeeDob);
    if (dto.appointeeRelation) updateData.appointeeRelation = dto.appointeeRelation;

    if (dto.categoryData) updateData.categoryData = { ...dto.categoryData };

    const updated = await this.prisma.lifeQuotationCase.update({
      where: { id },
      data: updateData,
      include: caseInclude,
    });

    return this.toSafeCase(updated);
  }

  async addQuote(caseId: string, dto: AddLifeQuoteDto, user: RequestUser) {
    const lifeCase = await this.findCaseForActor(caseId, user);

    if (lifeCase.status === LifeCaseStatus.CONVERTED || lifeCase.status === LifeCaseStatus.CANCELLED) {
      throw new BadRequestException(
        `Cannot add quotations to a Life case in status '${lifeCase.status}'`,
      );
    }

    // Authoritative Financial Calculation
    const calcResult = this.calculationService.calculate({
      planCategory: lifeCase.planCategory,
      basePremium: dto.basePremium,
      discountAmount: dto.discountAmount,
      brokeragePercent: dto.brokeragePercent,
      riders: dto.riders,
    });

    const quotationCode = await this.numberingEngine.generateNext('QUOTATION');

    const createdQuotation = await this.prisma.$transaction(async (tx) => {
      // 1. Create Base Quotation
      const quote = await tx.quotation.create({
        data: {
          companyId: user.companyId,
          quotationCode,
          title: `${dto.insurerName} ${dto.productCode || 'Life Plan'} - ${lifeCase.caseCode}`,
          productType: 'LIFE',
          status: QuotationStatus.PENDING_APPROVAL,
          insurerName: dto.insurerName.trim(),
          insurerId: dto.insurerId || null,
          productCode: dto.productCode?.trim() || null,
          sumInsured: new Prisma.Decimal(dto.sumInsured),
          basePremium: new Prisma.Decimal(calcResult.totals.grossBasePremium),
          discountAmount: new Prisma.Decimal(calcResult.totals.totalCustomerDiscount),
          gstAmount: new Prisma.Decimal(calcResult.totals.totalGstAmount),
          totalPremium: new Prisma.Decimal(calcResult.totals.totalPayablePremium),
          policyTenure: dto.policyTermYears,
          policyTermYears: dto.policyTermYears,
          premiumPayingTermYears: dto.premiumPayingTermYears,
          lifePolicyType: dto.lifePolicyType,
          premiumPaymentType: dto.premiumPaymentType,
          premiumFrequency: dto.premiumFrequency,
          lifeCaseId: lifeCase.id,
          lifePlanCategory: lifeCase.planCategory,
          contactId: lifeCase.contactId,
          agentId: lifeCase.agentId,
          agentExternalCodeId: lifeCase.agentExternalCodeId,
          leadId: lifeCase.leadId,
          createdById: user.userId || user.id,
          expiryDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30-day quote validity
          calculationSnapshot: {
            ...calcResult.calculationSnapshot,
            quotationMetadata: dto.metadata || {},
          },
          lifeMetadata: {
            insurerName: dto.insurerName,
            productCode: dto.productCode,
            policyTermYears: dto.policyTermYears,
            premiumPayingTermYears: dto.premiumPayingTermYears,
            lifePolicyType: dto.lifePolicyType,
            premiumPaymentType: dto.premiumPaymentType,
            premiumFrequency: dto.premiumFrequency,
          },
        },
      });

      // 2. Create Line-Item Riders
      if (calcResult.riders.length > 0) {
        for (const rider of calcResult.riders) {
          await tx.lifeQuotationRider.create({
            data: {
              quotationId: quote.id,
              riderType: rider.riderType as any,
              riderName: rider.riderName,
              sumAssured: new Prisma.Decimal(rider.sumAssured),
              termYears: rider.termYears || null,
              pptYears: rider.pptYears || null,
              basePremium: new Prisma.Decimal(rider.basePremium),
              gstRate: new Prisma.Decimal(rider.gstRate),
              gstAmount: new Prisma.Decimal(rider.gstAmount),
              totalPremium: new Prisma.Decimal(rider.totalPremium),
              brokeragePercent: new Prisma.Decimal(rider.brokeragePercent),
              brokerageAmount: new Prisma.Decimal(rider.brokerageAmount),
              discountAmount: new Prisma.Decimal(rider.discountAmount),
              calculationSnapshot: rider.calculationSnapshot,
            },
          });
        }
      }

      // 3. Transition Case Status to QUOTED if still DRAFT
      if (lifeCase.status === LifeCaseStatus.DRAFT || lifeCase.status === LifeCaseStatus.PROPOSAL_CREATED) {
        await tx.lifeQuotationCase.update({
          where: { id: lifeCase.id },
          data: { status: LifeCaseStatus.QUOTED },
        });
      }

      return quote;
    });

    return this.getCase(caseId, user);
  }

  async selectQuote(caseId: string, quotationId: string, user: RequestUser) {
    const lifeCase = await this.findCaseForActor(caseId, user);

    if (lifeCase.status === LifeCaseStatus.CONVERTED || lifeCase.status === LifeCaseStatus.CANCELLED) {
      throw new BadRequestException(
        `Cannot select a quotation for a Life proposal case in status '${lifeCase.status}'`,
      );
    }

    const quotation = await this.prisma.quotation.findFirst({
      where: {
        id: quotationId,
        lifeCaseId: caseId,
        companyId: user.companyId,
        deletedAt: null,
      },
    });
    if (!quotation) {
      throw new NotFoundException(
        `Quotation '${quotationId}' does not belong to Life case '${caseId}'`,
      );
    }

    // Idempotent early-return if already selected and accepted
    if (lifeCase.selectedQuoteId === quotationId && quotation.status === QuotationStatus.ACCEPTED) {
      return this.toSafeCase(lifeCase);
    }

    const selectedCase = await this.prisma.$transaction(async (tx) => {
      // 1. Revert any previously selected quotation(s) for this case back to PENDING_APPROVAL
      await tx.quotation.updateMany({
        where: {
          lifeCaseId: caseId,
          companyId: user.companyId,
          id: { not: quotationId },
          status: QuotationStatus.ACCEPTED,
        },
        data: { status: QuotationStatus.PENDING_APPROVAL },
      });

      // 2. Mark winning quotation as ACCEPTED
      await tx.quotation.update({
        where: { id: quotationId },
        data: { status: QuotationStatus.ACCEPTED },
      });

      // 3. Update Case selectedQuoteId and status
      return tx.lifeQuotationCase.update({
        where: { id: lifeCase.id },
        data: {
          selectedQuoteId: quotationId,
          status: LifeCaseStatus.APPROVED,
        },
        include: caseInclude,
      });
    });

    return this.toSafeCase(selectedCase);
  }

  async recordPayment(caseId: string, dto: RecordLifePaymentDto, user: RequestUser) {
    const isAgent = user.role === RoleType.AGENT;
    const targetStatus =
      dto.status || (isAgent ? PaymentTrackingStatus.UNDER_PROCESS : PaymentTrackingStatus.PAID);

    if (isAgent && targetStatus === PaymentTrackingStatus.PAID) {
      throw new ForbiddenException(
        'Agents cannot verify payments as PAID. Back Office or Finance authorization required.',
      );
    }

    const lifeCase = await this.findCaseForActor(caseId, user);
    if (!lifeCase.selectedQuoteId) {
      throw new BadRequestException('Please select a quotation before recording payment');
    }

    const quotation = await this.prisma.quotation.findFirst({
      where: {
        id: lifeCase.selectedQuoteId,
        lifeCaseId: lifeCase.id,
        companyId: user.companyId,
      },
    });
    if (!quotation) {
      throw new NotFoundException(`Selected quotation '${lifeCase.selectedQuoteId}' not found`);
    }

    const payableAmount = Number(quotation.totalPremium);
    const submittedAmount = dto.amount !== undefined ? Number(dto.amount) : payableAmount;

    if (targetStatus === PaymentTrackingStatus.PAID) {
      if (Math.abs(submittedAmount - payableAmount) > 0.01) {
        throw new BadRequestException(
          `Payment amount ₹${submittedAmount} does not match authoritative quotation premium ₹${payableAmount}`,
        );
      }
      if (!dto.referenceNumber?.trim()) {
        throw new BadRequestException('Payment reference number / UTR is mandatory before marking as PAID');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      const existingPayment = await tx.motorPaymentRecord.findUnique({
        where: { quotationId: quotation.id },
      });

      const paymentData = {
        companyId: user.companyId,
        status: targetStatus,
        amount: new Prisma.Decimal(submittedAmount),
        paymentMethod: dto.paymentMethod.trim() as any,
        referenceNumber: dto.referenceNumber.trim(),
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
          data: {
            ...paymentData,
            quotationId: quotation.id,
          },
        });
      }
    });

    return this.getCase(caseId, user);
  }
}
