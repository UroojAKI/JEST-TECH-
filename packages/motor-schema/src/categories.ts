export type VehicleCategoryKey =
  | 'BIKE'
  | 'PRIVATE_CAR'
  | 'GCV'
  | 'TRACTOR'
  | 'AUTO'
  | 'TAXI'
  | 'BUS_COACH'
  | 'MISC_CLASS_D';

export interface VehicleCategoryDefinition {
  id: VehicleCategoryKey;
  label: string;
  icon: string;
  description: string;
  color: string;
  defaultSubTypes: string[];
}

export const VEHICLE_CATEGORIES: VehicleCategoryDefinition[] = [
  {
    id: 'BIKE',
    label: 'Two-Wheeler (Bike)',
    icon: '🏍️',
    description: 'Scooter, Motorcycle, Moped, Electric Two-Wheeler',
    color: 'from-orange-500 to-amber-500',
    defaultSubTypes: ['Scooter', 'Motorcycle', 'Moped', 'Electric Two-Wheeler'],
  },
  {
    id: 'PRIVATE_CAR',
    label: 'Private Car',
    icon: '🚗',
    description: 'Hatchback, Sedan, SUV, MPV',
    color: 'from-blue-500 to-indigo-500',
    defaultSubTypes: ['Hatchback', 'Sedan', 'SUV', 'MPV'],
  },
  {
    id: 'GCV',
    label: 'Goods Vehicle (GCV)',
    icon: '🚛',
    description: 'LCV, MCV, HCV, Trailer, Tanker',
    color: 'from-slate-500 to-zinc-600',
    defaultSubTypes: ['LCV', 'MCV', 'HCV', 'Trailer', 'Tanker'],
  },
  {
    id: 'TRACTOR',
    label: 'Tractor',
    icon: '🚜',
    description: 'Agricultural & Commercial Tractors',
    color: 'from-green-600 to-emerald-600',
    defaultSubTypes: ['Agricultural Tractor', 'Commercial Haulage Tractor'],
  },
  {
    id: 'AUTO',
    label: 'Auto / Three-Wheeler',
    icon: '🛺',
    description: 'Passenger & Goods Three-Wheelers',
    color: 'from-yellow-500 to-orange-500',
    defaultSubTypes: ['Passenger Carrying Auto', 'Goods Carrying Auto', 'E-Rickshaw'],
  },
  {
    id: 'TAXI',
    label: 'Taxi / Cab',
    icon: '🚕',
    description: 'Contract Carriage, Tourist, Aggregator',
    color: 'from-yellow-400 to-amber-400',
    defaultSubTypes: ['Sedan Taxi', 'Hatchback Taxi', 'SUV / Maxi Cab'],
  },
  {
    id: 'BUS_COACH',
    label: 'Bus & Coaches',
    icon: '🚌',
    description: 'School Bus, Staff Bus, Stage Carriage',
    color: 'from-purple-500 to-violet-600',
    defaultSubTypes: ['School Bus', 'Staff Bus', 'Tourist Coach', 'Stage Carriage'],
  },
  {
    id: 'MISC_CLASS_D',
    label: 'Miscellaneous (Class D)',
    icon: '🏗️',
    description: 'Crane, Forklift, Excavator, Ambulance, Fire Tender',
    color: 'from-rose-500 to-pink-600',
    defaultSubTypes: ['Mobile Crane', 'Forklift', 'Excavator / Backhoe', 'Ambulance', 'Special Purpose Vehicle'],
  },
];
