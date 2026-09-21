import { VehicleCategoryConfig } from './types';

export const bikeConfig: VehicleCategoryConfig = {
  category: 'BIKE',
  label: 'Two-Wheeler (Motorcycle / Scooter)',
  displayName: 'Two-Wheeler Insurance',
  engineMetric: 'cc',
  metricLabel: 'Engine Capacity (Cubic Centimeters - CC)',
  tariffTiers: [
    { min: 0, max: 75, label: 'Not exceeding 75 cc' },
    { min: 76, max: 150, label: '76 cc to 150 cc' },
    { min: 151, max: 350, label: '151 cc to 350 cc' },
    { min: 351, label: 'Exceeding 350 cc' },
  ],
  fields: [
    {
      name: 'engineCc',
      label: 'Engine Capacity (CC)',
      type: 'number',
      required: true,
      min: 50,
      max: 2500,
    },
    {
      name: 'fuelType',
      label: 'Fuel Type',
      type: 'select',
      required: true,
      options: [
        { label: 'Petrol', value: 'PETROL' },
        { label: 'Electric (EV)', value: 'ELECTRIC' },
      ],
    },
    {
      name: 'isElectric',
      label: 'Electric Two-Wheeler',
      type: 'boolean',
      required: false,
    },
    {
      name: 'batteryCapacityKwh',
      label: 'Battery Capacity (kWh)',
      type: 'number',
      required: false,
    },
  ],
  allowedAddons: [
    {
      code: 'ZERO_DEP',
      name: 'Zero Depreciation (Bumper to Bumper)',
      description:
        'Full claim settlement without plastic/rubber/metal depreciation',
      maxVehicleAgeYears: 5,
    },
    {
      code: 'PA_OWNER_DRIVER',
      name: 'Compulsory Personal Accident (Owner Driver)',
      description: '?15 Lakh personal accident cover for owner driver',
      defaultSelected: true,
    },
    {
      code: 'ROADSIDE_ASSIST',
      name: '24x7 Roadside Assistance',
      description: 'Emergency breakdown towing, puncture, and fuel support',
    },
    {
      code: 'ENGINE_PROTECT',
      name: 'Engine & Gearbox Protection',
      description: 'Covers water ingress and hydrostatic lock repair',
    },
    {
      code: 'CONSUMABLES',
      name: 'Consumables Cover',
      description:
        'Covers oil, nuts, bolts, lubricants consumed during claim repair',
    },
  ],
  requiredDocuments: {
    newVehicle: [
      'Vehicle Tax Invoice',
      'Sales Certificate (Form 21)',
      'Aadhaar / Passport KYC',
    ],
    existingComprehensive: [
      'Registration Certificate (RC)',
      'Previous Year Policy Copy',
    ],
    breakInInspection: [
      'RC Copy',
      'Previous Policy Copy',
      'Self-Inspection 7-Photo Evidence',
    ],
    tpOnly: ['RC Copy', 'Owner KYC'],
  },
};
