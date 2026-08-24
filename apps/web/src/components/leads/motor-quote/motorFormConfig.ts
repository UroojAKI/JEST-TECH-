// Motor Insurance CRM — Form Configuration
// Data-driven config for all 8 vehicle categories

import type { VehicleCategory } from './motorFormTypes';

export const VEHICLE_CATEGORIES: {
  id: VehicleCategory;
  label: string;
  icon: string;
  description: string;
  color: string;
}[] = [
  { id: 'BIKE', label: 'Two-Wheeler (Bike)', icon: '🏍️', description: 'Scooter, Motorcycle, Moped, Electric', color: 'from-orange-500 to-amber-500' },
  { id: 'PRIVATE_CAR', label: 'Private Car', icon: '🚗', description: 'Hatchback, Sedan, SUV, MPV', color: 'from-blue-500 to-indigo-500' },
  { id: 'GCV', label: 'Goods Vehicle (GCV)', icon: '🚛', description: 'LCV, MCV, HCV, Trailer, Tanker', color: 'from-slate-500 to-zinc-600' },
  { id: 'TRACTOR', label: 'Tractor', icon: '🚜', description: 'Agricultural & Commercial Tractors', color: 'from-green-600 to-emerald-600' },
  { id: 'AUTO', label: 'Auto / Three-Wheeler', icon: '🛺', description: 'Passenger & Goods Three-Wheelers', color: 'from-yellow-500 to-orange-500' },
  { id: 'TAXI', label: 'Taxi / Cab', icon: '🚕', description: 'Contract Carriage, Tourist, Aggregator', color: 'from-yellow-400 to-amber-400' },
  { id: 'BUS_COACH', label: 'Bus & Coaches', icon: '🚌', description: 'School Bus, Staff Bus, Stage Carriage', color: 'from-purple-500 to-violet-600' },
  { id: 'MISC_CLASS_D', label: 'Miscellaneous (Class D)', icon: '🏗️', description: 'Crane, Forklift, Excavator, Ambulance', color: 'from-rose-500 to-pink-600' },
];

export const POLICY_TYPES = [
  { id: 'TP_ONLY', label: 'Third Party (TP) Only', short: 'TP Only', description: 'Liability Only cover — IRDAI mandatory minimum' },
  { id: 'SAOD', label: 'Standalone Own Damage (SAOD)', short: 'SAOD', description: 'Requires existing active TP policy in force' },
  { id: 'PACKAGE', label: 'Package / Comprehensive (OD + TP)', short: 'Package', description: 'Combined OD + TP cover in a single policy' },
] as const;

// ------------------------------------------------------------------
// VEHICLE-SPECIFIC FIELD DEFINITIONS
// mandatory: true = Y, false = N, 'conditional' = Conditional
// ------------------------------------------------------------------

export type FieldDef = {
  key: string;
  label: string;
  type: 'text' | 'dropdown' | 'date' | 'numeric' | 'boolean' | 'alphanumeric';
  mandatory: boolean | 'conditional';
  options?: string[];
  placeholder?: string;
  hint?: string;
};

