export type VehicleCategoryKey =
  | 'BIKE'
  | 'PRIVATE_CAR'
  | 'GCV'
  | 'TRACTOR'
  | 'AUTO'
  | 'TAXI'
  | 'BUS_COACH'
  | 'MISC_CLASS_D';

export interface CategoryFieldDefinition {
  name: string;
  label: string;
  type: 'text' | 'number' | 'select' | 'boolean' | 'date';
  required: boolean;
  options?: Array<{ label: string; value: string | number }>;
  min?: number;
  max?: number;
  placeholder?: string;
  description?: string;
}

export interface AvailableAddon {
  code: string;
  name: string;
  description: string;
  defaultSelected?: boolean;
  maxVehicleAgeYears?: number;
}

export interface VehicleCategoryConfig {
  category: VehicleCategoryKey;
  label: string;
  displayName: string;
  engineMetric: 'cc' | 'gvw' | 'hp' | 'seatingCapacity';
  metricLabel: string;
  tariffTiers: Array<{ min: number; max?: number; label: string }>;
  fields: CategoryFieldDefinition[];
  allowedAddons: AvailableAddon[];
  requiredDocuments: {
    newVehicle: string[];
    existingComprehensive: string[];
    breakInInspection: string[];
    tpOnly: string[];
  };
}
