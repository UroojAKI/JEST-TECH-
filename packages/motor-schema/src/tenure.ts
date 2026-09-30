import { VehicleCategoryKey } from './categories';
import { PolicyTypeKey } from './policy-types';

export interface MotorTenureRule {
  category: VehicleCategoryKey;
  vehicleStatus: 'NEW' | 'EXISTING';
  policyType: PolicyTypeKey;
  odTenureYears: number;
  tpTenureYears: number;
}

export function resolveStatutoryTenures(
  category: VehicleCategoryKey,
  vehicleStatus: 'NEW' | 'EXISTING',
  policyType: PolicyTypeKey,
): { odTenureYears: number; tpTenureYears: number } {
  if (vehicleStatus === 'NEW') {
    if (category === 'BIKE') {
      return {
        odTenureYears: policyType === 'TP_ONLY' ? 0 : 1,
        tpTenureYears: 5,
      };
    }
    if (category === 'PRIVATE_CAR') {
      return {
        odTenureYears: policyType === 'TP_ONLY' ? 0 : 1,
        tpTenureYears: 3,
      };
    }
  }

  // Existing vehicles and commercial vehicles default to 1 year
  return {
    odTenureYears: policyType === 'TP_ONLY' ? 0 : 1,
    tpTenureYears: policyType === 'SAOD' ? 0 : 1,
  };
}
