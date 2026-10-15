import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PolicyFormPackageForm } from './PolicyFormPackage';
import { PolicyFormTPOnlyForm } from './PolicyFormTP';
import { PolicyFormSAODForm } from './PolicyFormSAOD';
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

  describe('PolicyFormSAOD Server-Side Calculator & Decoupling', () => {
    it('T-05 regression: SAOD delegates to useMotorCalculator and keeps commission separate from discount', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        insuredDeclaredValue: '600000',
        odPremiumBase: '18000',
        odCommissionPercent: '15',
        commissionAmount: '2700',
        discountPercent: '5',
        discountAmount: '900',
        tpVerification: {
          tpInsurer: 'ICICI Lombard',
          tpPolicyNumber: 'TP12345',
          tpStartDate: '2026-01-01',
          tpExpiryDate: '2027-01-01',
          verificationStatus: 'VERIFIED',
          verifiedByUserConfirmed: true,
        },
      };

      vi.mocked(useMotorCalculator).mockReturnValue({
        result: {
          outputs: {
            baseOdPremium: 18000,
            netOdPremium: 17100,
            addonPremium: 0,
            ncbDiscount: 0,
            totalDiscount: 900,
            specialDiscount: 900,
            totalGst: 3078,
            finalPayableAmount: 20178,
            totalPremium: 20178,
          },
          rateConfig: {
            gstRatePercent: 18,
          },
        },
        loading: false,
        error: null,
      });

      render(
        <PolicyFormSAODForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      expect(useMotorCalculator).toHaveBeenCalledWith(
        expect.objectContaining({
          policyType: 'STANDALONE_OD',
          idv: 600000,
          discountPercent: 5,
        })
      );

      // Verify that onChange received authoritative server figures without overwriting commission with discount
      expect(mockOnChange).toHaveBeenCalled();
      const lastPayload = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(lastPayload.totalPremiumInclGST).toBe('20178');
      expect(lastPayload.discountAmount).toBe('900');
      // Unapproved legacy commission inputs must be cleared, not recalculated in the browser.
      expect(lastPayload.odCommissionPercent).toBe('');
      expect(lastPayload.commissionAmount).toBe('');
    });
  });

  it('sends selected add-ons to the server without a manual price override', () => {
    const mockOnChange = vi.fn();
    const initialData: any = {
      policyTenure: '1',
      insuredDeclaredValue: '500000',
      addonsSelected: ['ZERO_DEP'],
      addonPrices: { ZERO_DEP: '1' },
    };

    render(
      <PolicyFormPackageForm
        category="PRIVATE_CAR"
        vehicleStatus="EXISTING"
        data={initialData}
        onChange={mockOnChange}
      />,
    );

    const call = vi.mocked(useMotorCalculator).mock.calls.at(-1)?.[0];
    expect(call.addons).toEqual([{ addonCode: 'ZERO_DEP' }]);
    expect(call.addons[0]).not.toHaveProperty('manualPrice');
    expect(screen.queryByPlaceholderText(/Manual Price/)).not.toBeInTheDocument();
  });

  it('shows server-calculated OD and TP discount amounts independently', () => {
    vi.mocked(useMotorCalculator).mockReturnValue({
      result: {
        outputs: {
          baseOdPremium: 10000,
          baseTpPremium: 3000,
          specialDiscount: 750,
          tp: { discount: 250 },
          totalDiscount: 1000,
          grossBasePremium: 13000,
          netCustomerPremium: 12000,
          totalGst: 2160,
          finalPayableAmount: 14160,
          totalPremium: 14160,
        },
        rateConfig: { gstRatePercent: 18 },
      },
      loading: false,
      error: null,
    });

    render(
      <PolicyFormPackageForm
        category="PRIVATE_CAR"
        vehicleStatus="EXISTING"
        data={{ policyTenure: '1', insuredDeclaredValue: '500000' } as any}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByDisplayValue('750.00')).toBeInTheDocument();
    expect(screen.getByDisplayValue('250.00')).toBeInTheDocument();
  });

  it('renders commission status as pending instead of inventing a percentage', () => {
    render(
      <PolicyFormPackageForm
        category="PRIVATE_CAR"
        vehicleStatus="EXISTING"
        data={{ policyTenure: '1', insuredDeclaredValue: '500000' } as any}
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByText('Commission Calculation')).toBeInTheDocument();
    expect(screen.getByText('CONFIGURATION PENDING')).toBeInTheDocument();
    expect(screen.getByText(/No default percentage or commissionable base is assumed/)).toBeInTheDocument();
  });

});
