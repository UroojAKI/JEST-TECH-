import { Injectable, Logger } from '@nestjs/common';

export interface MotorRuleContext {
  // Previous policy
  policyExpiryDate?: Date | null;
  expiredMoreThan90Days: boolean;
  ownershipTransfer: boolean;
  previousPolicyTransferred?: boolean; // Was the previous policy transferred to new owner?
  claimInPreviousYear: boolean;
  previousPolicyType?:
    'COMPREHENSIVE' | 'THIRD_PARTY' | 'SAOD' | 'NOT_AVAILABLE' | null;

  // New policy being quoted
  newPolicyType: 'TP_ONLY' | 'SAOD' | 'PACKAGE';
  newInsurerName?: string;
  previousInsurerName?: string;

  // SAOD-specific
  tpExpiryDate?: Date | null; // Active TP expiry for SAOD
  odExpiryDate?: Date | null; // Expiring OD policy expiry
  quotationDate?: Date;

  // Existing eligible NCB (before resets)
  eligibleNcbPercentage: number; // 0 | 20 | 25 | 35 | 45 | 50

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

  /**
   * THE SINGLE SOURCE OF TRUTH for all Motor Insurance business rules.
   *
   * NCB Priority Hierarchy (highest priority wins):
   * 1. Claim in previous year → NCB = 0
   * 2. Ownership transfer → NCB = 0
   * 3. Policy expired > 90 days → NCB = 0
   * 4. Eligible previous NCB applies
   *
   * Inspection Rule Matrix:
   * | Ownership Transfer | Prev Policy Transfer | Policy Status        | Inspection |
   * |--------------------|-----------------------|----------------------|------------|
   * | No                 | —                     | Active/not expired   | No         |
   * | No                 | —                     | Expired              | YES        |
   * | Yes                | Yes                   | Not expired          | NO         |
   * | Yes                | Yes                   | Expired              | YES        |
   * | Yes                | No                    | Any                  | YES        |
   * | Any                | Any                   | Expired > 90 days    | YES        |
   * | —                  | —                     | TP→Package (same co) | YES        |
   * | —                  | —                     | OD expired (SAOD)    | YES        |
   */
  evaluateQuotation(ctx: MotorRuleContext): MotorRuleResult {
    const today = ctx.quotationDate ?? new Date();
    const reasons: string[] = [];
    const missingDocs: string[] = [];

    // ─── Step 1: Compute policyExpired from date if not already flagged ───
    let policyExpired = false;
    if (ctx.policyExpiryDate) {
      policyExpired = ctx.policyExpiryDate < today;
    }
    // expiredMoreThan90Days is authoritative from input (computed from expiry date)
    const expiredMoreThan90Days =
      ctx.expiredMoreThan90Days ||
      (() => {
        if (!ctx.policyExpiryDate) return false;
        const ninetyDaysAgo = new Date(today);
        ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
        return ctx.policyExpiryDate < ninetyDaysAgo;
      })();

    // ─── Step 2: NCB calculation (priority hierarchy) ───
    let ncb: number;
    let ncbReason: MotorRuleResult['ncbReason'];

    if (ctx.claimInPreviousYear) {
      ncb = 0;
      ncbReason = 'CLAIM_IN_PREVIOUS_YEAR';
    } else if (ctx.ownershipTransfer) {
      ncb = 0;
      ncbReason = 'OWNERSHIP_TRANSFER';
    } else if (expiredMoreThan90Days) {
      ncb = 0;
      ncbReason = 'POLICY_EXPIRED_MORE_THAN_90_DAYS';
    } else {
      ncb = ctx.eligibleNcbPercentage;
      ncbReason = 'ELIGIBLE';
    }

    // ─── Step 3: Inspection rule matrix ───
    let inspectionRequired = false;

    // Rule: Policy expired (any expiry) → inspection (when no ownership transfer)
    if (policyExpired && !ctx.ownershipTransfer) {
      inspectionRequired = true;
      reasons.push('POLICY_EXPIRED');
    }

    // Rule: Expired > 90 days → inspection (always, even with ownership transfer)
    if (expiredMoreThan90Days) {
      inspectionRequired = true;
      if (!reasons.includes('POLICY_EXPIRED'))
        reasons.push('POLICY_EXPIRED_MORE_THAN_90_DAYS');
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
        // If not expired → NO inspection from this rule alone
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
    if (
      ctx.newPolicyType === 'SAOD' &&
      ctx.odExpiryDate &&
      ctx.odExpiryDate < today
    ) {
      inspectionRequired = true;
      reasons.push('SAOD_OD_POLICY_EXPIRED');
    }

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
      } else if (ctx.tpExpiryDate < today) {
        saodTpValid = false;
        saodTpInvalidReason = 'TP_POLICY_EXPIRED';
      }
    }

    // ─── Step 5: Policy transfer requirement ───
    const policyTransferRequired = ctx.ownershipTransfer === true;

    // ─── Step 6: Missing documents ───
    if (policyExpired && !ctx.previousPolicyType) {
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
      eligibleNcb: ctx.eligibleNcbPercentage,
      tpVerificationRequired,
      policyTransferRequired,
      saodTpValid,
      saodTpInvalidReason,
      missingDocuments: missingDocs,
      nextStep,
    };

    this.logger.log(
      `Rule evaluation complete. inspectionRequired=${inspectionRequired}, reasons=${reasons.join(',')}, ncb=${ncb}% (${ncbReason})`,
    );

    return result;
  }
}
