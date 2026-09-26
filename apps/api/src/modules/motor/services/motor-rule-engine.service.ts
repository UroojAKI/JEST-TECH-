import { Injectable, Logger, Optional } from '@nestjs/common';
import { MotorPolicyDateService } from './motor-policy-date.service';

export interface MotorRuleContext {
  vehicleStatus?: 'NEW' | 'EXISTING';
  // Previous policy
  policyExpiryDate?: Date | string | null;
  expiredMoreThan90Days?: boolean;
  ownershipTransfer?: boolean;
  previousPolicyTransferred?: boolean; // Was the previous policy transferred to new owner?
  claimInPreviousYear?: boolean;
  previousPolicyType?:
    | 'COMPREHENSIVE'
    | 'THIRD_PARTY'
    | 'SAOD'
    | 'NOT_AVAILABLE'
    | null;

  // New policy being quoted
  newPolicyType: 'TP_ONLY' | 'SAOD' | 'PACKAGE';
  newInsurerName?: string;
  previousInsurerName?: string;

  // SAOD-specific
  tpExpiryDate?: Date | string | null; // Active TP expiry for SAOD
  odExpiryDate?: Date | string | null; // Expiring OD policy expiry
  quotationDate?: Date | string;

  // Existing eligible NCB (before resets)
  eligibleNcbPercentage?: number; // 0 | 20 | 25 | 35 | 45 | 50

  // Ownership transfer context
  newOwnerName?: string;
}

export interface MotorRuleResult {
  inspectionRequired: boolean;
  inspectionReasons: string[];
  ncb: number;
  ncbReason:
    | 'CLAIM_IN_PREVIOUS_YEAR'
    | 'OWNERSHIP_TRANSFER'
    | 'POLICY_EXPIRED_MORE_THAN_90_DAYS'
    | 'ELIGIBLE';
  eligibleNcb: number; // NCB that would apply without any resets
  tpVerificationRequired: boolean;
  policyTransferRequired: boolean;
  saodTpValid: boolean;
  saodTpInvalidReason?: string;
  missingDocuments: string[];
  nextStep: 'QUOTATION' | 'INSPECTION' | 'TP_VERIFICATION';
}

@Injectable()
export class MotorRuleEngineService {
  private readonly logger = new Logger(MotorRuleEngineService.name);

  constructor(
    @Optional()
    private readonly policyDateService: MotorPolicyDateService = new MotorPolicyDateService(),
  ) {}

  /**
   * Evaluates Third-Party specific statutory bypass rules.
   * Per IRDAI statutory regulations, standalone TP policies NEVER require physical inspection,
   * and NCB is forced to 0% (NCB is strictly an OD discount).
   */
  evaluateTpSpecificRules(ctx: MotorRuleContext): {
    isTpOnly: boolean;
    bypassInspection: boolean;
    forceZeroNcb: boolean;
  } {
    const isTpOnly = ctx.newPolicyType === 'TP_ONLY';
    return {
      isTpOnly,
      bypassInspection: isTpOnly,
      forceZeroNcb: isTpOnly,
    };
  }

  /**
   * Evaluates NCB priority hierarchy.
   */
  evaluateNcbRules(
    ctx: MotorRuleContext,
    expiredMoreThan90Days: boolean,
  ): { ncb: number; ncbReason: MotorRuleResult['ncbReason'] } {
    const tpRules = this.evaluateTpSpecificRules(ctx);
    if (tpRules.forceZeroNcb || ctx.vehicleStatus === 'NEW') {
      return { ncb: 0, ncbReason: 'ELIGIBLE' };
    }

    if (ctx.claimInPreviousYear) {
      return { ncb: 0, ncbReason: 'CLAIM_IN_PREVIOUS_YEAR' };
    }
    if (ctx.ownershipTransfer) {
      return { ncb: 0, ncbReason: 'OWNERSHIP_TRANSFER' };
    }
    if (expiredMoreThan90Days) {
      return { ncb: 0, ncbReason: 'POLICY_EXPIRED_MORE_THAN_90_DAYS' };
    }

    return {
      ncb: ctx.eligibleNcbPercentage || 0,
      ncbReason: 'ELIGIBLE',
    };
  }

