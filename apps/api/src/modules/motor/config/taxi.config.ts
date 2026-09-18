import { VehicleCategoryConfig } from './types';

export const taxiConfig: VehicleCategoryConfig = {
  category: 'TAXI',
  label: 'Taxi / Cab (4-Wheeler Passenger Carrying)',
  displayName: 'Taxi & Tourist Cab Insurance',
  engineMetric: 'seatingCapacity',
  metricLabel: 'Seating Capacity (Excluding Driver)',
  tariffTiers: [
    { min: 1, max: 4, label: 'Up to 4 Passengers (Sedan / Hatchback Taxi)' },
    { min: 5, max: 6, label: '5 to 6 Passengers (SUV / MUV Taxi)' },
  ],
  fields: [
    { name: 'seatingCapacity', label: 'Seating Capacity (inc. Driver)', type: 'number', required: true, min: 4, max: 7 },
    { name: 'permitType', label: 'Taxi Permit Type', type: 'select', required: true, options: [
      { label: 'All India Tourist Permit (AITP)', value: 'AITP' },
      { label: 'City Cab Permit (Ola/Uber/Meter)', value: 'CITY_CAB' },
      { label: 'State Stage Carriage', value: 'STAGE_CARRIAGE' },
    ]},
    { name: 'fuelType', label: 'Fuel Type', type: 'select', required: true, options: [
      { label: 'CNG / Petrol Bi-Fuel', value: 'CNG' },
      { label: 'Diesel', value: 'DIESEL' },
      { label: 'Electric (EV Fleet)', value: 'ELECTRIC' },
    ]},
  ],
  allowedAddons: [
    { code: 'PA_PASSENGERS', name: 'Passenger Personal Accident Cover', description: 'Legal liability & PA for paid passengers', defaultSelected: true },
    { code: 'LEGAL_LIABILITY_PAID_DRIVER', name: 'Legal Liability to Chauffeur / Driver', description: 'Protects commercial fleet operator', defaultSelected: true },
    { code: 'ZERO_DEP', name: 'Zero Depreciation for Taxi', description: 'Nil depreciation on replacement parts', maxVehicleAgeYears: 3 },
  ],
  requiredDocuments: {
    newVehicle: ['Commercial Car Invoice', 'Form 21', 'Commercial Taxi Permit'],
    existingComprehensive: ['RC with Commercial Yellow Plate Endorsement', 'Fitness Certificate', 'Permit Copy'],
    breakInInspection: ['RC Copy', 'Fitness Certificate', 'Break-in Inspection Report'],
    tpOnly: ['RC Copy', 'Commercial Permit'],
  },
};
