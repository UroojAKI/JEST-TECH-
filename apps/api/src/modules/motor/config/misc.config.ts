import { VehicleCategoryConfig } from './types';

export const miscConfig: VehicleCategoryConfig = {
  category: 'MISC_CLASS_D',
  label: 'Miscellaneous Class D (Ambulance / Crane / Construction)',
  displayName: 'Special Commercial & Construction Equipment Insurance',
  engineMetric: 'hp',
  metricLabel: 'Engine Rating (HP) / GVW (kg)',
  tariffTiers: [
    { min: 0, max: 50, label: 'Light Special Equipment' },
    { min: 51, max: 150, label: 'Medium Construction Equipment' },
    { min: 151, label: 'Heavy Earthmoving / Mobile Crane' },
  ],
  fields: [
    {
      name: 'equipmentType',
      label: 'Equipment Sub-Classification',
      type: 'select',
      required: true,
      options: [
        { label: 'Ambulance / Emergency Vehicle', value: 'AMBULANCE' },
        { label: 'Hydraulic Mobile Crane', value: 'MOBILE_CRANE' },
        { label: 'Forklift / Material Handling', value: 'FORKLIFT' },
        { label: 'JCB / Backhoe Loader / Excavator', value: 'EXCAVATOR' },
        { label: 'Road Roller / Asphalt Paver', value: 'ROAD_ROLLER' },
        { label: 'Fire Brigade Vehicle', value: 'FIRE_ENGINE' },
      ],
    },
    {
      name: 'operatingEnvironment',
      label: 'Operating Area',
      type: 'select',
      required: true,
      options: [
        { label: 'Confined Site / Factory Premises Only', value: 'SITE_ONLY' },
        { label: 'Public Roads and Sites', value: 'PUBLIC_ROADS' },
      ],
    },
  ],
  allowedAddons: [
    {
      code: 'LEGAL_LIABILITY_OPERATOR',
      name: 'Legal Liability to Equipment Operator / Helper',
      description: 'Covers crane operator or certified machine driver',
      defaultSelected: true,
    },
    {
      code: 'TOWING_OVERSIZED',
      name: 'Oversized Heavy Equipment Towing Cover',
      description: 'Specialized low-bed recovery',
    },
  ],
  requiredDocuments: {
    newVehicle: [
      'Equipment Tax Invoice',
      'Manufacturer Specification Sheet',
      'Factory Gate Pass',
    ],
    existingComprehensive: [
      'Equipment Registration / Serial RC',
      'Factory Inspector Certificate',
    ],
    breakInInspection: [
      'Physical Surveyor Machinery Breakdown & Condition Report',
    ],
    tpOnly: ['Equipment RC / Invoice', 'Owner Proof'],
  },
};