export const VEHICLE_FIELDS: Record<VehicleCategory, FieldDef[]> = {
  BIKE: [
    { key: 'registrationNumber', label: 'Registration Number', type: 'alphanumeric', mandatory: true, placeholder: 'KA-22-AB-1234 (blank for new)' },
    { key: 'vehicleSubType', label: 'Vehicle Sub-Type', type: 'dropdown', mandatory: true, options: ['Scooter', 'Motorcycle', 'Moped', 'Electric Two-Wheeler'] },
    { key: 'makeModel', label: 'Make & Model', type: 'text', mandatory: false, placeholder: 'e.g. Honda Activa 6G' },
    { key: 'engineCapacity', label: 'Engine Capacity (CC) / Motor Power (kW)', type: 'numeric', mandatory: false, placeholder: 'CC or kW for electric' },
    { key: 'manufactureYearMonth', label: 'Manufacture Year / Month', type: 'date', mandatory: false },
    { key: 'dateOfRegistration', label: 'Date of Registration', type: 'date', mandatory: false },
    { key: 'engineNumber', label: 'Engine Number', type: 'alphanumeric', mandatory: false },
    { key: 'chassisNumber', label: 'Chassis Number', type: 'alphanumeric', mandatory: false },
    { key: 'fuelType', label: 'Fuel Type', type: 'dropdown', mandatory: false, options: ['Petrol', 'Electric'] },
    { key: 'rtoLocation', label: 'RTO Location', type: 'dropdown', mandatory: false, placeholder: 'Select RTO' },
    { key: 'usageType', label: 'Usage Type', type: 'dropdown', mandatory: true, options: ['Personal', 'Commercial (Delivery)', 'Commercial (Aggregator)'] },
  ],
  PRIVATE_CAR: [
    { key: 'registrationNumber', label: 'Registration Number', type: 'alphanumeric', mandatory: true, placeholder: 'KA-22-AB-1234 (blank for new)' },
    { key: 'vehicleSubType', label: 'Vehicle Sub-Type', type: 'dropdown', mandatory: false, options: ['Hatchback', 'Sedan', 'SUV', 'MPV'] },
    { key: 'makeModelVariant', label: 'Make, Model & Variant', type: 'text', mandatory: false, placeholder: 'e.g. Maruti Swift VXi' },
    { key: 'engineCapacity', label: 'Engine Capacity (CC) / Motor Power (kW)', type: 'numeric', mandatory: false },
    { key: 'manufactureYearMonth', label: 'Manufacture Year / Month', type: 'date', mandatory: false },
    { key: 'dateOfRegistration', label: 'Date of Registration', type: 'date', mandatory: false },
    { key: 'engineNumber', label: 'Engine Number', type: 'alphanumeric', mandatory: false },
    { key: 'chassisNumber', label: 'Chassis Number', type: 'alphanumeric', mandatory: false },
    { key: 'fuelType', label: 'Fuel Type', type: 'dropdown', mandatory: false, options: ['Petrol', 'Diesel', 'CNG', 'Electric', 'Hybrid'] },
    { key: 'seatingCapacity', label: 'Seating Capacity (incl. driver)', type: 'numeric', mandatory: false },
    { key: 'rtoLocation', label: 'RTO Location', type: 'dropdown', mandatory: false },
    { key: 'hypothecationFinancer', label: 'Hypothecation / Financer Name', type: 'text', mandatory: false, placeholder: 'If vehicle is financed' },
  ],
  GCV: [
    { key: 'registrationNumber', label: 'Registration Number', type: 'alphanumeric', mandatory: true },
    { key: 'vehicleSubType', label: 'Vehicle Sub-Type', type: 'dropdown', mandatory: true, options: ['LCV', 'MCV', 'HCV', 'Trailer', 'Tanker'] },
    { key: 'makeModel', label: 'Make & Model', type: 'text', mandatory: false },
    { key: 'grossVehicleWeight', label: 'Gross Vehicle Weight (GVW) — kg', type: 'numeric', mandatory: true },
    { key: 'carryingCapacity', label: 'Carrying Capacity (Tonnes)', type: 'numeric', mandatory: false },
    { key: 'manufactureYearMonth', label: 'Manufacture Year / Month', type: 'date', mandatory: false },
    { key: 'dateOfRegistration', label: 'Date of Registration', type: 'date', mandatory: false },
    { key: 'engineChassisNumber', label: 'Engine / Chassis Number', type: 'alphanumeric', mandatory: false },
    { key: 'fuelType', label: 'Fuel Type', type: 'dropdown', mandatory: false, options: ['Diesel', 'CNG', 'Electric'] },
    { key: 'zoneOfOperation', label: 'Zone of Operation', type: 'dropdown', mandatory: false, options: ['Zone I', 'Zone II'] },
    { key: 'usageType', label: 'Usage Type', type: 'dropdown', mandatory: true, options: ['Own Goods', 'Public Carrier', 'Hire & Reward'] },
    { key: 'routePermitType', label: 'Route Permit Type', type: 'dropdown', mandatory: false, options: ['National', 'State', 'Local'] },
  ],
  TRACTOR: [
    { key: 'registrationNumber', label: 'Registration Number', type: 'alphanumeric', mandatory: true },
    { key: 'makeModel', label: 'Make & Model', type: 'text', mandatory: false },
    { key: 'horsePower', label: 'Horse Power (HP)', type: 'numeric', mandatory: false },
    { key: 'manufactureYearMonth', label: 'Manufacture Year / Month', type: 'date', mandatory: false },
    { key: 'dateOfRegistration', label: 'Date of Registration', type: 'date', mandatory: false },
    { key: 'engineChassisNumber', label: 'Engine / Chassis Number', type: 'alphanumeric', mandatory: false },
    { key: 'attachmentUsed', label: 'Attachment Used', type: 'dropdown', mandatory: true, options: ['Trailer 1', 'Trailer 2', 'Harvester', 'Cultivator', 'None'] },
    { key: 'usageType', label: 'Usage Type', type: 'dropdown', mandatory: true, options: ['Agricultural', 'Commercial Haulage'] },
    { key: 'rtoLocation', label: 'RTO Location', type: 'dropdown', mandatory: false },
  ],
  AUTO: [
    { key: 'registrationNumber', label: 'Registration Number', type: 'alphanumeric', mandatory: true },
    { key: 'vehicleSubType', label: 'Vehicle Sub-Type', type: 'dropdown', mandatory: true, options: ['Passenger Carrying', 'Goods Carrying'] },
    { key: 'makeModel', label: 'Make & Model', type: 'text', mandatory: false },
    { key: 'seatLoadCapacity', label: 'Seating / Load Capacity (Passengers or Tonnes)', type: 'numeric', mandatory: true },
    { key: 'manufactureYearMonth', label: 'Manufacture Year / Month', type: 'date', mandatory: false },
    { key: 'dateOfRegistration', label: 'Date of Registration', type: 'date', mandatory: false },
    { key: 'engineChassisNumber', label: 'Engine / Chassis Number', type: 'alphanumeric', mandatory: false },
    { key: 'fuelType', label: 'Fuel Type', type: 'dropdown', mandatory: false, options: ['Petrol', 'CNG', 'Diesel', 'Electric'] },
    { key: 'permitType', label: 'Permit Type', type: 'dropdown', mandatory: false },
    { key: 'rtoLocation', label: 'RTO Location', type: 'dropdown', mandatory: false },
  ],
  TAXI: [
    { key: 'registrationNumber', label: 'Registration Number', type: 'alphanumeric', mandatory: true },
    { key: 'vehicleSubType', label: 'Vehicle Sub-Type', type: 'dropdown', mandatory: false, options: ['Hatchback', 'Sedan', 'SUV'] },
    { key: 'makeModel', label: 'Make & Model', type: 'dropdown', mandatory: false },
    { key: 'manufactureYearMonth', label: 'Manufacture Year / Month', type: 'date', mandatory: false },
    { key: 'dateOfRegistration', label: 'Date of Registration', type: 'date', mandatory: false },
    { key: 'engineChassisNumber', label: 'Engine / Chassis Number', type: 'alphanumeric', mandatory: false },
    { key: 'fuelType', label: 'Fuel Type', type: 'dropdown', mandatory: false, options: ['Petrol', 'Diesel', 'CNG', 'Electric'] },
    { key: 'seatingCapacity', label: 'Seating Capacity (incl. driver)', type: 'numeric', mandatory: true },
    { key: 'permitType', label: 'Permit Type', type: 'dropdown', mandatory: false, options: ['Contract Carriage', 'Tourist Permit', 'All India Tourist'] },
    { key: 'aggregatorAffiliation', label: 'Aggregator Affiliation', type: 'dropdown', mandatory: false, options: ['None', 'Ola', 'Uber', 'Other'] },
    { key: 'rtoLocation', label: 'RTO Location', type: 'dropdown', mandatory: false },
  ],
  BUS_COACH: [
    { key: 'registrationNumber', label: 'Registration Number', type: 'alphanumeric', mandatory: true },
    { key: 'vehicleSubType', label: 'Vehicle Sub-Type', type: 'dropdown', mandatory: true, options: ['School Bus', 'Staff Bus', 'Stage Carriage', 'Luxury Coach'] },
    { key: 'makeModel', label: 'Make & Model', type: 'dropdown', mandatory: false },
    { key: 'seatingCapacity', label: 'Seating Capacity (incl. driver)', type: 'numeric', mandatory: true },
    { key: 'manufactureYearMonth', label: 'Manufacture Year / Month', type: 'date', mandatory: false },
    { key: 'dateOfRegistration', label: 'Date of Registration', type: 'date', mandatory: false },
    { key: 'engineChassisNumber', label: 'Engine / Chassis Number', type: 'alphanumeric', mandatory: false },
    { key: 'fuelType', label: 'Fuel Type', type: 'dropdown', mandatory: false, options: ['Diesel', 'CNG', 'Electric'] },
    { key: 'routePermitType', label: 'Route Permit Type', type: 'dropdown', mandatory: false },
    { key: 'schoolBusCompliance', label: 'School Bus Compliance Certificate', type: 'boolean', mandatory: 'conditional', hint: 'Mandatory for school bus category' },
    { key: 'rtoLocation', label: 'RTO Location', type: 'dropdown', mandatory: false },
  ],
  MISC_CLASS_D: [
    { key: 'registrationNumber', label: 'Registration Number', type: 'alphanumeric', mandatory: true },
    { key: 'vehicleSubType', label: 'Vehicle Sub-Type', type: 'dropdown', mandatory: true, options: ['Crane', 'Forklift', 'Excavator (JCB)', 'Dumper', 'Ambulance', 'Fire Tender', 'Mobile Canteen', 'Other'] },
    { key: 'makeModel', label: 'Make & Model', type: 'dropdown', mandatory: false },
    { key: 'manufactureYearMonth', label: 'Manufacture Year / Month', type: 'date', mandatory: false },
    { key: 'dateOfRegistration', label: 'Date of Registration', type: 'date', mandatory: false },
    { key: 'engineChassisNumber', label: 'Engine / Chassis Number', type: 'alphanumeric', mandatory: false },
    { key: 'purposeOfUse', label: 'Purpose of Use', type: 'text', mandatory: false },
    { key: 'rtoLocation', label: 'RTO Location', type: 'dropdown', mandatory: false },
  ],
};

