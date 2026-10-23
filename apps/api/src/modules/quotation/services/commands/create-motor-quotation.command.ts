import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../../../database/prisma.service';
import { CreateMotorCaptureDto } from '../../dto/create-motor-capture.dto';
import type { RequestUser } from '../../../auth/decorators/current-user.decorator';
import { MotorCalculationService } from '../../../motor/services/motor-calculation.service';
import { MotorRuleEngineService } from '../../../motor/services/motor-rule-engine.service';
import { ContactsService } from '../../../contacts/services/contacts.service';
import { VehicleDataService } from '../../../motor/services/vehicle-data.service';
import { NumberingEngineService } from '../../../administration/services/numbering-engine/numbering-engine.service';
import { VehicleCategory } from '@prisma/client';
import { TenantResourceAuthorizationService } from '../../../auth/services/tenant-resource-authorization.service';

@Injectable()
export class CreateMotorQuotationCommand {
  constructor(
    private readonly prisma: PrismaService,
    private readonly motorCalculationService: MotorCalculationService,
    private readonly motorRuleEngineService: MotorRuleEngineService,
    private readonly contactsService: ContactsService,
    private readonly vehicleDataService: VehicleDataService,
    private readonly numberingEngine: NumberingEngineService,
    private readonly tenantAuthService: TenantResourceAuthorizationService,
  ) {}

  async execute(dto: CreateMotorCaptureDto, user: RequestUser) {
    const companyId = user.companyId || (user as any).organizationId;
    if (!companyId) {
      throw new ForbiddenException(
        'Tenant organizational context is required to capture quotation',
      );
    }

    // ── 1. Journey 1:1 Binding & Expiry Invariant (Section 3.1, A1, A2) ──
    let journey: any = null;
    if (dto.journeyId) {
      journey = await this.tenantAuthService.assertMotorJourneyAccess(dto.journeyId, user);

      // TTL check
      if (journey.expiresAt < new Date()) {
        throw new BadRequestException(
          'Motor journey has expired (24h TTL exceeded). Please start a new journey.',
        );
      }

      // A2: 1:1 binding constraint (One journey -> exactly ONE quotation)
      if (journey.quotationId) {
        throw new ConflictException(
          'Motor journey has already captured a quotation (1:1 constraint). Duplicate quote capture on the same journey is prohibited.',
        );
      }

      if (journey.status !== 'IN_PROGRESS' && journey.status !== 'ACTIVE') {
        throw new BadRequestException(
          `Motor journey is no longer in progress (${journey.status})`,
        );
      }
    }

    // ── 1.1 Tenant Resource Validation (Lead, Customer, Vehicle) ──
    if (dto.leadId) {
      await this.tenantAuthService.assertTenantResource('Lead', dto.leadId, user);
    }
    if (dto.customerId) {
      await this.tenantAuthService.assertTenantResource('Customer', dto.customerId, user);
    }
    if (dto.vehicleId) {
      await this.tenantAuthService.assertTenantResource('Vehicle', dto.vehicleId, user);
    }
    let activeCaseId = dto.caseId;
    let existingCase: any = null;
    if (activeCaseId) {
      existingCase = await this.prisma.motorQuotationCase.findFirst({
        where: { id: activeCaseId, companyId },
      });
      if (!existingCase) {
        throw new NotFoundException(
          `MotorQuotationCase '${activeCaseId}' not found or tenant access denied`,
        );
      }
      if (['CANCELLED', 'COMPLETED'].includes(existingCase.status)) {
        throw new BadRequestException(
          `Cannot create quotation for a ${existingCase.status} case '${activeCaseId}'`,
        );
      }
    }

    // ── 2. Contact Resolution (Tenant-Scoped) ──
    let contactId = dto.contactId;
    if (contactId) {
      await this.tenantAuthService.assertTenantResource('Contact', contactId, user);
    } else if (dto.leadId) {
      const lead = await this.prisma.lead.findFirst({
        where: { id: dto.leadId, companyId, deletedAt: null },
        select: { contactId: true },
      });
      contactId = lead?.contactId || undefined;
    }

    const proposer = dto.proposerDetails || {};

    // MOTOR-0042: Server-side validation for mobile, email, PAN, and lead source
    if (proposer['mobileNumber']) {
      const cleanMobile = String(proposer['mobileNumber']).trim().replace(/\D/g, '');
      if (cleanMobile.length !== 10) {
        throw new BadRequestException(
          `Invalid mobile number format: expected 10 digits, received ${cleanMobile}`,
        );
      }
    }
    if (proposer['emailId'] || proposer['email']) {
      const email = String(proposer['emailId'] || proposer['email']).trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        throw new BadRequestException(`Invalid email format: ${email}`);
      }
    }
    if (proposer['panNumber']) {
      const pan = String(proposer['panNumber']).trim().toUpperCase();
      const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
      if (!panRegex.test(pan)) {
        throw new BadRequestException(
          `Invalid PAN format: expected 10 characters (e.g. ABCDE1234F), received ${pan}`,
        );
      }
    }
    // MOTOR-0041: Relationship Manager derived from authenticated user / assignment if missing
    if (!proposer['relationshipManager']) {
      proposer['relationshipManager'] = (user as any).name || (user as any).email || 'Authenticated User';
    }

