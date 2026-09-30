export interface InspectionPhotoSlot {
  code: string;
  label: string;
  description: string;
  mandatory: boolean;
}

export const MANDATORY_INSPECTION_SLOTS: InspectionPhotoSlot[] = [
  { code: 'FRONT', label: 'Front View', description: 'Full front view including registration plate', mandatory: true },
  { code: 'REAR', label: 'Rear View', description: 'Full rear view including registration plate', mandatory: true },
  { code: 'LEFT', label: 'Left Side View', description: 'Full left side profile of vehicle', mandatory: true },
  { code: 'RIGHT', label: 'Right Side View', description: 'Full right side profile of vehicle', mandatory: true },
  { code: 'CHASSIS_PLATE', label: 'Chassis Number Plate', description: 'Close-up of engraved chassis/VIN plate', mandatory: true },
  { code: 'ENGINE_BAY', label: 'Engine Compartment', description: 'Open engine bay showing engine block and number', mandatory: true },
  { code: 'ODOMETER', label: 'Odometer Reading', description: 'Clear photo of dashboard showing kilometers reading', mandatory: true },
];

export interface DocumentChecklistRule {
  code: string;
  name: string;
  requiredFor: {
    vehicleStatus?: ('NEW' | 'EXISTING')[];
    policyTypes?: ('TP_ONLY' | 'SAOD' | 'PACKAGE')[];
    inspectionRequired?: boolean;
  };
}

export const MOTOR_DOCUMENT_CHECKLIST: DocumentChecklistRule[] = [
  {
    code: 'INSURER_QUOTE',
    name: 'Insurer Official Quotation Copy',
    requiredFor: { policyTypes: ['TP_ONLY', 'SAOD', 'PACKAGE'] },
  },
  {
    code: 'RC',
    name: 'Registration Certificate (RC) Copy',
    requiredFor: { vehicleStatus: ['EXISTING'] },
  },
  {
    code: 'FORM_21',
    name: 'Sale Certificate / Form 21 / Invoice',
    requiredFor: { vehicleStatus: ['NEW'] },
  },
  {
    code: 'PREVIOUS_POLICY',
    name: 'Expiring / Previous Policy Copy',
    requiredFor: { vehicleStatus: ['EXISTING'], policyTypes: ['SAOD', 'PACKAGE'] },
  },
  {
    code: 'ACTIVE_TP_POLICY',
    name: 'Active Standalone TP Policy Copy',
    requiredFor: { policyTypes: ['SAOD'] },
  },
];