// ------------------------------------------------------------------
// DOCUMENT CHECKLISTS per vehicle category
// ------------------------------------------------------------------
export const DOCUMENT_CHECKLISTS: Record<VehicleCategory, string[]> = {
  BIKE: [
    'Copy of Registration Certificate (RC)',
    'Previous policy copy (renewal / SAOD / rollover)',
    'Valid Driving License copy',
    'Vehicle inspection report / photographs (break-in / SAOD cases)',
    'KYC documents (PAN, Address Proof)',
    'Invoice & Form 21/22 (new vehicle)',
  ],
  PRIVATE_CAR: [
    'Copy of Registration Certificate (RC)',
    'Previous policy copy (renewal / SAOD / rollover)',
    'Valid Driving License copy',
    'Vehicle inspection report / photographs (break-in / SAOD cases)',
    'KYC documents (PAN, Address Proof)',
    'Invoice & Form 21/22 (new vehicle)',
    'Hypothecation / NOC letter (if financed)',
  ],
  GCV: [
    'Copy of Registration Certificate (RC)',
    'Previous policy copy (renewal / SAOD / rollover)',
    'Valid Driving License copy',
    'Vehicle inspection report / photographs (break-in / SAOD cases)',
    'KYC documents (PAN, Address Proof)',
    'Route Permit copy',
    'Fitness Certificate',
    'National Permit (if applicable)',
    'Pollution Under Control (PUC) Certificate',
    'Goods Carrying Permit',
  ],
  TRACTOR: [
    'Copy of Registration Certificate (RC)',
    'Previous policy copy (renewal / SAOD / rollover)',
    'Valid Driving License copy',
    'Vehicle inspection report / photographs (break-in / SAOD cases)',
    'KYC documents (PAN, Address Proof)',
    'Agricultural usage certificate (if claiming agri tariff)',
  ],
  AUTO: [
    'Copy of Registration Certificate (RC)',
    'Previous policy copy (renewal / SAOD / rollover)',
    'Valid Driving License copy',
    'Vehicle inspection report / photographs (break-in / SAOD cases)',
    'KYC documents (PAN, Address Proof)',
    'Permit copy',
    'PUC Certificate',
  ],
  TAXI: [
    'Copy of Registration Certificate (RC)',
    'Previous policy copy (renewal / SAOD / rollover)',
    'Valid Driving License copy',
    'Vehicle inspection report / photographs (break-in / SAOD cases)',
    'KYC documents (PAN, Address Proof)',
    'Permit copy (Contract Carriage / Tourist)',
    'Aggregator agreement (if applicable)',
    'PUC Certificate',
    'Commercial (Badge) Driving License of driver',
  ],
  BUS_COACH: [
    'Copy of Registration Certificate (RC)',
    'Previous policy copy (renewal / SAOD / rollover)',
    'Valid Driving License copy',
    'Vehicle inspection report / photographs (break-in / SAOD cases)',
    'KYC documents (PAN, Address Proof)',
    'Route Permit copy',
    'Fitness Certificate',
    'School Bus Compliance Certificate (if applicable)',
    'PUC Certificate',
  ],
  MISC_CLASS_D: [
    'Copy of Registration Certificate (RC)',
    'Previous policy copy (renewal / SAOD / rollover)',
    'Valid Driving License copy',
    'Vehicle inspection report / photographs (break-in / SAOD cases)',
    'KYC documents (PAN, Address Proof)',
    'Purpose-specific operating certification',
    'Fitness Certificate',
  ],
};