    if (!contactId && proposer['mobileNumber']) {
      const existingByPhone = await this.prisma.contact.findFirst({
        where: {
          phone: String(proposer['mobileNumber']).trim(),
          companyId,
          deletedAt: null,
        },
        select: { id: true },
      });
      contactId = existingByPhone?.id;
    }

    if (!contactId && proposer['emailId']) {
      const existingByEmail = await this.prisma.contact.findFirst({
        where: {
          email: String(proposer['emailId']).trim(),
          companyId,
          deletedAt: null,
        },
        select: { id: true },
      });
      contactId = existingByEmail?.id;
    }

    if (!contactId) {
      const mobileNumber = String(proposer['mobileNumber'] || '').trim();
      if (!mobileNumber) {
        throw new BadRequestException(
          'Proposer mobile number is required to link or create a customer contact.',
        );
      }
      const [firstName, ...rest] = (
        proposer['customerName'] || 'Motor Customer'
      ).split(' ');
      const newContact = await this.contactsService.create(
        {
          firstName: firstName || 'Customer',
          lastName: rest.join(' ') || '',
          email: proposer['emailId']
            ? String(proposer['emailId']).trim()
            : undefined,
          phone: mobileNumber,
          panNumber: proposer['panNumber']
            ? String(proposer['panNumber']).trim()
            : undefined,
          type: 'INDIVIDUAL',
        },
        user.id,
      );
      contactId = newContact.id;
    }

    // ── 3. Agent Assignment (MOTOR-REG-01, MOTOR-REG-02, Phase 26) ──
    let assignedAgentId: string | null = null;
    let manualAgentSnapshot: any = null;

    if (dto.manualAgent?.isManual) {
      // Phase 26 & MOTOR-REG-02: Strict validation for manual agent
      const name = (
        dto.manualAgent.manualAgentName ||
        (dto.manualAgent as any).name
      )?.trim();
      const code = (
        dto.manualAgent.manualAgentCode ||
        (dto.manualAgent as any).code ||
        'MANUAL-AGENT'
      )?.trim();
      const contact = (
        dto.manualAgent.manualAgentContact ||
        (dto.manualAgent as any).contact
      )?.trim();
      const rawSource = (
        dto.manualAgent.manualAgentSource ||
        (dto.manualAgent as any).source ||
        'DIRECT'
      )
        .trim()
        .toUpperCase();

      if (!name || name.length < 2 || name.length > 100) {
        throw new BadRequestException(
          'Manual agent requires manualAgentName (2-100 characters)',
        );
      }
      if (!code || code.length < 2 || code.length > 30) {
        throw new BadRequestException(
          'Manual agent requires manualAgentCode (2-30 characters)',
        );
      }
      if (!contact || contact.length < 5 || contact.length > 100) {
        throw new BadRequestException(
          'Manual agent requires valid manualAgentContact (5-100 characters)',
        );
      }
      if (!['DIRECT', 'BROKER', 'REFERRAL'].includes(rawSource)) {
        throw new BadRequestException(
          'Manual agent requires manualAgentSource to be DIRECT, BROKER, or REFERRAL',
        );
      }

      assignedAgentId = null;
      manualAgentSnapshot = {
        isManual: true,
        name,
        code,
        contact,
        source: rawSource,
        manualAgentName: name,
        manualAgentCode: code,
        manualAgentContact: contact,
        manualAgentSource: rawSource,
      };
    } else if (dto.agentId) {
      // Phase 1.2 & MOTOR-REG-01: Validates tenant match and active status
      const agent = await this.tenantAuthService.assertAssignableAgent(
        dto.agentId,
        user,
      );
      assignedAgentId = agent.id;
    }
    // Do NOT silently overwrite with lead.agentId!

    // ── 4. Vehicle Details & Canonical Link ──
    const vehicleDetails = (dto.vehicleDetails || {}) as any;
    let vehicleId: string | null = null;

    if (contactId) {
      const vehicleCategoryEnum = dto.vehicleCategory as VehicleCategory;
      const upserted = await this.vehicleDataService.upsertVehicle(
        {
          contactId,
          category: vehicleCategoryEnum,
          registrationNumber: dto.registrationNumber,
          makeModel: vehicleDetails.makeModel,
          fuelType: vehicleDetails.fuelType,
          manufactureYearMonth: vehicleDetails.manufactureYearMonth,
          dateOfRegistration: vehicleDetails.dateOfRegistration,
          engineNumber: vehicleDetails.engineNumber,
          chassisNumber: vehicleDetails.chassisNumber,
          rtoLocation: vehicleDetails.rtoLocation,
          categorySpecificData: vehicleDetails.categorySpecificData,
        },
        user.id,
        companyId,
      );
      vehicleId = upserted.id;
    }

