import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { ResourceAuthorizationService } from '../../../common/services/resource-authorization.service';
import { ActorContext } from '../../../common/interfaces/actor-context.interface';
import { CreateLoanFacilityDto, UpdateLoanFacilityDto } from '../dto/loan-facility.dto';
import { CreateLoanOfferDto } from '../dto/loan-offer.dto';
import { ConfigureLoanAddOnDto } from '../dto/loan-add-on.dto';
import { LoanCalculationService } from './loan-calculation.service';
import { LenderOfferStatus, LoanEnquiryStatus } from '@prisma/client';

@Injectable()
export class LoanFacilityService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authzService: ResourceAuthorizationService,
    private readonly calculationService: LoanCalculationService,
  ) {}

  private async getAuthorizedCaseForFacility(facilityId: string, actor: ActorContext) {
    const facility = await this.prisma.loanFacility.findUnique({
      where: { id: facilityId },
      include: {
        loanCase: true,
      },
    });
    if (!facility || !facility.loanCase) {
      throw new NotFoundException(`Loan facility ${facilityId} not found`);
    }

    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'UPDATE', facility.loanCase);
    return facility;
  }

  async addFacility(caseId: string, dto: CreateLoanFacilityDto, actor: ActorContext) {
    const loanCase = await this.prisma.loanApplicationCase.findUnique({
      where: { id: caseId },
    });
    if (!loanCase || loanCase.deletedAt) {
      throw new NotFoundException(`Loan case ${caseId} not found`);
    }

    this.authzService.authorize(actor, 'LOAN_APPLICATION_CASE', 'UPDATE', loanCase);

    return this.prisma.loanFacility.create({
      data: {
        loanCaseId: caseId,
        facilityType: dto.facilityType,
        requestedAmount: dto.requestedAmount,
        tenureMonths: dto.tenureMonths,
        interestRateType: dto.interestRateType || 'FLOATING',
        targetRoiPercentage: dto.targetRoiPercentage || null,
        disbursementMode: dto.disbursementMode || 'SINGLE_DISBURSEMENT',
        marginPercentage: dto.marginPercentage || null,
        ltvRatioPercentage: dto.ltvRatioPercentage || null,
        existingLenderName: dto.existingLenderName || null,
        existingLoanAccountNo: dto.existingLoanAccountNo || null,
        outstandingAmount: dto.outstandingAmount || null,
        existingRoiPercentage: dto.existingRoiPercentage || null,
        topUpAmountRequested: dto.topUpAmountRequested || null,
        foreclosureCharges: dto.foreclosureCharges || null,
      },
      include: {
        lenderOffers: true,
        addOns: true,
      },
    });
  }

  async updateFacility(facilityId: string, dto: UpdateLoanFacilityDto, actor: ActorContext) {
    await this.getAuthorizedCaseForFacility(facilityId, actor);

    return this.prisma.loanFacility.update({
      where: { id: facilityId },
      data: {
        ...(dto.facilityType ? { facilityType: dto.facilityType } : {}),
        ...(dto.requestedAmount !== undefined ? { requestedAmount: dto.requestedAmount } : {}),
        ...(dto.tenureMonths !== undefined ? { tenureMonths: dto.tenureMonths } : {}),
        ...(dto.interestRateType ? { interestRateType: dto.interestRateType } : {}),
        ...(dto.targetRoiPercentage !== undefined ? { targetRoiPercentage: dto.targetRoiPercentage } : {}),
        ...(dto.disbursementMode ? { disbursementMode: dto.disbursementMode } : {}),
        ...(dto.marginPercentage !== undefined ? { marginPercentage: dto.marginPercentage } : {}),
        ...(dto.ltvRatioPercentage !== undefined ? { ltvRatioPercentage: dto.ltvRatioPercentage } : {}),
        ...(dto.existingLenderName !== undefined ? { existingLenderName: dto.existingLenderName } : {}),
        ...(dto.existingLoanAccountNo !== undefined ? { existingLoanAccountNo: dto.existingLoanAccountNo } : {}),
        ...(dto.outstandingAmount !== undefined ? { outstandingAmount: dto.outstandingAmount } : {}),
        ...(dto.existingRoiPercentage !== undefined ? { existingRoiPercentage: dto.existingRoiPercentage } : {}),
        ...(dto.topUpAmountRequested !== undefined ? { topUpAmountRequested: dto.topUpAmountRequested } : {}),
        ...(dto.foreclosureCharges !== undefined ? { foreclosureCharges: dto.foreclosureCharges } : {}),
      },
      include: {
        lenderOffers: true,
        addOns: true,
      },
    });
  }

  async removeFacility(facilityId: string, actor: ActorContext) {
    await this.getAuthorizedCaseForFacility(facilityId, actor);
    await this.prisma.loanFacility.delete({ where: { id: facilityId } });
    return { success: true, message: 'Facility removed successfully' };
  }

  async addLenderOffer(facilityId: string, dto: CreateLoanOfferDto, actor: ActorContext) {
    const facility = await this.getAuthorizedCaseForFacility(facilityId, actor);

    // Backend calculations
    const emiAmount = this.calculationService.calculateEmi(
      dto.offeredAmount,
      dto.rateOfInterest,
      dto.offeredTenureMonths,
    );

    const charges = this.calculationService.calculateTotalCharges(
      dto.processingFee,
      dto.otherCharges || 0,
    );

    const commission = this.calculationService.calculateCommission(
      dto.offeredAmount,
      dto.commissionRatePercentage,
      dto.customerDiscountAmount,
    );

    const offer = await this.prisma.loanLenderOffer.create({
      data: {
        facilityId,
        lenderName: dto.lenderName,
        status: LenderOfferStatus.RECEIVED,
        offeredAmount: dto.offeredAmount,
        offeredTenureMonths: dto.offeredTenureMonths,
        interestRateType: dto.interestRateType || 'FLOATING',
        rateOfInterest: dto.rateOfInterest,
        emiAmount,
        processingFee: dto.processingFee,
        otherCharges: dto.otherCharges || 0,
        gstAmount: charges.gstAmount,
        totalChargesInclGst: charges.totalChargesInclGst,
        commissionRatePercentage: dto.commissionRatePercentage || null,
        grossCommissionAmount: commission.grossCommissionAmount || null,
        customerDiscountAmount: commission.customerDiscountAmount || null,
        netCommissionPayable: commission.netCommissionPayable || null,
        sanctionDate: dto.sanctionDate ? new Date(dto.sanctionDate) : null,
        expiryDate: dto.expiryDate ? new Date(dto.expiryDate) : null,
        remarks: dto.remarks || null,
      },
    });

    // Update case status to OFFERS_RECEIVED if currently in review / documents pending
    await this.prisma.loanApplicationCase.update({
      where: { id: facility.loanCaseId },
      data: {
        status: LoanEnquiryStatus.OFFERS_RECEIVED,
      },
    });

    return offer;
  }

  async selectLenderOffer(facilityId: string, offerId: string, actor: ActorContext) {
    const facility = await this.getAuthorizedCaseForFacility(facilityId, actor);

    const offer = await this.prisma.loanLenderOffer.findFirst({
      where: { id: offerId, facilityId },
    });
    if (!offer) {
      throw new NotFoundException(`Lender offer ${offerId} not found under facility ${facilityId}`);
    }

    return this.prisma.$transaction(async (tx) => {
      // 1. Reset any previously selected offer on this facility
      await tx.loanLenderOffer.updateMany({
        where: {
          facilityId,
          status: LenderOfferStatus.SELECTED,
        },
        data: {
          status: LenderOfferStatus.SHORTLISTED,
        },
      });

      // 2. Mark this offer as SELECTED
      const updatedOffer = await tx.loanLenderOffer.update({
        where: { id: offerId },
        data: {
          status: LenderOfferStatus.SELECTED,
        },
      });

      // 3. Point facility.selectedOfferId
      await tx.loanFacility.update({
        where: { id: facilityId },
        data: {
          selectedOfferId: offerId,
        },
      });

      // 4. Update case status to OFFER_SELECTED
      await tx.loanApplicationCase.update({
        where: { id: facility.loanCaseId },
        data: {
          status: LoanEnquiryStatus.OFFER_SELECTED,
        },
      });

      return updatedOffer;
    });
  }

  async configureAddOn(facilityId: string, dto: ConfigureLoanAddOnDto, actor: ActorContext) {
    await this.getAuthorizedCaseForFacility(facilityId, actor);

    const lifePremium = dto.creditLifeOpted ? dto.creditLifePremium || 0 : 0;
    const assetPremium = dto.assetInsuranceOpted ? dto.assetPremium || 0 : 0;
    const totalBasePremium = lifePremium + assetPremium;
    const gstAmount = Math.round(totalBasePremium * 0.18);
    const totalPremiumInclGst = totalBasePremium + gstAmount;

    const existingAddOn = await this.prisma.loanAddOn.findFirst({
      where: { facilityId },
    });

    if (existingAddOn) {
      return this.prisma.loanAddOn.update({
        where: { id: existingAddOn.id },
        data: {
          creditLifeOpted: !!dto.creditLifeOpted,
          creditLifeSumAssured: dto.creditLifeSumAssured || null,
          creditLifePremium: lifePremium,
          assetInsuranceOpted: !!dto.assetInsuranceOpted,
          assetSumAssured: dto.assetSumAssured || null,
          assetPremium: assetPremium,
          gstAmount,
          totalPremiumInclGst,
          brokerageAmount: dto.brokerageAmount || null,
        },
      });
    }

    return this.prisma.loanAddOn.create({
      data: {
        facilityId,
        creditLifeOpted: !!dto.creditLifeOpted,
        creditLifeSumAssured: dto.creditLifeSumAssured || null,
        creditLifePremium: lifePremium,
        assetInsuranceOpted: !!dto.assetInsuranceOpted,
        assetSumAssured: dto.assetSumAssured || null,
        assetPremium: assetPremium,
        gstAmount,
        totalPremiumInclGst,
        brokerageAmount: dto.brokerageAmount || null,
      },
    });
  }
}

