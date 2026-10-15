import type { VehicleCategory } from './motorFormTypes';

export type CommissionConfigStatus = 'DRAFT' | 'APPROVED' | 'ACTIVE' | 'RETIRED';

export type ConfigurationMissingEntity =
  | 'TP_TARIFF'
  | 'OD_RATE'
  | 'TAX_RULE'
  | 'COMMISSION_CONFIG';

/**
 * Insurer Commission Configuration Contract (D-02, PR-02)
 */
export interface InsurerCommissionConfig {
  insurerId: string;
  vehicleCategory: VehicleCategory;
  productType: string;
  odRatePercent: number;
  tpRatePercent: number;
  netRatePercent: number;
  effectiveFrom: string;
  effectiveTo?: string;
  status: CommissionConfigStatus;
}

/**
 * Breakdown of commission earnings.
 * Commissions are strictly calculated on net pre-tax base, NEVER on GST and NEVER confused with discounts.
 */
export interface CommissionBreakdown {
  odCommissionAmount: number;
  tpCommissionAmount: number;
  totalCommissionAmount: number;
  commissionableOdBase: number;
  commissionableTpBase: number;
  agentId?: string;
  planId?: string;
}

/**
 * Customer Discount Breakdown
 * Discounts reduce the customer's payable gross base prior to tax calculation.
 */
export interface CustomerDiscountBreakdown {
  odDiscountAmount: number;
  tpDiscountAmount: number;
  ncbDiscountAmount: number;
  totalDiscountAmount: number;
}

/**
 * Typed Fail-Closed Configuration Error Response (D-04, PR-02, T-06)
 */
export interface ConfigurationErrorResponse {
  errorCode: 'CONFIGURATION_ERROR';
  message: string;
  missingEntity: ConfigurationMissingEntity;
  vehicleCategory: string;
  policyType: string;
  effectiveDate: string;
  details?: Record<string, any>;
}