    // ── 5. Authoritative Pricing via MotorCalculationService ──
    const policyDetails = (dto.policyDetails || {}) as any;
    const saodVerification = (dto.saodVerification || {}) as any;

    const policyTypeMap: Record<
      string,
      'THIRD_PARTY_ONLY' | 'STANDALONE_OD' | 'PACKAGE_COMPREHENSIVE'
    > = {
      TP_ONLY: 'THIRD_PARTY_ONLY',
      SAOD: 'STANDALONE_OD',
      PACKAGE: 'PACKAGE_COMPREHENSIVE',
      THIRD_PARTY_ONLY: 'THIRD_PARTY_ONLY',
      STANDALONE_OD: 'STANDALONE_OD',
      PACKAGE_COMPREHENSIVE: 'PACKAGE_COMPREHENSIVE',
    };

    const isVehicleNew = vehicleDetails.vehicleStatus === 'NEW';
    const policyType = policyTypeMap[dto.policyType] || 'PACKAGE_COMPREHENSIVE';

    // MOTOR-0060 & MOTOR-REG-03: Authoritative server-side SAOD eligibility validation
    if (policyType === 'STANDALONE_OD') {
      const activeTpVerification = {
        activeTpPolicyNumber: saodVerification.tpPolicyNumber || policyDetails.activeTpPolicyNumber,
        activeTpInsurer: saodVerification.tpInsurer || policyDetails.activeTpInsurer,
        activeTpStartDate: saodVerification.tpStartDate || policyDetails.activeTpStartDate,
        activeTpExpiryDate: saodVerification.tpExpiryDate || policyDetails.activeTpExpiryDate,
        activeTpVerificationMethod: saodVerification.verificationMethod || policyDetails.activeTpVerificationMethod,
        activeTpVerificationStatus: saodVerification.verificationStatus || policyDetails.activeTpVerificationStatus,
        activeTpVerifiedByUserConfirmed:
          saodVerification.verifiedByUserConfirmed === true ||
          policyDetails.activeTpVerifiedByUserConfirmed === true,
      };

      if (
        !activeTpVerification.activeTpVerificationMethod ||
        activeTpVerification.activeTpVerificationStatus !== 'VERIFIED' ||
        activeTpVerification.activeTpVerifiedByUserConfirmed !== true
      ) {
        throw new BadRequestException({
          statusCode: 400,
          error: 'Bad Request',
          errorCode: 'ACTIVE_TP_VERIFICATION_REQUIRED',
          message: 'SAOD quotation creation requires verified and explicitly confirmed active TP details.',
        });
      }

      this.motorRuleEngineService.validateSaodEligibility({
        vehicleStatus: isVehicleNew ? 'NEW' : 'EXISTING',
        activeTpPolicyNumber: activeTpVerification.activeTpPolicyNumber,
        activeTpInsurer: activeTpVerification.activeTpInsurer,
        activeTpExpiryDate: activeTpVerification.activeTpExpiryDate,
      });
    }

    const prevPolicy = dto.previousPolicyDetails || {};
    const claimInExpiring =
      String(policyDetails.claimInExpiringPolicy || prevPolicy.claimInPreviousYear || '').toLowerCase() === 'yes' ||
      Boolean(prevPolicy.claimInPreviousYear);

    // ── 5. Authoritative Underwriting Rules & NCB Evaluation ──
    const declaredNcb = isVehicleNew ? 0 : Number(dto.ncbPercentage ?? policyDetails.ncbPercentage ?? 0);
    const validSlabs = [0, 20, 25, 35, 45, 50];
    if (!validSlabs.includes(declaredNcb)) {
      throw new BadRequestException(
        `INVALID_NCB_PERCENTAGE: NCB must be one of ${validSlabs.join(', ')}%, received ${declaredNcb}%`,
      );
    }

    const ruleResult = this.motorRuleEngineService.evaluateQuotation({
      vehicleStatus: isVehicleNew ? 'NEW' : 'EXISTING',
      newPolicyType: dto.policyType as any,
      previousPolicyType: prevPolicy.policyType,
      policyExpiryDate: prevPolicy.policyExpiryDate ? new Date(prevPolicy.policyExpiryDate) : null,
      claimInPreviousYear: claimInExpiring,
      ownershipTransfer: Boolean(policyDetails.ownershipTransfer || prevPolicy.ownershipTransfer),
      previousPolicyTransferred: Boolean(policyDetails.previousPolicyTransferred || prevPolicy.previousPolicyTransferred),
      eligibleNcbPercentage: declaredNcb,
      tpExpiryDate: saodVerification.tpExpiryDate ? new Date(saodVerification.tpExpiryDate) : null,
      odExpiryDate: saodVerification.odExpiryDate ? new Date(saodVerification.odExpiryDate) : null,
    });

