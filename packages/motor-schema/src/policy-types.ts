export type PolicyTypeKey = 'TP_ONLY' | 'SAOD' | 'PACKAGE';

export interface PolicyTypeDefinition {
  id: PolicyTypeKey;
  label: string;
  short: string;
  description: string;
  allowsNewVehicle: boolean;
  requiresActiveTp: boolean;
  calculatesOd: boolean;
  calculatesTp: boolean;
}

export const POLICY_TYPES: PolicyTypeDefinition[] = [
  {
    id: 'TP_ONLY',
    label: 'Third Party (TP) Only',
    short: 'TP Only',
    description: 'Statutory Liability Only cover — IRDAI mandatory minimum',
    allowsNewVehicle: true,
    requiresActiveTp: false,
    calculatesOd: false,
    calculatesTp: true,
  },
  {
    id: 'SAOD',
    label: 'Standalone Own Damage (SAOD)',
    short: 'SAOD',
    description: 'Own damage cover for existing vehicles with an active standalone TP policy',
    allowsNewVehicle: false,
    requiresActiveTp: true,
    calculatesOd: true,
    calculatesTp: false,
  },
  {
    id: 'PACKAGE',
    label: 'Package / Comprehensive (OD + TP)',
    short: 'Package',
    description: 'Combined Own Damage and Third Party coverage in a single policy',
    allowsNewVehicle: true,
    requiresActiveTp: false,
    calculatesOd: true,
    calculatesTp: true,
  },
];