// ------------------------------------------------------------------
// POLICY TENURE OPTIONS per category + policy type
// ------------------------------------------------------------------
export function getPolicyTenureOptions(category: VehicleCategory, policyType: string): string[] {
  if (policyType === 'SAOD') return []; // SAOD has no tenure dropdown
  if (category === 'BIKE') {
    return ['1 Year (Standard)', '5-Year Long Term TP (new two-wheelers)'];
  }
  if (category === 'PRIVATE_CAR') {
    return ['1 Year (Standard)', '3-Year Long Term TP (new private cars)'];
  }
  // Commercial vehicles — no long term TP
  return ['1 Year (Standard)'];
}

// ADDON OPTIONS
export const ADDON_OPTIONS = [
  { key: 'ZERO_DEP', label: 'Zero Depreciation' },
  { key: 'ENGINE_PROTECT', label: 'Engine Protection' },
  { key: 'RSA', label: 'Road Side Assistance (RSA)' },
  { key: 'RTI', label: 'Return to Invoice (RTI)' },
  { key: 'CONSUMABLES', label: 'Consumables Cover' },
  { key: 'NCB_PROTECT', label: 'NCB Protection' },
];

export const NCB_OPTIONS = [
  { value: '0', label: '0% — New / Prior Claim' },
  { value: '20', label: '20% — 1 Claim-Free Year' },
  { value: '25', label: '25% — 2 Claim-Free Years' },
  { value: '35', label: '35% — 3 Claim-Free Years' },
  { value: '45', label: '45% — 4 Claim-Free Years' },
  { value: '50', label: '50% — 5+ Claim-Free Years' },
];

