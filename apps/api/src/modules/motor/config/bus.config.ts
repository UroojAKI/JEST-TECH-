import { VehicleCategoryConfig } from './types';

export const busConfig: VehicleCategoryConfig = {
  category: 'BUS_COACH',
  label: 'Bus & Staff / School Coach',
  displayName: 'Bus & Commercial Passenger Transport Insurance',
  engineMetric: 'seatingCapacity',
  metricLabel: 'Passenger Carrying Capacity',
  tariffTiers: [
    { min: 7, max: 18, label: '7 to 18 Passengers (Mini Bus / Traveller)' },
    { min: 19, max: 36, label: '19 to 36 Passengers (Medium Bus)' },
    { min: 37, label: 'Exceeding 36 Passengers (Heavy Coach)' },
  ],
  fields: [
    {
      name: 'seatingCapacity',
      label: 'Total Seating Capacity',
      type: 'number',
      required: true,
      min: 7,
      max: 65,
    },
    {
      name: 'busType',
      label: 'Bus Purpose / Usage',
      type: 'select',
      required: true,
      options: [
        { label: 'School Bus (Educational Institution)', value: 'SCHOOL_BUS' },
        { label: 'Staff / Corporate Transit Bus', value: 'STAFF_BUS' },
        {
          label: 'Intercity Tourist Bus (Luxury / Sleeper)',
          value: 'INTERCITY_TOURIST',
        },
        { label: 'Stage Carriage (State Transport)', value: 'STAGE_CARRIAGE' },
      ],
    },
    {
      name: 'conductorCount',
      label: 'Number of Conductors / Attendants',
      type: 'number',
      required: false,
      min: 0,
      max: 3,
    },
  ],
  allowedAddons: [
    {
      code: 'LEGAL_LIABILITY_CONDUCTOR',
      name: 'Legal Liability to Conductor & Cleaner',
      description: 'Covers bus conductor, attendant and cleaner',
    },
    {
      code: 'PA_PASSENGERS',
      name: 'Passenger Accident Scheme',
      description: 'Covers all travelling passengers',
      defaultSelected: true,
    },
    {
      code: 'LEGAL_LIABILITY_PAID_DRIVER',
      name: 'Legal Liability to Paid Driver',
      description: 'Driver liability',
      defaultSelected: true,
    },
  ],
  requiredDocuments: {
    newVehicle: ['Bus Chassis Invoice', 'Body Builder Invoice', 'Form 21 & 22'],
    existingComprehensive: [
      'Bus RC Copy',
      'Passenger Transport Permit',
      'Speed Governor Certificate',
      'Fitness Certificate',
    ],
    breakInInspection: [
      'Bus RC Copy',
      'Valid Fitness Certificate',
      'Surveyor Bus Inspection Report',
    ],
    tpOnly: ['RC Copy', 'Passenger Permit'],
  },
};
