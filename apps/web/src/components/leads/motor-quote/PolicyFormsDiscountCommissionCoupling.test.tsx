import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PolicyFormPackageForm } from './PolicyFormPackage';
import { PolicyFormTPOnlyForm } from './PolicyFormTP';
import { PolicyFormSAODForm } from './PolicyFormSAOD';
import { CommissionBreakdownPanel } from './CommissionBreakdownPanel';
import { RuleEngineResult } from './RuleEngineResult';
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

  it('sends selected add-ons to the server with manual entry price and without legacy manualPrice', () => {
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

    const calls = vi.mocked(useMotorCalculator).mock.calls;
    const call = calls[calls.length - 1]?.[0];
    expect(call?.addons).toEqual([{ addonCode: 'ZERO_DEP', editedPrice: 1 }]);
    expect(call?.addons?.[0]).not.toHaveProperty('manualPrice');
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

  it('does not render commission calculation on the customer-facing form', () => {
    render(
      <PolicyFormPackageForm
        category="PRIVATE_CAR"
        vehicleStatus="EXISTING"
        data={{ policyTenure: '1', insuredDeclaredValue: '500000' } as any}
        onChange={vi.fn()}
      />,
    );

    expect(screen.queryByText('Commission Calculation')).not.toBeInTheDocument();
  });

  it('renders commission status as pending in CommissionBreakdownPanel when no rate matches', () => {
    render(
      <CommissionBreakdownPanel
        components={['OD', 'TP']}
      />,
    );

    expect(screen.getByText('Commission Calculation')).toBeInTheDocument();
    expect(screen.getByText('CONFIGURATION PENDING')).toBeInTheDocument();
    expect(screen.getByText(/No default percentage or commissionable base is assumed/)).toBeInTheDocument();
  });

  it('allows opting out of Compulsory PA cover by passing paCover: false to calculator', () => {
    render(
      <PolicyFormPackageForm
        category="PRIVATE_CAR"
        vehicleStatus="EXISTING"
        data={{ policyTenure: '1', insuredDeclaredValue: '500000', paCoverOwner: false } as any}
        onChange={vi.fn()}
      />,
    );

    const calls = vi.mocked(useMotorCalculator).mock.calls;
    const call = calls[calls.length - 1]?.[0];
    expect(call?.paCover).toBe(false);
    expect(screen.getByText('Opted Out / Excluded')).toBeInTheDocument();
  });

  it('does not send unpriced add-ons to calculator, avoiding automatic tariff calculation', () => {
    render(
      <PolicyFormPackageForm
        category="PRIVATE_CAR"
        vehicleStatus="EXISTING"
        data={{
          policyTenure: '1',
          insuredDeclaredValue: '500000',
          addonsSelected: ['ZERO_DEP', 'ENGINE_PROTECTOR'],
          addonPrices: {},
        } as any}
        onChange={vi.fn()}
      />,
    );

    const calls = vi.mocked(useMotorCalculator).mock.calls;
    const call = calls[calls.length - 1]?.[0];
    expect(call?.addons).toEqual([]);
  });

  it('correctly passes editedTpPremium to calculator when agent enters custom TP base', () => {
    render(
      <PolicyFormPackageForm
        category="PRIVATE_CAR"
        vehicleStatus="EXISTING"
        data={{
          policyTenure: '1',
          insuredDeclaredValue: '500000',
          editedTpPremium: '2500',
        } as any}
        onChange={vi.fn()}
      />,
    );

    const calls = vi.mocked(useMotorCalculator).mock.calls;
    const call = calls[calls.length - 1]?.[0];
    expect(call?.editedTpPremium).toBe(2500);
  });

  it('dispatches editedTpPremium update when agent types in TP Base field', () => {
    const mockOnChange = vi.fn();
    render(
      <PolicyFormPackageForm
        category="PRIVATE_CAR"
        vehicleStatus="EXISTING"
        data={{
          policyTenure: '1',
          insuredDeclaredValue: '500000',
          editedTpPremium: undefined,
        } as any}
        onChange={mockOnChange}
      />,
    );

    const tpInputs = screen.getAllByTitle('Edit TP Base ₹');
    fireEvent.change(tpInputs[0], { target: { value: '3000' } });

    expect(mockOnChange).toHaveBeenCalled();
    const emitted = mockOnChange.mock.calls[0][0];
    expect(emitted.editedTpPremium).toBe('3000');
  });

  it('allows entering and clearing direct OD Premium ₹ input', () => {
    const mockOnChange = vi.fn();
    render(
      <PolicyFormPackageForm
        category="PRIVATE_CAR"
        vehicleStatus="EXISTING"
        data={{
          policyTenure: '1',
          insuredDeclaredValue: '500000',
          odPremiumAmount: '15000',
        } as any}
        onChange={mockOnChange}
      />,
    );

    const odPremiumInput = screen.getByTitle('Direct OD Premium ₹') as HTMLInputElement;
    expect(odPremiumInput.value).toBe('15000');

    fireEvent.change(odPremiumInput, { target: { value: '' } });

    expect(mockOnChange).toHaveBeenCalled();
    const emitted = mockOnChange.mock.calls[0][0];
    expect(emitted.odPremiumAmount).toBeUndefined();
    expect(emitted.editedOdGross).toBeUndefined();
    expect(emitted.editedOdRate).toBeUndefined();
  });

  it('allows deleting Third Party Liability entry without auto-resetting when left blank', () => {
    const mockOnChange = vi.fn();
    const { rerender } = render(
      <PolicyFormPackageForm
        category="PRIVATE_CAR"
        vehicleStatus="EXISTING"
        data={{
          policyTenure: '1',
          insuredDeclaredValue: '500000',
          editedTpPremium: '2500',
        } as any}
        onChange={mockOnChange}
      />,
    );

    const tpInput = screen.getByTitle('Edit TP Base ₹') as HTMLInputElement;
    expect(tpInput.value).toBe('2500');

    fireEvent.change(tpInput, { target: { value: '' } });

    expect(mockOnChange).toHaveBeenCalled();
    const emitted = mockOnChange.mock.calls[0][0];
    expect(emitted.editedTpPremium).toBe('');

    // Rerender with the empty string value as emitted to confirm it does not auto-set back to calculated statutory value
    rerender(
      <PolicyFormPackageForm
        category="PRIVATE_CAR"
        vehicleStatus="EXISTING"
        data={{
          policyTenure: '1',
          insuredDeclaredValue: '500000',
          editedTpPremium: '',
        } as any}
        onChange={mockOnChange}
      />,
    );

    const updatedTpInput = screen.getByTitle('Edit TP Base ₹') as HTMLInputElement;
    expect(updatedTpInput.value).toBe('');

    // Clicking Reset to Tariff restores editedTpPremium to undefined
    const resetBtn = screen.getByText('Reset to Tariff');
    fireEvent.click(resetBtn);
    expect(mockOnChange).toHaveBeenLastCalledWith(expect.objectContaining({ editedTpPremium: undefined }));
  });

  describe('PolicyFormSAOD Field 13 & Commission Calculator Removal', () => {
    it('does NOT render Field 13 or Commision / Discount Calculator on customer-facing SAOD form', () => {
      render(
        <PolicyFormSAODForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={{ insuredDeclaredValue: '500000' } as any}
          onChange={vi.fn()}
        />
      );

      expect(screen.queryByText(/Field 13/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Commision \/ Discount Calculator/i)).not.toBeInTheDocument();
      expect(screen.queryByText(/Commission Calculation/i)).not.toBeInTheDocument();
      expect(screen.getByText('Discounts & Commercial Adjustment')).toBeInTheDocument();
    });

    it('passes activeTpPolicyNumber and activeTpExpiryDate to useMotorCalculator', () => {
      render(
        <PolicyFormSAODForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={{
            insuredDeclaredValue: '500000',
            tpVerification: {
              tpInsurer: 'TATA AIG',
              tpPolicyNumber: 'POL-123456',
              tpStartDate: '2026-01-01',
              tpExpiryDate: '2027-01-01',
              verificationMethod: 'POLICY_DOCUMENT',
              verificationStatus: 'VERIFIED',
              verifiedByUserConfirmed: true,
            },
          } as any}
          onChange={vi.fn()}
        />
      );

      expect(useMotorCalculator).toHaveBeenCalledWith(
        expect.objectContaining({
          policyType: 'STANDALONE_OD',
          activeTpPolicyNumber: 'POL-123456',
          activeTpExpiryDate: '2027-01-01',
        })
      );
    });

    it('does not submit active TP details to calculation until verification is confirmed', () => {
      render(
        <PolicyFormSAODForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={{
            insuredDeclaredValue: '500000',
            tpVerification: {
              tpInsurer: 'TATA AIG',
              tpPolicyNumber: 'POL-123456',
              tpStartDate: '2026-01-01',
              tpExpiryDate: '2027-01-01',
              verificationMethod: 'POLICY_DOCUMENT',
              verificationStatus: 'PENDING',
              verifiedByUserConfirmed: false,
            },
          } as any}
          onChange={vi.fn()}
        />
      );

      expect(useMotorCalculator).toHaveBeenCalledWith(
        expect.objectContaining({
          policyType: 'STANDALONE_OD',
          activeTpPolicyNumber: undefined,
          activeTpExpiryDate: undefined,
        })
      );
    });

    it('sends the Field 11 override through the backend canonical totalPremiumOverride field', () => {
      render(
        <PolicyFormSAODForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={{
            insuredDeclaredValue: '500000',
            totalPremiumOverride: '7080',
            tpVerification: {
              tpInsurer: 'TATA AIG',
              tpPolicyNumber: 'POL-123456',
              tpStartDate: '2026-01-01',
              tpExpiryDate: '2027-01-01',
              verificationMethod: 'POLICY_DOCUMENT',
              verificationStatus: 'VERIFIED',
              verifiedByUserConfirmed: true,
            },
          } as any}
          onChange={vi.fn()}
        />
      );

      expect(useMotorCalculator).toHaveBeenCalledWith(
        expect.objectContaining({
          totalPremiumOverride: 7080,
        })
      );
      const calculatorInput = vi.mocked(useMotorCalculator).mock.calls[0][0];
      expect(calculatorInput).not.toHaveProperty('totalPremium');
    });

    it('invalidates TP verification (verifiedByUserConfirmed: false, PENDING) when agent edits TP fields', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        insuredDeclaredValue: '500000',
        tpVerification: {
          tpInsurer: 'TATA AIG',
          tpPolicyNumber: 'POL-123456',
          tpStartDate: '2026-01-01',
          tpExpiryDate: '2027-01-01',
          verificationMethod: 'POLICY_DOCUMENT',
          verificationStatus: 'VERIFIED',
          verifiedByUserConfirmed: true,
        },
      };

      render(
        <PolicyFormSAODForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      const policyInput = screen.getByPlaceholderText('e.g. TP/2024/123456789');
      fireEvent.change(policyInput, { target: { value: 'POL-999999' } });

      expect(mockOnChange).toHaveBeenCalled();
      const updated = mockOnChange.mock.calls[0][0];
      expect(updated.tpVerification.tpPolicyNumber).toBe('POL-999999');
      expect(updated.tpVerification.verifiedByUserConfirmed).toBe(false);
      expect(updated.tpVerification.verificationStatus).toBe('PENDING');
    });
  });

  describe('Commercial Adjustment Mutually Exclusive Button Toggles', () => {
    it('uses - and + toggle buttons in PolicyFormPackageForm', () => {
      const mockOnChange = vi.fn();
      render(
        <PolicyFormPackageForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={{ policyTenure: '1', insuredDeclaredValue: '500000', commercialAdjustmentDirection: 'SUBTRACT' } as any}
          onChange={mockOnChange}
        />
      );

      const subBtn = screen.getByRole('button', { name: /Subtract commercial adjustment/i });
      const addBtn = screen.getByRole('button', { name: /Add commercial adjustment/i });
      expect(subBtn).toHaveAttribute('aria-pressed', 'true');
      expect(addBtn).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(addBtn);
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ commercialAdjustmentDirection: 'ADD' })
      );
    });

    it('uses - and + toggle buttons in PolicyFormTPOnlyForm', () => {
      const mockOnChange = vi.fn();
      render(
        <PolicyFormTPOnlyForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={{ policyTenure: '1', commercialAdjustmentDirection: 'ADD' } as any}
          onChange={mockOnChange}
        />
      );

      const subBtn = screen.getByRole('button', { name: /Subtract commercial adjustment/i });
      const addBtn = screen.getByRole('button', { name: /Add commercial adjustment/i });
      expect(subBtn).toHaveAttribute('aria-pressed', 'false');
      expect(addBtn).toHaveAttribute('aria-pressed', 'true');

      fireEvent.click(subBtn);
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ commercialAdjustmentDirection: 'SUBTRACT' })
      );
    });

    it('uses - and + toggle buttons in PolicyFormSAODForm', () => {
      const mockOnChange = vi.fn();
      render(
        <PolicyFormSAODForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={{ insuredDeclaredValue: '500000', commercialAdjustmentDirection: 'SUBTRACT' } as any}
          onChange={mockOnChange}
        />
      );

      const subBtn = screen.getByRole('button', { name: /Subtract commercial adjustment/i });
      const addBtn = screen.getByRole('button', { name: /Add commercial adjustment/i });
      expect(subBtn).toHaveAttribute('aria-pressed', 'true');
      expect(addBtn).toHaveAttribute('aria-pressed', 'false');

      fireEvent.click(addBtn);
      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({ commercialAdjustmentDirection: 'ADD' })
      );
    });
  });

  describe('RuleEngineResult Workflow Action Handling', () => {
    it('renders actionable status when nextStep is TP_VERIFICATION', () => {
      const mockResult: any = {
        inspectionRequired: false,
        inspectionReasons: [],
        ncb: 20,
        ncbReason: 'ELIGIBLE',
        tpVerificationRequired: true,
        saodTpValid: false,
        saodTpInvalidReason: 'ACTIVE_TP_POLICY_REQUIRED',
        missingDocuments: ['ACTIVE_TP_POLICY_DETAILS'],
        nextStep: 'TP_VERIFICATION',
      };

      render(<RuleEngineResult result={mockResult} />);

      expect(
        screen.getByText('Action Required: Active TP Policy verification required before quotation')
      ).toBeInTheDocument();
      expect(screen.queryByText('Proceed to generate QUOTE')).not.toBeInTheDocument();
    });

    it('renders Proceed to generate QUOTE when nextStep is QUOTATION', () => {
      const mockResult: any = {
        inspectionRequired: false,
        inspectionReasons: [],
        ncb: 20,
        ncbReason: 'ELIGIBLE',
        tpVerificationRequired: false,
        saodTpValid: true,
        missingDocuments: [],
        nextStep: 'QUOTATION',
      };

      render(<RuleEngineResult result={mockResult} />);

      expect(screen.getByText('Proceed to generate QUOTE')).toBeInTheDocument();
    });
  });

  describe('PolicyFormSAOD 6-Field Overrides & Recalculation Chain', () => {
    it('renders all 6 fields with [Calculated] state when no overrides exist', () => {
      vi.mocked(useMotorCalculator).mockReturnValue({
        result: {
          outputs: {
            baseOdPremium: 5000,
            ncbDiscount: 0,
            addonPremium: 0,
            netOdPremium: 5000,
            gstOnOd: 900,
            finalPayableAmount: 5900,
          },
        },
        loading: false,
        error: null,
      });

      render(
        <PolicyFormSAODForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={{ insuredDeclaredValue: '500000' } as any}
          onChange={vi.fn()}
        />
      );

      const calculatedBadges = screen.getAllByText('[Calculated]');
      expect(calculatedBadges.length).toBe(6);
    });

    it('editing OD Base Premium emits override and shows [Manually Overridden]', () => {
      const mockOnChange = vi.fn();
      render(
        <PolicyFormSAODForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={{ insuredDeclaredValue: '500000' } as any}
          onChange={mockOnChange}
        />
      );

      const odBaseInput = screen.getByPlaceholderText('Direct OD premium ₹');
      fireEvent.change(odBaseInput, { target: { value: '8002' } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          odPremiumAmount: '8002',
          odBasePremiumOverride: '8002',
        })
      );
    });

    it('shows [Manually Overridden] and [Recalculated] on downstream fields when OD Base is overridden', () => {
      vi.mocked(useMotorCalculator).mockReturnValue({
        result: {
          outputs: {
            baseOdPremium: 8002,
            ncbDiscount: 0,
            addonPremium: 0,
            netOdPremium: 8002,
            gstOnOd: 1440.36,
            finalPayableAmount: 9442.36,
          },
        },
        loading: false,
        error: null,
      });

      render(
        <PolicyFormSAODForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={{
            insuredDeclaredValue: '500000',
            odPremiumAmount: '8002',
            odBasePremiumOverride: '8002',
          } as any}
          onChange={vi.fn()}
        />
      );

      expect(screen.getByText('[Manually Overridden]')).toBeInTheDocument();
      const recalculatedBadges = screen.getAllByText('[Recalculated]');
      expect(recalculatedBadges.length).toBe(3);
    });

    it('replaces the SAOD NCB amount field with one percentage discount input', () => {
      const mockOnChange = vi.fn();
      render(
        <PolicyFormSAODForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={{ insuredDeclaredValue: '500000' } as any}
          onChange={mockOnChange}
        />
      );

      expect(screen.queryByText('NCB Discount (₹)')).not.toBeInTheDocument();
      const discount = screen.getByPlaceholderText('e.g. 10');
      fireEvent.change(discount, { target: { value: '10' } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          discountPercent: '10',
          odDiscountPercent: '10',
        })
      );
    });

    it('clicking Reset on an overridden field clears the override', () => {
      const mockOnChange = vi.fn();
      render(
        <PolicyFormSAODForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={{
            insuredDeclaredValue: '500000',
            netOdPremiumOverride: '6000',
          } as any}
          onChange={mockOnChange}
        />
      );

      const resetBtn = screen.getByRole('button', { name: /Reset/i });
      fireEvent.click(resetBtn);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          netOdPremiumOverride: undefined,
        })
      );
    });

    it('server calculation results do NOT clobber active manual overrides', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        insuredDeclaredValue: '500000',
        netOdPremiumOverride: '6000',
        totalPremiumOverride: '7080',
      };

      vi.mocked(useMotorCalculator).mockReturnValue({
        result: {
          outputs: {
            baseOdPremium: 5000,
            ncbDiscount: 0,
            addonPremium: 0,
            netOdPremium: 5000,
            gstOnOd: 900,
            finalPayableAmount: 5900,
          },
          rateConfig: { gstRatePercent: 18 },
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

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          odPremium: '6000',
          totalPremiumInclGST: '7080',
          finalPayableAmount: '7080',
        })
      );
    });
  });
});

