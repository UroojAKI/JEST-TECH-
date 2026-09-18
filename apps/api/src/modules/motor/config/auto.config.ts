import { VehicleCategoryConfig } from './types';

export const autoConfig: VehicleCategoryConfig = {
  category: 'AUTO',
  label: 'Three-Wheeler (Auto Rickshaw / Passenger)',
  displayName: 'Auto Rickshaw & 3-Wheeler Insurance',
  engineMetric: 'seatingCapacity',
  metricLabel: 'Passenger Seating Capacity',
  tariffTiers: [
    { min: 1, max: 3, label: 'Up to 3 Passengers' },
    { min: 4, max: 6, label: '4 to 6 Passengers' },
  ],
  fields: [
    { name: 'passengerCapacity', label: 'Licensed Passenger Capacity', type: 'number', required: true, min: 3, max: 6 },
    { name: 'fuelType', label: 'Fuel Type', type: 'select', required: true, options: [
      { label: 'CNG', value: 'CNG' },
      { label: 'LPG', value: 'LPG' },
      { label: 'Electric (E-Rickshaw)', value: 'ELECTRIC' },
      { label: 'Petrol', value: 'PETROL' },
      { label: 'Diesel', value: 'DIESEL' },
    ]},
    { name: 'fareMeterFitted', label: 'Digital Fare Meter Fitted', type: 'boolean', required: false },
  ],
  allowedAddons: [
    { code: 'PA_PASSENGERS', name: 'PA Cover for Passengers', description: '?1 Lakh to ?2 Lakh accident cover per passenger', defaultSelected: true },
    { code: 'LEGAL_LIABILITY_PAID_DRIVER', name: 'Legal Liability to Driver', description: 'Covers auto driver liability', defaultSelected: true },
  ],
  requiredDocuments: {
    newVehicle: ['Vehicle Invoice', 'Form 21', 'City Taxi/Auto Permit Letter'],
    existingComprehensive: ['Auto Rickshaw RC Copy', 'Auto Permit & Fitness Copy'],
    breakInInspection: ['Auto RC Copy', 'Fitness Certificate', 'Vehicle Photos'],
    tpOnly: ['RC Copy', 'Permit Copy'],
  },
};
