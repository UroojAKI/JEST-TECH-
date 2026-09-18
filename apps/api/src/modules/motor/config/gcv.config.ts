import { VehicleCategoryConfig } from './types';

export const gcvConfig: VehicleCategoryConfig = {
  category: 'GCV',
  label: 'Goods Carrying Vehicle (Truck / LCV / HCV)',
  displayName: 'Commercial Goods Vehicle Insurance',
  engineMetric: 'gvw',
  metricLabel: 'Gross Vehicle Weight (GVW in Kilograms)',
  tariffTiers: [
    { min: 0, max: 7500, label: 'Not exceeding 7,500 kg (Light Commercial Vehicle)' },
    { min: 7501, max: 12000, label: '7,501 kg to 12,000 kg (Medium Commercial Vehicle)' },
    { min: 12001, max: 20000, label: '12,001 kg to 20,000 kg (Heavy Commercial Vehicle)' },
    { min: 20001, max: 40000, label: '20,001 kg to 40,000 kg (Multi-Axle Vehicle)' },
    { min: 40001, label: 'Exceeding 40,000 kg' },
  ],
  fields: [
    { name: 'gvwKg', label: 'Gross Vehicle Weight (GVW in kg)', type: 'number', required: true, min: 1000, max: 65000 },
    { name: 'carrierType', label: 'Carrier License Type', type: 'select', required: true, options: [
      { label: 'Public Carrier (Commercial for hire)', value: 'PUBLIC' },
      { label: 'Private Carrier (Own goods transport)', value: 'PRIVATE' },
    ]},
    { name: 'permitType', label: 'Permit Type', type: 'select', required: true, options: [
      { label: 'National Permit (All India)', value: 'NATIONAL' },
      { label: 'State Permit', value: 'STATE' },
    ]},
    { name: 'coolieCount', label: 'Number of Cleaners / Coolies Employed', type: 'number', required: false, min: 0, max: 6 },
  ],
  allowedAddons: [
    { code: 'IMT_23', name: 'IMT 23 Comprehensive Lamp/Fender Cover', description: 'Covers accidental damage to lamps, tyres, mudguards, and bonnet' },
    { code: 'LEGAL_LIABILITY_COOLIE', name: 'Legal Liability to Coolies / Cleaners', description: 'Workmen Compensation cover for loading/unloading personnel' },
    { code: 'LEGAL_LIABILITY_PAID_DRIVER', name: 'Legal Liability to Paid Driver', description: 'Covers commercial driver liability', defaultSelected: true },
    { code: 'ZERO_DEP', name: 'Zero Depreciation', description: 'Commercial vehicle bumper-to-bumper cover', maxVehicleAgeYears: 3 },
  ],
  requiredDocuments: {
    newVehicle: ['Commercial Invoice', 'Chassis Form 21', 'GST Registration Certificate'],
    existingComprehensive: ['RC Copy with GVW endorsement', 'Valid Fitness Certificate', 'Commercial Route Permit'],
    breakInInspection: ['RC Copy', 'Commercial Fitness Certificate', 'Surveyor Physical Inspection Report'],
    tpOnly: ['RC Copy', 'Commercial Route Permit', 'Owner KYC'],
  },
};