    const authoritativeNcb = ruleResult.ncb;

    // SAOD manual overrides must come only from explicit override properties.
    // Legacy display fields also contain calculated values and must not freeze stale totals.
    const parseOptionalAmount = (...values: unknown[]): number | undefined => {
      for (const value of values) {
        if (value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))) {
          return Number(value);
        }
      }
      return undefined;
    };
    const saodOverrides = policyType === 'STANDALONE_OD'
      ? {
          odPremium: parseOptionalAmount(policyDetails.odPremiumAmount, policyDetails.odBasePremiumOverride),
          ncbDiscount: parseOptionalAmount(policyDetails.ncbDiscountOverride),
          addonPremium: parseOptionalAmount(policyDetails.addonPremiumOverride),
          netOdPremium: parseOptionalAmount(policyDetails.netOdPremiumOverride),
          gstAmount: parseOptionalAmount(policyDetails.gstAmountOverride),
          totalPremiumOverride: parseOptionalAmount(policyDetails.totalPremiumOverride),
        }
      : undefined;

    // ── 6. Authoritative Pricing via MotorCalculationService ──
    const calculationInput: any = {
      vehicleCategory: dto.vehicleCategory,
      vehicleSubType: vehicleDetails.vehicleSubType || vehicleDetails.vehicleType,
      vehicleStatus: isVehicleNew ? 'NEW' : 'EXISTING',
      policyType,
      policyTenure: Number(policyDetails.policyTenure || 1) || 1,
      idv: dto.idv || Number(policyDetails.insuredDeclaredValue || 0) || undefined,
      ncbPercent: authoritativeNcb,
      claimInExpiringPolicy: claimInExpiring,
      paCover: policyDetails.paCoverOwner !== false,
      paidDriverLiability:
        String(policyDetails.legalLiabilityPaidDriver || '').toLowerCase() === 'yes',
      addons: Array.isArray(policyDetails.addonsSelected)
        ? policyDetails.addonsSelected
            .map((addon: any) => {
              const code = typeof addon === 'string' ? addon : addon.addonCode || addon.code;
              return {
                addonCode: code,
                ...(typeof addon === 'object' && addon.manualPrice !== undefined
                  ? { manualPrice: Number(addon.manualPrice) }
                  : {}),
                ...(typeof addon === 'object' && addon.amount !== undefined
                  ? { amount: Number(addon.amount) }
                  : (policyDetails.addonPrices && policyDetails.addonPrices[code] !== undefined
                      ? { amount: Number(policyDetails.addonPrices[code]) }
                      : {})),
                ...(typeof addon === 'object' && addon.discountPercent !== undefined
                  ? { discountPercent: Number(addon.discountPercent) }
                  : (policyDetails.addonDiscounts && policyDetails.addonDiscounts[code] !== undefined
                      ? { discountPercent: Number(policyDetails.addonDiscounts[code]) }
                      : {})),
                ...(typeof addon === 'object' && addon.gstRate !== undefined
                  ? { gstRate: Number(addon.gstRate) }
                  : (policyDetails.addonGstRates && policyDetails.addonGstRates[code] !== undefined
                      ? { gstRate: Number(policyDetails.addonGstRates[code]) }
                      : {})),
              };
            })
            .filter((addon: any) => addon.addonCode)
        : [],
      activeTpPolicyNumber: saodVerification.tpPolicyNumber || policyDetails.activeTpPolicyNumber || undefined,
      activeTpExpiryDate: saodVerification.tpExpiryDate || undefined,
      activeTpInsurer: saodVerification.tpInsurer || policyDetails.activeTpInsurer || undefined,
      activeTpStartDate: saodVerification.tpStartDate || policyDetails.activeTpStartDate || undefined,
      activeTpVerificationMethod: saodVerification.verificationMethod || policyDetails.activeTpVerificationMethod || undefined,
      activeTpVerificationStatus: saodVerification.verificationStatus || policyDetails.activeTpVerificationStatus || undefined,
      activeTpVerifiedByUserConfirmed:
        saodVerification.verifiedByUserConfirmed === true ||
        policyDetails.activeTpVerifiedByUserConfirmed === true,
      odDiscountPercent: policyDetails.odDiscountPercent !== undefined && policyDetails.odDiscountPercent !== ''
        ? Number(policyDetails.odDiscountPercent)
        : undefined,
      commercialDiscountPercent: policyDetails.commercialDiscountPercent !== undefined && policyDetails.commercialDiscountPercent !== ''
        ? Number(policyDetails.commercialDiscountPercent)
        : undefined,
      commercialAdjustment: (policyDetails as any).commercialAdjustment !== undefined && (policyDetails as any).commercialAdjustment !== '' && !isNaN(Number((policyDetails as any).commercialAdjustment))
        ? Number((policyDetails as any).commercialAdjustment)
        : (policyDetails.commercialAdjustmentAmount !== undefined && policyDetails.commercialAdjustmentAmount !== '' && !isNaN(Number(policyDetails.commercialAdjustmentAmount))
            ? Number(policyDetails.commercialAdjustmentAmount)
            : undefined),
      commercialAdjustmentAmount: policyDetails.commercialAdjustmentAmount !== undefined && policyDetails.commercialAdjustmentAmount !== '' && !isNaN(Number(policyDetails.commercialAdjustmentAmount))
        ? Number(policyDetails.commercialAdjustmentAmount)
        : ((policyDetails as any).commercialAdjustment !== undefined && (policyDetails as any).commercialAdjustment !== '' && !isNaN(Number((policyDetails as any).commercialAdjustment))
            ? Number((policyDetails as any).commercialAdjustment)
            : undefined),
      commercialAdjustmentDirection: (policyDetails as any).commercialAdjustmentDirection || (policyDetails as any).commercialAdjustmentType || 'SUBTRACT',
      tpDiscountPercent: policyDetails.tpDiscountPercent !== undefined && policyDetails.tpDiscountPercent !== ''
        ? Number(policyDetails.tpDiscountPercent)
        : 0,
      discountPercent: policyDetails.discountPercent !== undefined && policyDetails.discountPercent !== ''
        ? Number(policyDetails.discountPercent)
        : (policyDetails.commercialDiscountPercent !== undefined && policyDetails.commercialDiscountPercent !== ''
            ? Number(policyDetails.commercialDiscountPercent)
            : (policyDetails.odDiscountPercent !== undefined && policyDetails.odDiscountPercent !== ''
                ? Number(policyDetails.odDiscountPercent)
                : 0)),
      discountReason: policyDetails.discountReason || undefined,
      previousPolicyExpiryDate: prevPolicy.policyExpiryDate || undefined,
      policyStartDate: policyDetails.policyStartDate || undefined,
      gstRate: policyDetails.gstRate !== undefined && policyDetails.gstRate !== null && policyDetails.gstRate !== ''
        ? Number(policyDetails.gstRate)
        : undefined,
      odPremium: policyType === 'STANDALONE_OD'
        ? saodOverrides?.odPremium
        : ((policyDetails as any).odPremium !== undefined && (policyDetails as any).odPremium !== '' && !isNaN(Number((policyDetails as any).odPremium))
            ? Number((policyDetails as any).odPremium)
            : (policyDetails.odPremiumAmount !== undefined && policyDetails.odPremiumAmount !== '' && !isNaN(Number(policyDetails.odPremiumAmount))
                ? Number(policyDetails.odPremiumAmount)
                : undefined)),
      odPremiumAmount: policyType === 'STANDALONE_OD'
        ? saodOverrides?.odPremium
        : (policyDetails.odPremiumAmount !== undefined && policyDetails.odPremiumAmount !== '' && !isNaN(Number(policyDetails.odPremiumAmount))
            ? Number(policyDetails.odPremiumAmount)
            : ((policyDetails as any).odPremium !== undefined && (policyDetails as any).odPremium !== '' && !isNaN(Number((policyDetails as any).odPremium))
                ? Number((policyDetails as any).odPremium)
                : undefined)),
      editedOdRate: undefined,
      annualTpPremium: policyDetails.editedTpAnnualPremium !== undefined && policyDetails.editedTpAnnualPremium !== '' && !isNaN(Number(policyDetails.editedTpAnnualPremium))
        ? Number(policyDetails.editedTpAnnualPremium)
        : (policyDetails.editedTpPremium !== undefined && policyDetails.editedTpPremium !== '' && !isNaN(Number(policyDetails.editedTpPremium))
            ? Number(policyDetails.editedTpPremium)
            : undefined),
      editedTpAnnualPremium: policyDetails.editedTpAnnualPremium !== undefined && policyDetails.editedTpAnnualPremium !== '' && !isNaN(Number(policyDetails.editedTpAnnualPremium))
        ? Number(policyDetails.editedTpAnnualPremium)
        : (policyDetails.editedTpPremium !== undefined && policyDetails.editedTpPremium !== '' && !isNaN(Number(policyDetails.editedTpPremium))
            ? Number(policyDetails.editedTpPremium)
            : undefined),
      editedTpPremium: policyDetails.editedTpPremium !== undefined && policyDetails.editedTpPremium !== '' && !isNaN(Number(policyDetails.editedTpPremium))
        ? Number(policyDetails.editedTpPremium)
        : undefined,
      editedPaPremium: policyDetails.editedPaPremium !== undefined && policyDetails.editedPaPremium !== '' && !isNaN(Number(policyDetails.editedPaPremium))
        ? Number(policyDetails.editedPaPremium)
        : undefined,
      odGstRate: policyDetails.odGstRate !== undefined && policyDetails.odGstRate !== '' && !isNaN(Number(policyDetails.odGstRate))
        ? Number(policyDetails.odGstRate)
        : undefined,
      tpGstRate: policyDetails.tpGstRate !== undefined && policyDetails.tpGstRate !== '' && !isNaN(Number(policyDetails.tpGstRate))
        ? Number(policyDetails.tpGstRate)
        : undefined,
      paGstRate: policyDetails.paGstRate !== undefined && policyDetails.paGstRate !== '' && !isNaN(Number(policyDetails.paGstRate))
        ? Number(policyDetails.paGstRate)
        : undefined,
      odBasePremium: policyType === 'STANDALONE_OD'
        ? saodOverrides?.odPremium
        : ((policyDetails as any).odBasePremium !== undefined && (policyDetails as any).odBasePremium !== '' && !isNaN(Number((policyDetails as any).odBasePremium))
            ? Number((policyDetails as any).odBasePremium)
            : ((policyDetails as any).odPremium !== undefined && (policyDetails as any).odPremium !== '' && !isNaN(Number((policyDetails as any).odPremium))
                ? Number((policyDetails as any).odPremium)
                : undefined)),
      ncbDiscount: policyType === 'STANDALONE_OD'
        ? saodOverrides?.ncbDiscount
        : ((policyDetails as any).ncbDiscountOverride !== undefined && (policyDetails as any).ncbDiscountOverride !== '' && !isNaN(Number((policyDetails as any).ncbDiscountOverride))
            ? Number((policyDetails as any).ncbDiscountOverride)
            : ((policyDetails as any).ncbDiscount !== undefined && (policyDetails as any).ncbDiscount !== '' && !isNaN(Number((policyDetails as any).ncbDiscount))
                ? Number((policyDetails as any).ncbDiscount)
                : ((policyDetails as any).ncbDiscountAmount !== undefined && (policyDetails as any).ncbDiscountAmount !== '' && !isNaN(Number((policyDetails as any).ncbDiscountAmount))
                    ? Number((policyDetails as any).ncbDiscountAmount)
                    : undefined))),
      addonPremium: policyType === 'STANDALONE_OD'
        ? saodOverrides?.addonPremium
        : ((policyDetails as any).addonPremiumOverride !== undefined && (policyDetails as any).addonPremiumOverride !== '' && !isNaN(Number((policyDetails as any).addonPremiumOverride))
            ? Number((policyDetails as any).addonPremiumOverride)
            : ((policyDetails as any).addonPremium !== undefined && (policyDetails as any).addonPremium !== '' && !isNaN(Number((policyDetails as any).addonPremium))
                ? Number((policyDetails as any).addonPremium)
                : ((policyDetails as any).addOnsPremium !== undefined && (policyDetails as any).addOnsPremium !== '' && !isNaN(Number((policyDetails as any).addOnsPremium))
                    ? Number((policyDetails as any).addOnsPremium)
                    : undefined))),
      netOdPremium: policyType === 'STANDALONE_OD'
        ? saodOverrides?.netOdPremium
        : ((policyDetails as any).netOdPremiumOverride !== undefined && (policyDetails as any).netOdPremiumOverride !== '' && !isNaN(Number((policyDetails as any).netOdPremiumOverride))
            ? Number((policyDetails as any).netOdPremiumOverride)
            : ((policyDetails as any).netOdPremium !== undefined && (policyDetails as any).netOdPremium !== '' && !isNaN(Number((policyDetails as any).netOdPremium))
                ? Number((policyDetails as any).netOdPremium)
                : ((policyDetails as any).odPremiumNet !== undefined && (policyDetails as any).odPremiumNet !== '' && !isNaN(Number((policyDetails as any).odPremiumNet))
                    ? Number((policyDetails as any).odPremiumNet)
                    : undefined))),
      gstAmount: policyType === 'STANDALONE_OD'
        ? saodOverrides?.gstAmount
        : ((policyDetails as any).gstAmountOverride !== undefined && (policyDetails as any).gstAmountOverride !== '' && !isNaN(Number((policyDetails as any).gstAmountOverride))
            ? Number((policyDetails as any).gstAmountOverride)
            : ((policyDetails as any).gstAmount !== undefined && (policyDetails as any).gstAmount !== '' && !isNaN(Number((policyDetails as any).gstAmount))
                ? Number((policyDetails as any).gstAmount)
                : ((policyDetails as any).odGstAmount !== undefined && (policyDetails as any).odGstAmount !== '' && !isNaN(Number((policyDetails as any).odGstAmount))
                    ? Number((policyDetails as any).odGstAmount)
                    : undefined))),
      totalPremiumOverride: policyType === 'STANDALONE_OD'
        ? saodOverrides?.totalPremiumOverride
        : ((policyDetails as any).totalPremiumOverride !== undefined && (policyDetails as any).totalPremiumOverride !== '' && !isNaN(Number((policyDetails as any).totalPremiumOverride))
            ? Number((policyDetails as any).totalPremiumOverride)
            : ((policyDetails as any).totalPremium !== undefined && (policyDetails as any).totalPremium !== '' && !isNaN(Number((policyDetails as any).totalPremium))
                ? Number((policyDetails as any).totalPremium)
                : ((policyDetails as any).totalPremiumInclGST !== undefined && (policyDetails as any).totalPremiumInclGST !== '' && !isNaN(Number((policyDetails as any).totalPremiumInclGST))
                    ? Number((policyDetails as any).totalPremiumInclGST)
                    : ((policyDetails as any).finalPayableAmount !== undefined && (policyDetails as any).finalPayableAmount !== '' && !isNaN(Number((policyDetails as any).finalPayableAmount))
                        ? Number((policyDetails as any).finalPayableAmount)
                        : undefined)))),
      overrides: Array.isArray((policyDetails as any).overrides)
        ? (policyDetails as any).overrides
        : (Array.isArray((dto as any).overrides) ? (dto as any).overrides : undefined),
    };

    const calcResult = await this.motorCalculationService.calculate(calculationInput);

    const quotationCode = await this.numberingEngine.generateNext('QUOTATION');

    const odCommissionPercent = Number(
      policyDetails.odCommissionPercent ?? 0,
    );
    const tpCommissionPercent = Number(
      policyDetails.tpCommissionPercent ?? 0,
    );

    const motorMetadata = {
      vehicleCategory: dto.vehicleCategory,
      policyType: dto.policyType,
      registrationNumber: dto.registrationNumber,
      proposerDetails: dto.proposerDetails,
      vehicleDetails: dto.vehicleDetails,
      policyDetails: dto.policyDetails,
      saodVerification: dto.saodVerification,
      previousPolicyDetails: dto.previousPolicyDetails,
      discounts: {
        odDiscountPercent: calcResult.outputs.discounts?.od?.percent ?? 0,
        odDiscountAmount: calcResult.outputs.odDiscountAmount ?? 0,
        tpDiscountPercent: calcResult.outputs.discounts?.tp?.percent ?? 0,
        tpDiscountAmount: calcResult.outputs.tpDiscountAmount ?? 0,
        addonDiscountAmount: calcResult.outputs.payableSummary?.addonDiscountAmount ?? 0,
        commercialDiscountPercent: calcResult.outputs.discounts?.commercial?.percent ?? 0,
        commercialDiscountAmount: calcResult.outputs.commercialDiscountAmount ?? 0,
        commercialAdjustmentAmount: calcResult.outputs.payableSummary?.commercialAdjustmentAmount ?? calcResult.outputs.commercialDiscountAmount ?? 0,
        commercialAdjustmentDirection: calcResult.outputs.payableSummary?.commercialAdjustmentDirection ?? 'SUBTRACT',
        totalDiscountAmount: calcResult.outputs.totalDiscountAmount ?? 0,
      },
      commissions: {
        odCommissionPercent,
        tpCommissionPercent,
      },
      manualAgent: manualAgentSnapshot,
      ruleResult,
      documents: dto.documents,
      workflowStatus: 'READY_FOR_PROPOSAL',
      capturedBy: user.id,
      capturedAt: new Date().toISOString(),
    };

    // ── 7. Atomic Quotation & Journey Binding ──
    let quotation;
    try {
      quotation = await this.prisma.$transaction(async (tx) => {
        // Ensure canonical parent MotorQuotationCase exists (MOTOR-0013: Prevent orphan quotations)
        if (!activeCaseId) {
          const generatedCaseCode = await this.numberingEngine.generateNext('MOTOR_CASE');
          const autoCase = await tx.motorQuotationCase.create({
            data: {
              companyId,
              caseCode: generatedCaseCode,
              category: dto.vehicleCategory as any,
              vehicleStatus: isVehicleNew ? 'NEW' : 'EXISTING',
              registrationNumber: dto.registrationNumber || null,
              contactId,
              vehicleId,
              leadId: dto.leadId || null,
              journeyId: journey?.id || null,
              customerSnapshot: proposer as any,
              vehicleSnapshot: vehicleDetails as any,
              previousPolicySnapshot: prevPolicy ? (prevPolicy as any) : undefined,
              status: 'QUOTED',
            },
          });
          activeCaseId = autoCase.id;
        } else if (existingCase && existingCase.status === 'OPEN') {
          await tx.motorQuotationCase.update({
            where: { id: activeCaseId },
            data: { status: 'QUOTED' },
          });
        }

        const createdQuotation = await tx.quotation.create({
          data: {
            companyId,
            quotationCode,
            title: `Motor ${dto.vehicleCategory} — ${dto.policyType} | ${dto.registrationNumber || 'New Vehicle'}`,
            productType: 'MOTOR',
            insurerName: dto.insurerName,
            sumInsured: dto.idv || 0,
            basePremium: calcResult.outputs.basePremium,
            gstAmount: calcResult.outputs.totalGst,
            totalPremium: calcResult.outputs.totalPremium,
            ncbPercentage: calcResult.inputs.effectiveNcb,
            vehicleCategory: dto.vehicleCategory as any,
            policyType: dto.policyType,
            registrationNumber: dto.registrationNumber || null,
            policyTenure: calcResult.inputs.tpTenure,
            calculationSnapshot: calcResult as any,
            calculationVersion: calcResult.calculationVersion,
            issuanceStatus: 'DRAFT',
            // Backend is SOLE authority for workflowState — derived from rule engine result,
            // NOT from client-supplied status field. Client-driven workflowState is prohibited.
            workflowState: ruleResult.inspectionRequired
              ? 'INSPECTION_REQUIRED'
              : 'READY_FOR_PROPOSAL',
            motorMetadata: motorMetadata as any,
            expiryDate: new Date(Date.now() + 30 * 86400000),
            contactId,
            vehicleId,
            leadId: dto.leadId || null,
            caseId: activeCaseId,
            agentId: assignedAgentId,
            createdById: user.id,
          },
        });

        // Persist SAOD verification evidence against the quotation so the
        // confirmed verifier, method, timestamps and TP details are auditable.
        if (policyType === 'STANDALONE_OD') {
          await tx.saodTpVerification.create({
            data: {
              quotationId: createdQuotation.id,
              tpInsurer: saodVerification.tpInsurer,
              tpPolicyNumber: saodVerification.tpPolicyNumber,
              tpStartDate: new Date(saodVerification.tpStartDate),
              tpExpiryDate: new Date(saodVerification.tpExpiryDate),
              verificationStatus: 'VERIFIED',
              verificationMethod: saodVerification.verificationMethod,
              evidenceDocumentUrl: saodVerification.evidenceDocumentUrl || null,
              verifierNotes: saodVerification.verifierNotes || null,
              verifiedById: user.id,
              verifiedAt: new Date(),
            },
          });
        }

      // Bind journey 1:1
      if (journey) {
        await tx.motorJourney.update({
          where: { id: journey.id },
          data: {
            quotationId: createdQuotation.id,
            status: 'QUOTED',
          },
        });
      }

      // Create canonical previous policy record if supplied
      if (prevPolicy.policyType && prevPolicy.policyType !== 'NOT_AVAILABLE') {
        const pType = ['COMPREHENSIVE', 'THIRD_PARTY', 'SAOD'].includes(prevPolicy.policyType)
          ? (prevPolicy.policyType as any)
          : null;
        if (pType) {
          await tx.motorPreviousPolicy.create({
            data: {
              quotationId: createdQuotation.id,
              previousPolicyType: pType,
              previousInsurerName: prevPolicy.insurerName || 'Previous Insurer',
              previousPolicyNumber: prevPolicy.policyNumber || 'PREV-NUM',
              policyExpiryDate: prevPolicy.policyExpiryDate ? new Date(prevPolicy.policyExpiryDate) : new Date(),
              claimInPreviousYear: Boolean(prevPolicy.claimInPreviousYear),
              ownershipTransfer: Boolean(prevPolicy.ownershipTransfer),
            },
          });
        }
      }

      if (dto.leadId) {
        await tx.lead
          .update({
            where: { id: dto.leadId },
            data: {
              status: 'QUOTE_PREPARED',
              currentWorkflowStep: 'QUOTATION',
            },
          })
          .catch((err) => {
            console.warn(`Lead update after quote capture:`, err.message);
          });
      }

      return createdQuotation;
    });
    } catch (err: any) {
      require('fs').writeFileSync('capture-error.log', err.stack || err.message || String(err));
      throw err;
    }

    return {
      message: 'Motor insurance quote captured using authoritative backend pricing',
      quotationCode: quotation.quotationCode,
      id: quotation.id,
      caseId: quotation.caseId || null,
      journeyId: journey?.id || null,
      vehicleCategory: quotation.vehicleCategory,
      policyType: quotation.policyType,
      registrationNumber: quotation.registrationNumber,
      totalPremium: Number(quotation.totalPremium),
      idv: Number(quotation.sumInsured),
      ncbPercentage: Number(quotation.ncbPercentage),
      workflowState: quotation.workflowState,
      status: quotation.status,
      authoritativeDates: calcResult.authoritativeDates,
      createdAt: quotation.createdAt,
    };
  }
}
