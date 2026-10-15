import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PolicyFormPackageForm } from './PolicyFormPackage';
import { PolicyFormTPOnlyForm } from './PolicyFormTP';
import { useMotorCalculator } from './useMotorCalculator';

vi.mock('./useMotorCalculator', () => ({
  useMotorCalculator: vi.fn(),
}));

vi.mock('./GstRateSelector', () => ({
  GstRateSelector: () => <div data-testid="gst-rate-selector" />,
}));

describe('Work Package 2 & PR-01: Discount & Commission Decoupling Regression Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMotorCalculator).mockReturnValue({
      result: null,
      loading: false,
      error: null,
    });
  });

  describe('PolicyFormPackage Discount & Commission Coupling Defects', () => {
    it('T-02 regression: editing OD discount must NOT mutate or write into odCommissionCalc', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        policyTenure: '1',
        idv: '500000',
        odDiscountPercent: '0',
        odCommissionCalc: undefined,
      };

      render(
        <PolicyFormPackageForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      const odDiscountInput = screen.getByPlaceholderText('e.g. 10%');
      fireEvent.change(odDiscountInput, { target: { value: '15' } });

      expect(mockOnChange).toHaveBeenCalled();
      const emittedPayload = mockOnChange.mock.calls[0][0];

      // REQUIRED INVARIANT: OD discount should be updated to 15%
      expect(emittedPayload.odDiscountPercent).toBe('15');

      // FAILING REGRESSION ASSERTION:
      // The current code couples discount to commission by writing odCommissionCalc: "15".
      // Per Section 2 & D-02, commission must NEVER be inferred or overwritten by customer discounts.
      expect(emittedPayload.odCommissionCalc).toBeUndefined();
    });

    it('T-03 regression: editing TP discount must NOT mutate or write into tpCommissionCalc', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        policyTenure: '1',
        idv: '500000',
        tpDiscountPercent: '0',
        tpCommissionCalc: undefined,
      };

      render(
        <PolicyFormPackageForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      const tpDiscountInput = screen.getByPlaceholderText('e.g. 0%');
      fireEvent.change(tpDiscountInput, { target: { value: '8' } });

      expect(mockOnChange).toHaveBeenCalled();
      const emittedPayload = mockOnChange.mock.calls[0][0];

      expect(emittedPayload.tpDiscountPercent).toBe('8');

      // FAILING REGRESSION ASSERTION:
      // Current code sets tpCommissionCalc: "8", corrupting commission data.
      expect(emittedPayload.tpCommissionCalc).toBeUndefined();
    });

    it('T-04 regression: calculator totalDiscount must NOT be assigned as finalCommissionCalc', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        policyTenure: '1',
        idv: '500000',
        finalCommissionCalc: undefined,
      };

      // Mock calculation output returning a customer discount
      vi.mocked(useMotorCalculator).mockReturnValue({
        result: {
          outputs: {
            baseOdPremium: 10000,
            baseTpPremium: 3416,
            totalDiscount: 1500, // Customer discount of ₹1,500
            netPremium: 11916,
            totalPremium: 14060.88,
          },
        },
        loading: false,
        error: null,
      });

      render(
        <PolicyFormPackageForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      expect(mockOnChange).toHaveBeenCalled();
      const lastPayload = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];

      // FAILING REGRESSION ASSERTION:
      // Current code does `finalCommissionCalc: (result.outputs.totalDiscount ?? 0).toString()`,
      // which equates broker commission with customer discount!
      expect(lastPayload.finalCommissionCalc).not.toBe('1500');
    });
  });

  describe('PolicyFormTP Discount & Commission Coupling Defects', () => {
    it('T-03 regression: editing TP discount on TP-only form must NOT mutate tpCommissionCalc', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        policyTenure: '1',
        discountPercent: '0',
        tpCommissionCalc: undefined,
      };

      render(
        <PolicyFormTPOnlyForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      const discountInput = screen.getByPlaceholderText('0');
      fireEvent.change(discountInput, { target: { value: '10' } });

      expect(mockOnChange).toHaveBeenCalled();
      const emittedPayload = mockOnChange.mock.calls[0][0];

      expect(emittedPayload.discountPercent).toBe('10');

      // FAILING REGRESSION ASSERTION:
      // Current code sets `tpCommissionCalc: "10"` on TP discount interaction.
      expect(emittedPayload.tpCommissionCalc).toBeUndefined();
    });
  });
});