export const LEAD_SOURCE_OPTIONS = [
  'Walk-in', 'Referral', 'Advisor', 'Digital', 'Renewal', 'Cross-sell',
];

export const INSURER_OPTIONS = [
  'ICICI Lombard General Insurance',
  'HDFC ERGO General Insurance',
  'Bajaj Allianz General Insurance',
  'Tata AIG General Insurance',
  'New India Assurance',
  'United India Insurance',
  'National Insurance',
  'Oriental Insurance',
  'SBI General Insurance',
  'Reliance General Insurance',
  'Go Digit General Insurance',
  'Cholamandalam MS General Insurance',
  'Royal Sundaram General Insurance',
  'Shriram General Insurance',
  'Future Generali India Insurance',
];

export const CATEGORY_LABEL: Record<VehicleCategory, string> = {
  BIKE: 'Two-Wheeler (Bike)',
  PRIVATE_CAR: 'Private Car',
  GCV: 'Goods Vehicle (GCV)',
  TRACTOR: 'Tractor',
  AUTO: 'Auto / Three-Wheeler',
  TAXI: 'Taxi / Cab',
  BUS_COACH: 'Bus & Coaches',
  MISC_CLASS_D: 'Miscellaneous (Class D)',
};

export const POLICY_TYPE_LABEL: Record<string, string> = {
  TP_ONLY: 'Third Party Only',
  SAOD: 'Standalone OD',
  PACKAGE: 'Package / Comprehensive',
};
