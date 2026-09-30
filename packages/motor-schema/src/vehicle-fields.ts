import { VehicleCategoryKey } from './categories';

export interface FieldDef {
  key: string;
  label: string;
  type: 'text' | 'dropdown' | 'date' | 'numeric' | 'boolean' | 'alphanumeric';
  mandatory: boolean | 'conditional';
  options?: string[];
  placeholder?: string;
  hint?: string;
}

export const VEHICLE_FIELDS: Record<VehicleCategoryKey, FieldDef[]> = {
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
    { key: 'seatingCapacity', label: 'Seating Capacity (incl. driver)', type: 'numeric', mandatory: false },
    { key: 'carryingCapacityGvw', label: 'Carrying Capacity / GVW (kg)', type: 'numeric', mandatory: false },
    { key: 'manufactureYearMonth', label: 'Manufacture Year / Month', type: 'date', mandatory: false },
    { key: 'dateOfRegistration', label: 'Date of Registration', type: 'date', mandatory: false },
    { key: 'engineChassisNumber', label: 'Engine / Chassis Number', type: 'alphanumeric', mandatory: false },
    { key: 'fuelType', label: 'Fuel Type', type: 'dropdown', mandatory: false, options: ['CNG', 'Petrol', 'LPG', 'Electric', 'Diesel'] },
    { key: 'permitType', label: 'Permit Type', type: 'dropdown', mandatory: false, options: ['City Permit', 'District Permit', 'State Permit'] },
  ],
  TAXI: [
    { key: 'registrationNumber', label: 'Registration Number', type: 'alphanumeric', mandatory: true },
    { key: 'vehicleSubType', label: 'Vehicle Sub-Type', type: 'dropdown', mandatory: true, options: ['Sedan', 'Hatchback', 'SUV / MUV', 'Maxi Cab'] },
    { key: 'makeModelVariant', label: 'Make, Model & Variant', type: 'text', mandatory: false },
    { key: 'seatingCapacity', label: 'Seating Capacity (incl. driver)', type: 'numeric', mandatory: true },
    { key: 'engineCapacity', label: 'Engine Capacity (CC)', type: 'numeric', mandatory: false },
    { key: 'manufactureYearMonth', label: 'Manufacture Year / Month', type: 'date', mandatory: false },
    { key: 'dateOfRegistration', label: 'Date of Registration', type: 'date', mandatory: false },
    { key: 'engineChassisNumber', label: 'Engine / Chassis Number', type: 'alphanumeric', mandatory: false },
    { key: 'fuelType', label: 'Fuel Type', type: 'dropdown', mandatory: false, options: ['Petrol', 'Diesel', 'CNG', 'Electric'] },
    { key: 'permitType', label: 'Permit Type', type: 'dropdown', mandatory: false, options: ['Tourist Permit', 'All India Tourist Permit (AITP)', 'State Permit', 'City / Local'] },
  ],
  BUS_COACH: [
    { key: 'registrationNumber', label: 'Registration Number', type: 'alphanumeric', mandatory: true },
    { key: 'vehicleSubType', label: 'Vehicle Sub-Type', type: 'dropdown', mandatory: true, options: ['School Bus', 'Staff Bus', 'Tourist Bus', 'Stage Carriage', 'Contract Carriage'] },
    { key: 'makeModel', label: 'Make & Model', type: 'text', mandatory: false },
    { key: 'seatingCapacity', label: 'Seating Capacity (Licensed)', type: 'numeric', mandatory: true },
    { key: 'manufactureYearMonth', label: 'Manufacture Year / Month', type: 'date', mandatory: false },
    { key: 'dateOfRegistration', label: 'Date of Registration', type: 'date', mandatory: false },
    { key: 'engineChassisNumber', label: 'Engine / Chassis Number', type: 'alphanumeric', mandatory: false },
    { key: 'fuelType', label: 'Fuel Type', type: 'dropdown', mandatory: false, options: ['Diesel', 'CNG', 'Electric'] },
    { key: 'usageCategory', label: 'Usage Category', type: 'dropdown', mandatory: true, options: ['Educational Institution (School/College)', 'Staff Transport', 'Public Transport', 'Tourist Transport'] },
    { key: 'acNonAc', label: 'AC / Non-AC', type: 'dropdown', mandatory: false, options: ['Non-AC', 'AC'] },
  ],
  MISC_CLASS_D: [
    { key: 'registrationNumber', label: 'Registration Number', type: 'alphanumeric', mandatory: true },
    { key: 'vehicleSubType', label: 'Vehicle Sub-Type', type: 'dropdown', mandatory: true, options: ['Mobile Crane', 'Forklift', 'Ambulance', 'Fire Tender', 'Excavator / Backhoe Loader', 'Road Roller', 'Other Special Type'] },
    { key: 'makeModel', label: 'Make & Model', type: 'text', mandatory: false },
    { key: 'equipmentCapacity', label: 'Equipment Capacity (Tonnage / CC / HP)', type: 'text', mandatory: false },
    { key: 'manufactureYearMonth', label: 'Manufacture Year / Month', type: 'date', mandatory: false },
    { key: 'dateOfRegistration', label: 'Date of Registration', type: 'date', mandatory: false },
    { key: 'engineChassisNumber', label: 'Engine / Chassis Number', type: 'alphanumeric', mandatory: false },
    { key: 'fuelType', label: 'Fuel Type', type: 'dropdown', mandatory: false, options: ['Diesel', 'Petrol', 'Electric', 'LPG'] },
    { key: 'usageType', label: 'Usage Type', type: 'dropdown', mandatory: true, options: ['Site Only (Not on Public Road)', 'Public Road & Site', 'Commercial Hire'] },
  ],
};
