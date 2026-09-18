import { VehicleCategoryConfig } from './types';

export const tractorConfig: VehicleCategoryConfig = {
  category: 'TRACTOR',
  label: 'Tractor & Agricultural Vehicle',
  displayName: 'Tractor Insurance',
  engineMetric: 'hp',
  metricLabel: 'Engine Horsepower (HP)',
  tariffTiers: [
    { min: 0, max: 35, label: 'Not exceeding 35 HP' },
    { min: 36, max: 50, label: '36 HP to 50 HP' },
    { min: 51, label: 'Exceeding 50 HP' },
  ],
  fields: [
    { name: 'horsePower', label: 'Horsepower (HP)', type: 'number', required: true, min: 15, max: 150 },
    { name: 'usageType', label: 'Usage Purpose', type: 'select', required: true, options: [
      { label: 'Agriculture & Farming Only', value: 'AGRICULTURE' },
      { label: 'Commercial / Haulage / Infrastructure', value: 'COMMERCIAL' },
    ]},
    { name: 'hasTrailer', label: 'Attached Trolley / Trailer', type: 'boolean', required: false },
    { name: 'trailerIdv', label: 'Trailer IDV (?)', type: 'number', required: false },
  ],
  allowedAddons: [
    { code: 'TRAILER_COVER', name: 'Trailer / Trolley Comprehensive Cover', description: 'Covers attached agricultural or commercial trailer' },
    { code: 'LEGAL_LIABILITY_PAID_DRIVER', name: 'Legal Liability to Driver', description: 'Driver liability cover', defaultSelected: true },
    { code: 'PA_UNNAMED_PASSENGERS', name: 'PA Cover for Farm Helpers', description: 'Accident cover for agricultural helpers' },
  ],
  requiredDocuments: {
    newVehicle: ['Tractor Dealership Invoice', 'Form 21', 'Farmer 7/12 Land Record / Kisan Card'],
    existingComprehensive: ['RC Copy', 'Previous Policy Copy'],
    breakInInspection: ['RC Copy', 'Inspection Photos'],
    tpOnly: ['RC Copy', 'Farmer Proof / Aadhaar'],
  },
};
