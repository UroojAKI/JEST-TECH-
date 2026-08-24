/**
 * IRDAI TP Tariff Configuration
 *
 * IMPORTANT NOTICE:
 * These values are PLACEHOLDERS only. They must NOT be used for policy issuance
 * until verified against the applicable current IRDAI notification/circular.
 *
 * Architecture:
 *   Quotation Date
 *     down Find tariff where: effectiveFrom <= date AND effectiveTo >= date
 *     down Match vehicleCategory + capacity/CC range
 *     down Calculate TP premium
 *
 * Source: IRDAI (https://irdai.gov.in) - verify against current notification
 * TP rates are set by IRDAI; OD rates are insurer-specific.
 */

export type TariffVehicleCategory =
  | 'BIKE'
  | 'PRIVATE_CAR'
  | 'GCV'
  | 'TRACTOR'
  | 'AUTO'
  | 'TAXI'
  | 'BUS'
  | 'MISC';

export interface MotorTariffEntry {
  id: string;
  vehicleCategory: TariffVehicleCategory;
  vehicleSubCategory?: string;
  engineCcMin?: number;
  engineCcMax?: number;
  seatingCapMin?: number;
  seatingCapMax?: number;
  gvwKgMin?: number;
  gvwKgMax?: number;
  policyType: 'TP_ONLY' | 'PACKAGE';
  annualPremium: number;
  effectiveFrom: string;
  effectiveTo: string | null;
  version: string;
  source: string;
  isVerified: boolean;
  verificationNote: string;
}

export const ACTIVE_TARIFF_VERSION = '2024-25-PLACEHOLDER';

