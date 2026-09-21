import { VehicleCategoryConfig } from './types';

export const privateCarConfig: VehicleCategoryConfig = {
  category: 'PRIVATE_CAR',
  label: 'Private Car',
  displayName: 'Private Car Insurance',
  engineMetric: 'cc',
  metricLabel: 'Cubic Capacity (CC)',
  tariffTiers: [
    { min: 0, max: 1000, label: 'Not exceeding 1000 cc' },
    { min: 1001, max: 1500, label: '1001 cc to 1500 cc' },
    { min: 1501, label: 'Exceeding 1500 cc' },
  ],
  fields: [
    {
      name: 'engineCc',
      label: 'Engine Capacity (CC)',
      type: 'number',
      required: true,
      min: 600,
      max: 7000,
    },
    {
      name: 'seatingCapacity',
      label: 'Seating Capacity',
      type: 'number',
      required: true,
      min: 2,
      max: 10,
      placeholder: '5',
    },
    {
      name: 'fuelType',
      label: 'Fuel Type',
      type: 'select',
      required: true,
      options: [
        { label: 'Petrol', value: 'PETROL' },
        { label: 'Diesel', value: 'DIESEL' },
        { label: 'CNG (Company Fitted)', value: 'CNG' },
        { label: 'Electric (EV)', value: 'ELECTRIC' },
        { label: 'Hybrid', value: 'HYBRID' },
      ],
    },
    {
      name: 'cngKitValue',
      label: 'Bi-Fuel / CNG Kit Value (?)',
      type: 'number',
      required: false,
    },
  ],
  allowedAddons: [
    {
      code: 'ZERO_DEP',
      name: 'Nil Depreciation (Bumper to Bumper)',
      description:
        'Zero deduction on all replaced parts including rubber and fiber',
      maxVehicleAgeYears: 7,
    },
    {
      code: 'ENGINE_PROTECT',
      name: 'Engine & Gearbox Protector',
      description:
        'Protects against water ingress hydrostatic lock and oil leakage',
    },
    {
      code: 'RTI',
      name: 'Return to Invoice (RTI)',
      description:
        'Pays full on-road purchase invoice value in case of total loss or theft',
      maxVehicleAgeYears: 3,
    },
    {
      code: 'TYRE_PROTECT',
      name: 'Tyre & Rim Safeguard',
      description: 'Covers tyre cut, burst, and alloy rim damage',
    },
    {
      code: 'KEY_REPLACEMENT',
      name: 'Key & Lock Replacement',
      description: 'Reimburses lost key replacement and lockset repair cost',
    },
    {
      code: 'ROADSIDE_ASSIST',
      name: '24x7 Roadside Assistance',
      description: 'Pan-India towing, flat tyre, and emergency fuel support',
      defaultSelected: true,
    },
    {
      code: 'PA_OWNER_DRIVER',
      name: 'Compulsory Personal Accident (?15 Lakhs)',
      description: 'IRDAI mandatory PA cover for owner-driver',
      defaultSelected: true,
    },
    {
      code: 'LEGAL_LIABILITY_PAID_DRIVER',
      name: 'Legal Liability to Paid Driver',
      description: 'Covers employer liability under Workmen Compensation Act',
      defaultSelected: true,
    },
  ],
  requiredDocuments: {
    newVehicle: [
      'Proforma Invoice / Final Invoice',
      'Form 21 Sale Certificate',
      'PAN Card & Aadhaar KYC',
    ],
    existingComprehensive: [
      'Registration Certificate (RC)',
      'Expiring Policy Schedule',
      'NCB Certificate / Declaration',
    ],
    breakInInspection: [
      'RC Copy',
      'Break-in 7-Angle Inspection Photos',
      'Chassis Imprint Photo',
    ],
    tpOnly: ['RC Copy', 'Owner Driver Driving License / Proof'],
  },
};
