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

    // MOTOR-REG-03: SAOD for NEW vehicle rejection
    if (isVehicleNew && policyType === 'STANDALONE_OD') {
      throw new BadRequestException('Standalone OD is not applicable for new vehicles');
    }

    const prevPolicy = dto.previousPolicyDetails || {};
    const calculationInput: any = {
      vehicleCategory: dto.vehicleCategory,
      vehicleSubType: vehicleDetails.vehicleSubType || vehicleDetails.vehicleType,
      vehicleStatus: isVehicleNew ? 'NEW' : 'EXISTING',
      policyType,
      policyTenure: Number(policyDetails.policyTenure || 1) || 1,
      idv: dto.idv || Number(policyDetails.insuredDeclaredValue || 0) || undefined,
      ncbPercent: isVehicleNew ? 0 : Number(dto.ncbPercentage || policyDetails.ncbPercentage || 0),
      claimInExpiringPolicy:
        String(policyDetails.claimInExpiringPolicy || prevPolicy.claimInPreviousYear || '').toLowerCase() === 'yes',
      paCover: Boolean(policyDetails.paCoverOwner),
      paidDriverLiability:
        String(policyDetails.legalLiabilityPaidDriver || '').toLowerCase() === 'yes',
      addons: Array.isArray(policyDetails.addonsSelected)
        ? policyDetails.addonsSelected
            .map((addon: any) => ({
              addonCode:
                typeof addon === 'string' ? addon : addon.addonCode || addon.code,
              ...(typeof addon === 'object' && addon.manualPrice !== undefined
                ? { manualPrice: Number(addon.manualPrice) }
                : {}),
            }))
            .filter((addon: any) => addon.addonCode)
        : [],
      activeTpPolicyNumber:
        saodVerification.tpPolicyNumber ||
        policyDetails.activeTPPolicyNumberValidity ||
        undefined,
      activeTpExpiryDate: saodVerification.tpExpiryDate || undefined,
      discountPercent: Number(policyDetails.odCommissionCalc || 0),
      tpDiscountPercent: Number(policyDetails.tpCommissionCalc || 0),
      previousPolicyExpiryDate: prevPolicy.policyExpiryDate || undefined,
      policyStartDate: policyDetails.policyStartDate || undefined,
    };

    const calcResult = await this.motorCalculationService.calculate(calculationInput);

    // ── 6. Underwriting Rules Evaluation ──
    const ruleResult = this.motorRuleEngineService.evaluateQuotation({
      vehicleStatus: isVehicleNew ? 'NEW' : 'EXISTING',
      newPolicyType: dto.policyType as any,
      previousPolicyType: prevPolicy.policyType,
      policyExpiryDate: prevPolicy.policyExpiryDate ? new Date(prevPolicy.policyExpiryDate) : null,
      claimInPreviousYear: Boolean(prevPolicy.claimInPreviousYear),
      ownershipTransfer: Boolean(prevPolicy.ownershipTransfer),
      previousPolicyTransferred: Boolean(prevPolicy.previousPolicyTransferred),
      eligibleNcbPercentage: isVehicleNew ? 0 : Number(dto.ncbPercentage || 0),
      tpExpiryDate: saodVerification.tpExpiryDate ? new Date(saodVerification.tpExpiryDate) : null,
      odExpiryDate: saodVerification.odExpiryDate ? new Date(saodVerification.odExpiryDate) : null,
    });

    const quotationCode = await this.numberingEngine.generateNext('QUOTATION');

    const motorMetadata = {
      vehicleCategory: dto.vehicleCategory,
      policyType: dto.policyType,
      registrationNumber: dto.registrationNumber,
      proposerDetails: dto.proposerDetails,
      vehicleDetails: dto.vehicleDetails,
      policyDetails: dto.policyDetails,
      saodVerification: dto.saodVerification,
      previousPolicyDetails: dto.previousPolicyDetails,
      manualAgent: manualAgentSnapshot,
      ruleResult,
      documents: dto.documents,
      workflowStatus: 'READY_FOR_PROPOSAL',
      capturedBy: user.id,
      capturedAt: new Date().toISOString(),
    };

    // ── 7. Atomic Quotation & Journey Binding ──
    const quotation = await this.prisma.$transaction(async (tx) => {
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
          workflowState: 'READY_FOR_PROPOSAL',
          motorMetadata: motorMetadata as any,
          expiryDate: new Date(Date.now() + 30 * 86400000),
          contactId,
          vehicleId,
          leadId: dto.leadId || null,
          agentId: assignedAgentId,
          createdById: user.id,
        },
      });

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

    return {
      message: 'Motor insurance quote captured using authoritative backend pricing',
      quotationCode: quotation.quotationCode,
      id: quotation.id,
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