  /**
   * Evaluates inspection requirements.
   */
  evaluateInspectionRules(
    ctx: MotorRuleContext,
    policyExpired: boolean,
    expiredMoreThan90Days: boolean,
    today: string,
  ): { inspectionRequired: boolean; reasons: string[] } {
    const tpRules = this.evaluateTpSpecificRules(ctx);
    if (tpRules.bypassInspection) {
      // MOTOR-REG-13: TP inspection bypass
      return { inspectionRequired: false, reasons: [] };
    }

    const reasons: string[] = [];
    let inspectionRequired = false;

    // Rule: Policy expired (any expiry) → inspection (when no ownership transfer)
    if (policyExpired && !ctx.ownershipTransfer) {
      inspectionRequired = true;
      reasons.push('POLICY_EXPIRED');
    }

    // Rule: Expired > 90 days → inspection (always, even with ownership transfer)
    if (expiredMoreThan90Days) {
      inspectionRequired = true;
      if (!reasons.includes('POLICY_EXPIRED')) {
        reasons.push('POLICY_EXPIRED_MORE_THAN_90_DAYS');
      }
    }

    // Rule: Ownership transfer matrix
    if (ctx.ownershipTransfer) {
      if (!ctx.previousPolicyTransferred) {
        // Transfer = Yes, prev policy NOT transferred → inspection always
        inspectionRequired = true;
        reasons.push('OWNERSHIP_TRANSFER_POLICY_NOT_TRANSFERRED');
      } else {
        // Transfer = Yes, prev policy transferred
        if (policyExpired) {
          // Policy also expired → inspection
          inspectionRequired = true;
          reasons.push('OWNERSHIP_TRANSFER_POLICY_EXPIRED');
        }
      }
    }

    // Rule: TP → Package upgrade
    const isTpToPackageUpgrade =
      ctx.previousPolicyType === 'THIRD_PARTY' &&
      ctx.newPolicyType === 'PACKAGE';
    if (isTpToPackageUpgrade) {
      inspectionRequired = true;
      reasons.push('TP_TO_PACKAGE_UPGRADE');
    }

    // Rule: SAOD — OD expired → inspection
    if (ctx.newPolicyType === 'SAOD' && ctx.odExpiryDate) {
      const odExpiryStr = this.policyDateService.toBusinessDate(ctx.odExpiryDate);
      if (odExpiryStr < today) {
        inspectionRequired = true;
        reasons.push('SAOD_OD_POLICY_EXPIRED');
      }
    }

    return { inspectionRequired, reasons };
  }

  /**
   * THE SINGLE SOURCE OF TRUTH for all Motor Insurance business rules.
   */
  evaluateQuotation(ctx: MotorRuleContext): MotorRuleResult {
    const today = ctx.quotationDate
      ? this.policyDateService.toBusinessDate(ctx.quotationDate)
      : this.policyDateService.getBusinessToday();

    const missingDocs: string[] = [];

    // ─── Step 1: Compute policyExpired from date using Asia/Kolkata date service ───
    let policyExpired = false;
    let expiredMoreThan90Days = ctx.expiredMoreThan90Days || false;

    if (ctx.policyExpiryDate) {
      const expiryStr = this.policyDateService.toBusinessDate(ctx.policyExpiryDate);
      // MOTOR-REG-09: If expiring today (expiryStr === today), it is ACTIVE / NOT EXPIRED
      policyExpired = expiryStr < today;
      if (policyExpired) {
        const daysDiff = this.policyDateService.daysBetween(expiryStr, today);
        if (daysDiff > 90) {
          expiredMoreThan90Days = true;
        }
      }
    }

    // ─── Step 2: NCB calculation ───
    const { ncb, ncbReason } = this.evaluateNcbRules(ctx, expiredMoreThan90Days);

    // ─── Step 3: Inspection rule matrix ───
    const { inspectionRequired, reasons } = this.evaluateInspectionRules(
      ctx,
      policyExpired,
      expiredMoreThan90Days,
      today,
    );

    // ─── Step 4: SAOD TP validation ───
    let saodTpValid = true;
    let saodTpInvalidReason: string | undefined;
    let tpVerificationRequired = false;

    if (ctx.newPolicyType === 'SAOD') {
      tpVerificationRequired = true;
      if (!ctx.tpExpiryDate) {
        saodTpValid = false;
        saodTpInvalidReason = 'ACTIVE_TP_POLICY_REQUIRED';
        missingDocs.push('ACTIVE_TP_POLICY_DETAILS');
      } else {
        const tpExpiryStr = this.policyDateService.toBusinessDate(ctx.tpExpiryDate);
        if (tpExpiryStr < today) {
          saodTpValid = false;
          saodTpInvalidReason = 'TP_POLICY_EXPIRED';
        }
      }
    }

    // ─── Step 5: Policy transfer requirement ───
    const policyTransferRequired = ctx.ownershipTransfer === true;

    // ─── Step 6: Missing documents ───
    if (policyExpired && !ctx.previousPolicyType && ctx.newPolicyType !== 'TP_ONLY') {
      missingDocs.push('PREVIOUS_POLICY_COPY');
    }
    if (ctx.ownershipTransfer && !ctx.newOwnerName) {
      missingDocs.push('NEW_OWNER_DETAILS');
    }

    // ─── Step 7: Determine next step ───
    let nextStep: MotorRuleResult['nextStep'];
    if (inspectionRequired) {
      nextStep = 'INSPECTION';
    } else if (tpVerificationRequired && !saodTpValid) {
      nextStep = 'TP_VERIFICATION';
    } else {
      nextStep = 'QUOTATION';
    }

    const result: MotorRuleResult = {
      inspectionRequired,
      inspectionReasons: reasons,
      ncb,
      ncbReason,
      eligibleNcb: ctx.newPolicyType === 'TP_ONLY' || ctx.vehicleStatus === 'NEW' ? 0 : (ctx.eligibleNcbPercentage || 0),
      tpVerificationRequired,
      policyTransferRequired,
      saodTpValid,
      saodTpInvalidReason,
      missingDocuments: missingDocs,
      nextStep,
    };

    this.logger.log(
      `Rule evaluation complete. policyType=${ctx.newPolicyType}, inspectionRequired=${inspectionRequired}, reasons=${reasons.join(',')}, ncb=${ncb}% (${ncbReason})`,
    );

    return result;
  }
}
