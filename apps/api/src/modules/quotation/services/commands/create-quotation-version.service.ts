import {
  BadRequestException,
  Injectable,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { Prisma, QuotationStatus } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma.service';
import { QuotationRepository } from '../../repositories/quotation.repository';
import { QuotationMapper } from '../../mappers/quotation.mapper';
import { MotorCalculationService } from '../../../motor/services/motor-calculation.service';

export interface CreateQuotationVersionInputDto {
  sumInsured: number;
  basePremium: number;
  gstAmount?: number;
  totalPremium?: number;
  discountAmount?: number;
  metadata?: Record<string, any>;
  addons?: Array<{ addonCode: string; addonName: string; premium: number }>;
}

@Injectable()
export class CreateQuotationVersionService {
  constructor(
    private readonly quotationRepository: QuotationRepository,
    private readonly prisma: PrismaService,
    @Optional()
    private readonly motorCalculationService?: MotorCalculationService,
  ) {}

  /**
   * Creates an immutable new version snapshot (V2, V3...) under an existing quotation.
   * G006: Tracks multi-version quotes with immutable snapshots per version.
   */
  async execute(
    id: string,
    dto: CreateQuotationVersionInputDto,
    createdById: string,
  ) {
    return this.prisma.$transaction(async (tx) => {
      const quotation = await tx.quotation.findFirst({
        where: { id, deletedAt: null },
        include: {
          versions: { orderBy: { versionNumber: 'desc' } },
          vehicle: true,
        },
      });

      if (!quotation) {
        throw new NotFoundException(`Quotation with ID ${id} not found`);
      }

      if (quotation.status === QuotationStatus.APPROVED) {
        throw new BadRequestException(
          'Cannot add new version to an accepted quotation. Supersede or revoke acceptance first.',
        );
      }

      if (quotation.status === QuotationStatus.CONVERTED_TO_POLICY) {
        throw new BadRequestException(
          'Cannot revise a quotation that has already been converted to a policy.',
        );
      }

      // Calculate next version number
      const highestVersion = quotation.versions?.[0]?.versionNumber || 1;
      const nextVersionNumber = highestVersion + 1;

      // Server-side authoritative calculation
      let sumInsured: Prisma.Decimal;
      let basePremium: Prisma.Decimal;
      let discountAmount: Prisma.Decimal;
      let gstAmount: Prisma.Decimal;
      let totalPremium: Prisma.Decimal;
      let pricingSnapshot: any = null;
      let calculationVersion: string | null = null;
      let itemizedAddons: any[] = dto.addons || [];

      if (quotation.productType === 'MOTOR') {
        if (!this.motorCalculationService) {
          throw new BadRequestException(
            'Motor calculation service is not available for motor quotation recalculation.',
          );
        }

        const vehicleData =
          (quotation.vehicle?.categorySpecificData as any) || {};
        const motorInput: any = {
          vehicleCategory:
            quotation.vehicleCategory ||
            quotation.vehicle?.category ||
            dto.metadata?.vehicleCategory ||
            'PRIVATE_CAR',
          vehicleStatus: quotation.vehicle?.registrationNumber
            ? 'EXISTING'
            : dto.metadata?.vehicleStatus || 'EXISTING',
          policyType: quotation.policyType || 'PACKAGE_COMPREHENSIVE',
          policyTenure: quotation.policyTenure || 1,
          idv: Number(dto.sumInsured),
          ncbPercent:
            dto.metadata?.ncbPercent ?? quotation.ncbPercentage ?? 0,
          claimInExpiringPolicy:
            dto.metadata?.claimInExpiringPolicy ?? false,
          paCover: dto.metadata?.paCover !== false,
          paidDriverLiability: dto.metadata?.paidDriverLiability ?? false,
          discountPercent:
            dto.metadata?.discountPercent ??
            (dto.discountAmount && dto.basePremium
              ? Math.round(
                  (Number(dto.discountAmount) / Number(dto.basePremium)) * 100,
                )
              : 0),
          commercialDiscountPercent:
            dto.metadata?.commercialDiscountPercent ??
            (quotation.versions?.[0]?.metadata as any)?.commercialDiscountPercent ??
            (quotation.calculationSnapshot as any)?.inputs?.commercialDiscountPercent,
          commercialAdjustment:
            (dto.metadata as any)?.commercialAdjustment ??
            dto.metadata?.commercialAdjustmentAmount ??
            (quotation.versions?.[0]?.metadata as any)?.commercialAdjustment ??
            (quotation.versions?.[0]?.metadata as any)?.commercialAdjustmentAmount ??
            (quotation.calculationSnapshot as any)?.inputs?.commercialAdjustment ??
            (quotation.calculationSnapshot as any)?.inputs?.commercialAdjustmentAmount ??
            (quotation.motorMetadata as any)?.policyDetails?.commercialAdjustment ??
            (quotation.motorMetadata as any)?.policyDetails?.commercialAdjustmentAmount,
          commercialAdjustmentAmount:
            dto.metadata?.commercialAdjustmentAmount ??
            (dto.metadata as any)?.commercialAdjustment ??
            (quotation.versions?.[0]?.metadata as any)?.commercialAdjustmentAmount ??
            (quotation.versions?.[0]?.metadata as any)?.commercialAdjustment ??
            (quotation.calculationSnapshot as any)?.inputs?.commercialAdjustmentAmount ??
            (quotation.calculationSnapshot as any)?.inputs?.commercialAdjustment ??
            (quotation.motorMetadata as any)?.policyDetails?.commercialAdjustmentAmount ??
            (quotation.motorMetadata as any)?.policyDetails?.commercialAdjustment,
          odDiscountPercent:
            dto.metadata?.odDiscountPercent ??
            (quotation.versions?.[0]?.metadata as any)?.odDiscountPercent ??
            (quotation.calculationSnapshot as any)?.inputs?.odDiscountPercent ??
            0,
          tpDiscountPercent:
            dto.metadata?.tpDiscountPercent ??
            (quotation.versions?.[0]?.metadata as any)?.tpDiscountPercent ??
            (quotation.calculationSnapshot as any)?.inputs?.tpDiscountPercent ??
            0,
          addons: dto.addons?.map((a) => ({
            addonCode: a.addonCode,
            manualPrice: undefined,
          })),
          engineCc:
            vehicleData.engineCapacityCcOrKw ?? dto.metadata?.engineCc,
          seatingCapacity:
            vehicleData.seatingCapacity ?? dto.metadata?.seatingCapacity,
          gvwKg:
            vehicleData.grossVehicleWeightKg ?? dto.metadata?.gvwKg,
          activeTpPolicyNumber: quotation.activeTpPolicyNumber ?? undefined,
          activeTpExpiryDate: quotation.activeTpExpiryDate
            ? quotation.activeTpExpiryDate.toISOString()
            : undefined,
          approvalReference: dto.metadata?.approvalReference,
          previousPolicyExpiryDate: dto.metadata?.previousPolicyExpiryDate,
          policyStartDate: dto.metadata?.policyStartDate,
          odPremium:
            (dto.metadata as any)?.odPremium ??
            dto.metadata?.odPremiumAmount ??
            (quotation.versions?.[0]?.metadata as any)?.odPremium ??
            (quotation.versions?.[0]?.metadata as any)?.odPremiumAmount ??
            (quotation.calculationSnapshot as any)?.inputs?.odPremium ??
            (quotation.calculationSnapshot as any)?.inputs?.odPremiumAmount ??
            (quotation.motorMetadata as any)?.policyDetails?.odPremium ??
            (quotation.motorMetadata as any)?.policyDetails?.odPremiumAmount,
          odPremiumAmount:
            dto.metadata?.odPremiumAmount ??
            (dto.metadata as any)?.odPremium ??
            (quotation.versions?.[0]?.metadata as any)?.odPremiumAmount ??
            (quotation.versions?.[0]?.metadata as any)?.odPremium ??
            (quotation.calculationSnapshot as any)?.inputs?.odPremiumAmount ??
            (quotation.calculationSnapshot as any)?.inputs?.odPremium ??
            (quotation.motorMetadata as any)?.policyDetails?.odPremiumAmount ??
            (quotation.motorMetadata as any)?.policyDetails?.odPremium,
          editedOdRate: undefined,
          annualTpPremium:
            (dto.metadata as any)?.annualTpPremium ??
            dto.metadata?.editedTpAnnualPremium ??
            dto.metadata?.editedTpPremium ??
            (quotation.versions?.[0]?.metadata as any)?.annualTpPremium ??
            (quotation.versions?.[0]?.metadata as any)?.editedTpAnnualPremium ??
            (quotation.versions?.[0]?.metadata as any)?.editedTpPremium ??
            (quotation.calculationSnapshot as any)?.inputs?.annualTpPremium ??
            (quotation.calculationSnapshot as any)?.inputs?.editedTpAnnualPremium ??
            (quotation.calculationSnapshot as any)?.inputs?.editedTpPremium,
          editedTpAnnualPremium:
            dto.metadata?.editedTpAnnualPremium ??
            dto.metadata?.editedTpPremium ??
            (quotation.versions?.[0]?.metadata as any)?.editedTpAnnualPremium ??
            (quotation.versions?.[0]?.metadata as any)?.editedTpPremium ??
            (quotation.calculationSnapshot as any)?.inputs?.editedTpAnnualPremium ??
            (quotation.calculationSnapshot as any)?.inputs?.editedTpPremium,
          editedTpPremium:
            dto.metadata?.editedTpPremium ??
            dto.metadata?.editedTpAnnualPremium ??
            (quotation.versions?.[0]?.metadata as any)?.editedTpPremium ??
            (quotation.versions?.[0]?.metadata as any)?.editedTpAnnualPremium ??
            (quotation.calculationSnapshot as any)?.inputs?.editedTpPremium ??
            (quotation.motorMetadata as any)?.policyDetails?.editedTpPremium,
          editedPaPremium:
            dto.metadata?.editedPaPremium ??
            (quotation.versions?.[0]?.metadata as any)?.editedPaPremium ??
            (quotation.calculationSnapshot as any)?.inputs?.editedPaPremium ??
            (quotation.motorMetadata as any)?.policyDetails?.editedPaPremium,
          odGstRate:
            dto.metadata?.odGstRate ??
            (quotation.versions?.[0]?.metadata as any)?.odGstRate ??
            (quotation.calculationSnapshot as any)?.inputs?.odGstRate ??
            (quotation.motorMetadata as any)?.policyDetails?.odGstRate,
          tpGstRate:
            dto.metadata?.tpGstRate ??
            (quotation.versions?.[0]?.metadata as any)?.tpGstRate ??
            (quotation.calculationSnapshot as any)?.inputs?.tpGstRate ??
            (quotation.motorMetadata as any)?.policyDetails?.tpGstRate,
          paGstRate:
            dto.metadata?.paGstRate ??
            (quotation.versions?.[0]?.metadata as any)?.paGstRate ??
            (quotation.calculationSnapshot as any)?.inputs?.paGstRate ??
            (quotation.motorMetadata as any)?.policyDetails?.paGstRate,
        };

        const calc = await this.motorCalculationService.calculate(motorInput);
        sumInsured = new Prisma.Decimal(dto.sumInsured);
        basePremium = new Prisma.Decimal(calc.outputs.basePremium);
        discountAmount = new Prisma.Decimal(calc.outputs.totalDiscount);
        gstAmount = new Prisma.Decimal(calc.outputs.totalGst);
        totalPremium = new Prisma.Decimal(calc.outputs.totalPremium);
        pricingSnapshot = calc;
        calculationVersion = calc.calculationVersion;
        itemizedAddons = calc.outputs.itemizedAddons;
      } else {
        // Non-motor server-side authoritative calculation: client-supplied totalPremium and gstAmount are ignored
        sumInsured = new Prisma.Decimal(dto.sumInsured);
        basePremium = new Prisma.Decimal(dto.basePremium);
        discountAmount = new Prisma.Decimal(dto.discountAmount || 0);

        const addonsTotal = (dto.addons || []).reduce(
          (sum, a) => sum + Number(a.premium || 0),
          0,
        );
        const grossBase = Number(dto.basePremium || 0) + addonsTotal;
        const discount = Math.min(grossBase, Number(dto.discountAmount || 0));
        const netBase = Math.max(0, grossBase - discount);

        // GST is strictly 18% in India for general insurance
        const calculatedGst = Math.round(netBase * 0.18 * 100) / 100;
        const calculatedTotal = Math.round((netBase + calculatedGst) * 100) / 100;

        gstAmount = new Prisma.Decimal(calculatedGst);
        totalPremium = new Prisma.Decimal(calculatedTotal);
      }

      // 1. Create immutable QuotationVersion row
      await tx.quotationVersion.create({
        data: {
          quotationId: id,
          versionNumber: nextVersionNumber,
          sumInsured,
          basePremium,
          discountAmount,
          gstAmount,
          totalPremium,
          metadata: {
            ...dto.metadata,
            addons: itemizedAddons,
            pricingSnapshot,
            revisionDate: new Date().toISOString(),
          },
          createdById,
        },
      });

      // 2. Update parent Quotation with current active version numbers
      await tx.quotation.update({
        where: { id },
        data: {
          sumInsured,
          basePremium,
          discountAmount,
          gstAmount,
          totalPremium,
          calculationSnapshot:
            pricingSnapshot || quotation.calculationSnapshot,
          calculationVersion:
            calculationVersion || quotation.calculationVersion,
          version: quotation.version + 1,
          updatedById: createdById,
        },
      });

      // 3. Record audit history
      await tx.quotationHistory.create({
        data: {
          quotationId: id,
          status: quotation.status,
          comments: `Generated revised quotation version V${nextVersionNumber}. Total: ₹${Number(totalPremium).toLocaleString('en-IN')}`,
          createdById,
        },
      });

      const updated = await tx.quotation.findFirst({
        where: { id },
        include: {
          contact: true,
          account: true,
          lead: true,
          versions: { orderBy: { versionNumber: 'desc' } },
          addons: true,
          discounts: true,
          histories: { orderBy: { createdAt: 'desc' } },
          documents: true,
        },
      });

      return QuotationMapper.toResponse(updated as any);
    });
  }
}