export const MOTOR_TARIFF_CONFIG: MotorTariffEntry[] = [
  // BIKE - TP by CC
  { id: 'bike-tp-upto75cc', vehicleCategory: 'BIKE', engineCcMin: 0, engineCcMax: 75, policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against current IRDAI TP circular for two-wheelers up to 75cc' },
  { id: 'bike-tp-75to150cc', vehicleCategory: 'BIKE', engineCcMin: 76, engineCcMax: 150, policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against current IRDAI TP circular for 76-150cc two-wheelers' },
  { id: 'bike-tp-150to350cc', vehicleCategory: 'BIKE', engineCcMin: 151, engineCcMax: 350, policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against current IRDAI TP circular for 151-350cc two-wheelers' },
  { id: 'bike-tp-above350cc', vehicleCategory: 'BIKE', engineCcMin: 351, policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against current IRDAI TP circular for >350cc two-wheelers' },
  // PRIVATE CAR - TP by CC
  { id: 'car-tp-upto1000cc', vehicleCategory: 'PRIVATE_CAR', engineCcMin: 0, engineCcMax: 1000, policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against current IRDAI TP circular for private car up to 1000cc' },
  { id: 'car-tp-1000to1500cc', vehicleCategory: 'PRIVATE_CAR', engineCcMin: 1001, engineCcMax: 1500, policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against current IRDAI TP circular for 1001-1500cc private car' },
  { id: 'car-tp-above1500cc', vehicleCategory: 'PRIVATE_CAR', engineCcMin: 1501, policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against current IRDAI TP circular for >1500cc private car' },
  // GCV - TP by GVW
  { id: 'gcv-tp-upto7500kg', vehicleCategory: 'GCV', gvwKgMin: 0, gvwKgMax: 7500, policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against IRDAI TP circular for GCV up to 7500kg GVW' },
  { id: 'gcv-tp-7500to12000kg', vehicleCategory: 'GCV', gvwKgMin: 7501, gvwKgMax: 12000, policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against IRDAI TP circular for GCV 7501-12000kg GVW' },
  { id: 'gcv-tp-above12000kg', vehicleCategory: 'GCV', gvwKgMin: 12001, policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against IRDAI TP circular for GCV above 12000kg GVW' },
  // Auto, Taxi, Tractor, Bus, Misc
  { id: 'auto-tp', vehicleCategory: 'AUTO', policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against IRDAI TP circular for auto rickshaw' },
  { id: 'taxi-tp', vehicleCategory: 'TAXI', policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against IRDAI TP circular for taxi/cab' },
  { id: 'tractor-tp', vehicleCategory: 'TRACTOR', policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against IRDAI TP circular for tractor' },
  { id: 'bus-tp-upto18seats', vehicleCategory: 'BUS', seatingCapMin: 0, seatingCapMax: 18, policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against IRDAI TP circular for bus up to 18 seats' },
  { id: 'bus-tp-above18seats', vehicleCategory: 'BUS', seatingCapMin: 19, policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against IRDAI TP circular for bus above 18 seats' },
  { id: 'misc-tp', vehicleCategory: 'MISC', policyType: 'TP_ONLY', annualPremium: 0, effectiveFrom: '2024-04-01', effectiveTo: null, version: '2024-25-PLACEHOLDER', source: 'PENDING VERIFICATION', isVerified: false, verificationNote: 'Verify against IRDAI TP circular for Miscellaneous Class D' },
];

export function lookupTpTariff(params: {
  vehicleCategory: TariffVehicleCategory;
  policyType: 'TP_ONLY' | 'PACKAGE';
  quotationDate: Date;
  engineCc?: number;
  seatingCapacity?: number;
  gvwKg?: number;
}): { found: boolean; tariff?: MotorTariffEntry; warning?: string } {
  const { vehicleCategory, policyType, quotationDate, engineCc, seatingCapacity, gvwKg } = params;
  const activeTariffs = MOTOR_TARIFF_CONFIG.filter((t) => {
    if (t.vehicleCategory !== vehicleCategory) return false;
    if (t.policyType !== policyType) return false;
    const effectiveFrom = new Date(t.effectiveFrom);
    const effectiveTo = t.effectiveTo ? new Date(t.effectiveTo) : null;
    if (effectiveFrom > quotationDate) return false;
    if (effectiveTo && effectiveTo < quotationDate) return false;
    return true;
  });
  if (activeTariffs.length === 0) {
    return { found: false, warning: `No active TP tariff configuration found for ${vehicleCategory}. Contact CRM Admin to configure from current IRDAI notification.` };
  }
  for (const tariff of activeTariffs) {
    let matches = true;
    if (engineCc !== undefined && tariff.engineCcMin !== undefined) {
      if (engineCc < tariff.engineCcMin) matches = false;
      if (tariff.engineCcMax !== undefined && engineCc > tariff.engineCcMax) matches = false;
    }
    if (seatingCapacity !== undefined && tariff.seatingCapMin !== undefined) {
      if (seatingCapacity < tariff.seatingCapMin) matches = false;
      if (tariff.seatingCapMax !== undefined && seatingCapacity > tariff.seatingCapMax) matches = false;
    }
    if (gvwKg !== undefined && tariff.gvwKgMin !== undefined) {
      if (gvwKg < tariff.gvwKgMin) matches = false;
      if (tariff.gvwKgMax !== undefined && gvwKg > tariff.gvwKgMax) matches = false;
    }
    if (matches) {
      return { found: true, tariff, warning: tariff.isVerified ? undefined : `Tariff "${tariff.version}" is UNVERIFIED. Populate from official IRDAI notification before issuing policies.` };
    }
  }
  return { found: true, tariff: activeTariffs[0], warning: activeTariffs[0].isVerified ? undefined : `Tariff "${activeTariffs[0].version}" is UNVERIFIED. Populate from official IRDAI notification before issuing policies.` };
}

export const MOTOR_GST_RATE = 0.18;
export function calculateGst(premium: number): number { return Math.round(premium * MOTOR_GST_RATE * 100) / 100; }
export const NCB_SLABS = [0, 20, 25, 35, 45, 50] as const;
