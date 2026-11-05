import { describe, expect, it } from 'vitest';
import {
  calculateBmi,
  isJointLifeAnnuity,
  isMaskedPii,
  isMinor,
  labelOf,
  PLAN_CATEGORIES,
  SECTION_A_FIELDS,
} from './lifeFormConfig';

describe('Life Insurance Form Config & Underwriting Helpers', () => {
  it('recognizes masked PII while preserving complete values', () => {
    expect(isMaskedPii('XXXXX1234F')).toBe(true);
    expect(isMaskedPii('XXXX-XXXX-9012')).toBe(true);
    expect(isMaskedPii('ABCDE1234F')).toBe(false);
    expect(isMaskedPii('123456789012')).toBe(false);
    expect(isMaskedPii(null)).toBe(false);
  });

  it('calculates BMI accurately from height and weight', () => {
    // 70 kg, 175 cm => 70 / (1.75 * 1.75) = 22.86 => 22.9
    expect(calculateBmi(70, 175)).toBe(22.9);
    // 85 kg, 180 cm => 85 / (1.8 * 1.8) = 26.23 => 26.2
    expect(calculateBmi(85, 180)).toBe(26.2);
    // Invalid / zero inputs
    expect(calculateBmi(0, 175)).toBeNull();
    expect(calculateBmi(70, 0)).toBeNull();
    expect(calculateBmi(null, null)).toBeNull();
  });

  it('determines whether nominee is a minor (< 18 years old)', () => {
    const today = new Date();
    // 10 years ago => minor
    const minorDob = new Date(today.getFullYear() - 10, today.getMonth(), today.getDate()).toISOString().slice(0, 10);
    expect(isMinor(minorDob)).toBe(true);

    // 25 years ago => adult
    const adultDob = new Date(today.getFullYear() - 25, today.getMonth(), today.getDate()).toISOString().slice(0, 10);
    expect(isMinor(adultDob)).toBe(false);

    expect(isMinor(null)).toBe(false);
  });

  it('identifies joint life annuity structures', () => {
    expect(isJointLifeAnnuity('JOINT_LIFE_LAST_SURVIVOR')).toBe(true);
    expect(isJointLifeAnnuity('JOINT_LIFE_WITH_RETURN_OF_PURCHASE_PRICE')).toBe(true);
    expect(isJointLifeAnnuity('LIFE_ANNUITY_SINGLE')).toBe(false);
    expect(isJointLifeAnnuity('LIFE_ANNUITY_RETURN_OF_PURCHASE_PRICE')).toBe(false);
    expect(isJointLifeAnnuity(null)).toBe(false);
  });

  it('configures all 8 IRDAI life plan categories with Section A fields', () => {
    expect(PLAN_CATEGORIES).toHaveLength(8);
    const categoryCodes = PLAN_CATEGORIES.map((c) => c.value);

    expect(categoryCodes).toContain('TERM_LIFE');
    expect(categoryCodes).toContain('TERM_WITH_ROP');
    expect(categoryCodes).toContain('ULIP');
    expect(categoryCodes).toContain('ENDOWMENT');
    expect(categoryCodes).toContain('MONEY_BACK');
    expect(categoryCodes).toContain('WHOLE_LIFE');
    expect(categoryCodes).toContain('CHILD_PLAN');
    expect(categoryCodes).toContain('ANNUITY_PENSION');

    for (const code of categoryCodes) {
      expect(SECTION_A_FIELDS[code]).toBeDefined();
      expect(SECTION_A_FIELDS[code].length).toBeGreaterThan(0);
    }
  });

  it('resolves labels safely via labelOf', () => {
    expect(labelOf(PLAN_CATEGORIES, 'TERM_LIFE')).toBe('Term Life Insurance');
    expect(labelOf(PLAN_CATEGORIES, 'UNKNOWN')).toBe('UNKNOWN');
    expect(labelOf(PLAN_CATEGORIES, null)).toBe('-');
  });
});

