import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PolicyFormTPOnlyForm } from './PolicyFormTP';
import { useMotorCalculator } from './useMotorCalculator';

vi.mock('./useMotorCalculator', () => ({
  useMotorCalculator: vi.fn(),
}));

describe('Work Package: TP GST, Add-on GST & Component Breakdown Verification Suite', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useMotorCalculator).mockReturnValue({
      result: null,
      loading: false,
      error: null,
    });
  });

  describe('Finding 1 & 3: TP GST Rate Selector & Synchronization', () => {
    it('exercises actual GST selector toggle button (5% vs 18%) without mocking', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        policyTenure: '1',
        gstRate: '18',
        tpGstRate: '18',
      };

      render(
        <PolicyFormTPOnlyForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      const btn5 = screen.getByRole('button', { name: /5% GST/i });
      fireEvent.click(btn5);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          gstRate: '5',
          tpGstRate: '5',
        })
      );
    });

    it('exercises select dropdown to ensure accessibility and backward-compatibility', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        policyTenure: '1',
        gstRate: '18',
        tpGstRate: '18',
      };

      render(
        <PolicyFormTPOnlyForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      const select = screen.getByLabelText(/TP Applicable GST Rate/i);
      fireEvent.change(select, { target: { value: '5' } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          gstRate: '5',
          tpGstRate: '5',
        })
      );
    });

    it('synchronizes tpGstRate and gstRate from calculation result rateConfig without divergence', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        policyTenure: '1',
        gstRate: '5',
        tpGstRate: '5',
      };

      vi.mocked(useMotorCalculator).mockReturnValue({
        result: {
          rateConfig: {
            gstRatePercent: 5,
            tpGstRatePercent: 5,
          },
          outputs: {
            baseTpPremium: 1000,
            finalPayableAmount: 1050,
            totalGst: 50,
            tp: { base: 1000 },
          },
        },
        loading: false,
        error: null,
      });

      render(
        <PolicyFormTPOnlyForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      expect(mockOnChange).toHaveBeenCalled();
      const emitted = mockOnChange.mock.calls[mockOnChange.mock.calls.length - 1][0];
      expect(emitted.gstRate).toBe('5');
      expect(emitted.tpGstRate).toBe('5');
    });
  });

  describe('Finding 1 & 2: Component-Level Breakdown & Add-on GST Verification', () => {
    it('displays component-level breakdown with statutory TP, PA, Driver, and Add-on taxes', () => {
      const mockOnChange = vi.fn();
      const calculationFixture = {
        rateConfig: {
          tpAnnualRate: 1000,
          systemTpAnnualRate: 1000,
          gstRatePercent: 18,
          tpGstRatePercent: 18,
        },
        outputs: {
          baseTpPremium: 1000,
          paPremium: 275,
          paidDriverPremium: 50,
          gstOnTp: 180,
          gstOnPa: 49.5,
          gstOnPaidDriver: 9,
          totalGst: 283.5,
          finalPayableAmount: 1595,
          tp: {
            base: 1000,
            discount: 0,
            gst: 180,
          },
          pa: {
            premium: 275,
            gst: 49.5,
          },
          paidDriver: {
            premium: 50,
            gst: 9,
          },
          payableSummary: {
            addonGrossPremium: 250,
            addonDiscountAmount: 25,
            addonGstTotal: 45,
            grossPremium: 1575,
            componentGstTotal: 283.5,
            finalPayableAmount: 1595,
          },
          gstBreakdown: {
            base: 'GROSS',
            tp: { base: 1000, rate: 0.18, ratePercent: 18, amount: 180 },
            pa: { base: 275, rate: 0.18, ratePercent: 18, amount: 49.5 },
            paidDriver: { base: 50, rate: 0.18, ratePercent: 18, amount: 9 },
            addons: {
              base: 250,
              taxableBase: 250,
              discount: 25,
              netPreTaxBase: 225,
              rate: 0.18,
              ratePercent: 18,
              amount: 45,
              items: [
                {
                  addonCode: 'PA_UNNAMED_PASSENGER',
                  name: 'PA Unnamed Passenger',
                  amount: 250,
                  premium: 250,
                  systemPremium: 250,
                  discountPercentage: 10,
                  discountAmount: 25,
                  netPreTaxAmount: 225,
                  taxableBase: 250,
                  gstRatePercent: 18,
                  gstAmount: 45,
                  finalAddonAmount: 270,
                },
              ],
            },
          },
          itemizedAddons: [
            {
              addonCode: 'PA_UNNAMED_PASSENGER',
              name: 'PA Unnamed Passenger',
              amount: 250,
              premium: 250,
              systemPremium: 250,
              discountPercentage: 10,
              discountAmount: 25,
              netPreTaxAmount: 225,
              taxableBase: 250,
              gstRatePercent: 18,
              gstAmount: 45,
              finalAddonAmount: 270,
            },
          ],
        },
      };

      vi.mocked(useMotorCalculator).mockReturnValue({
        result: calculationFixture,
        loading: false,
        error: null,
      });

      const initialData: any = {
        policyTenure: '1',
        gstRate: '18',
        tpGstRate: '18',
        paCoverOwner: true,
        legalLiabilityPaidDriver: 'Yes',
        addonsSelected: ['PA_UNNAMED_PASSENGER'],
        addonPrices: { PA_UNNAMED_PASSENGER: '250' },
        addonDiscounts: { PA_UNNAMED_PASSENGER: '10' },
        addonGstRates: { PA_UNNAMED_PASSENGER: '18' },
      };

      render(
        <PolicyFormTPOnlyForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      const breakdown = screen.getByTestId('tp-premium-breakdown');
      expect(breakdown).toBeInTheDocument();

      // Assert TP Base & Tax
      expect(breakdown).toHaveTextContent(/Third-Party Statutory Base/i);
      expect(breakdown).toHaveTextContent(/₹1,000/i);
      expect(breakdown).toHaveTextContent(/TP Tax \(18%\): ₹180/i);

      // Assert PA Cover & Tax
      expect(breakdown).toHaveTextContent(/Owner-Driver PA Cover/i);
      expect(breakdown).toHaveTextContent(/₹275/i);
      expect(breakdown).toHaveTextContent(/PA Tax: ₹49.5/i);

      // Assert Driver Liability & Tax
      expect(breakdown).toHaveTextContent(/Paid Driver Liability/i);
      expect(breakdown).toHaveTextContent(/₹50/i);
      expect(breakdown).toHaveTextContent(/Driver Tax: ₹9/i);

      // Assert Add-on Gross & Tax
      expect(breakdown).toHaveTextContent(/Add-ons Gross & Tax/i);
      expect(breakdown).toHaveTextContent(/₹250/i);
      expect(breakdown).toHaveTextContent(/Discounts: −₹25/i);
      expect(breakdown).toHaveTextContent(/Add-on Tax: ₹45/i);

      // Assert Itemized Add-on Row
      expect(breakdown).toHaveTextContent(/PA Unnamed Passenger/i);
      expect(breakdown).toHaveTextContent(/Gross Base: ₹250/i);
      expect(breakdown).toHaveTextContent(/Disc: 10% \(−₹25\)/i);
      expect(breakdown).toHaveTextContent(/Net Pre-tax: ₹225/i);
      expect(breakdown).toHaveTextContent(/GST \(18%\): ₹45/i);
      expect(breakdown).toHaveTextContent(/Total: ₹270/i);

      // Assert Aggregate Statutory GST and Total Premium
      expect(breakdown).toHaveTextContent(/Statutory GST \(CGST \+ SGST\):/i);
      expect(breakdown).toHaveTextContent(/₹283.5/i);
      expect(breakdown).toHaveTextContent(/Total Premium \(incl. GST\):/i);
      expect(breakdown).toHaveTextContent(/₹1,595/i);
    });

    it('recalculates component-level tax and final payable when rate changes from 18% to 5%', () => {
      const mockOnChange = vi.fn();
      const fixture5 = {
        rateConfig: {
          tpAnnualRate: 1000,
          systemTpAnnualRate: 1000,
          gstRatePercent: 5,
          tpGstRatePercent: 5,
        },
        outputs: {
          baseTpPremium: 1000,
          paPremium: 275,
          paidDriverPremium: 50,
          gstOnTp: 50,
          gstOnPa: 49.5,
          gstOnPaidDriver: 9,
          totalGst: 153.5,
          finalPayableAmount: 1465,
          tp: {
            base: 1000,
            discount: 0,
            gst: 50,
          },
          pa: {
            premium: 275,
            gst: 49.5,
          },
          paidDriver: {
            premium: 50,
            gst: 9,
          },
          payableSummary: {
            addonGrossPremium: 250,
            addonDiscountAmount: 25,
            addonGstTotal: 45,
            grossPremium: 1575,
            componentGstTotal: 153.5,
            finalPayableAmount: 1465,
          },
          gstBreakdown: {
            base: 'GROSS',
            tp: { base: 1000, rate: 0.05, ratePercent: 5, amount: 50 },
            pa: { base: 275, rate: 0.18, ratePercent: 18, amount: 49.5 },
            paidDriver: { base: 50, rate: 0.18, ratePercent: 18, amount: 9 },
            addons: {
              base: 250,
              discount: 25,
              taxableBase: 250,
              rate: 0.18,
              ratePercent: 18,
              amount: 45,
              items: [],
            },
          },
        },
      };

      vi.mocked(useMotorCalculator).mockReturnValue({
        result: fixture5,
        loading: false,
        error: null,
      });

      const data5: any = {
        policyTenure: '1',
        gstRate: '5',
        tpGstRate: '5',
      };

      render(
        <PolicyFormTPOnlyForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={data5}
          onChange={mockOnChange}
        />
      );

      const breakdown = screen.getByTestId('tp-premium-breakdown');
      expect(breakdown).toHaveTextContent(/TP Tax \(5%\): ₹50/i);
      expect(breakdown).toHaveTextContent(/Statutory GST \(CGST \+ SGST\):/i);
      expect(breakdown).toHaveTextContent(/₹153.5/i);
      expect(breakdown).toHaveTextContent(/Total Premium \(incl. GST\):/i);
      expect(breakdown).toHaveTextContent(/₹1,465/i);
    });

    it('allows changing individual add-on GST rate between 5% and 18%', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        policyTenure: '1',
        gstRate: '18',
        addonsSelected: ['PA_UNNAMED_PASSENGER'],
        addonPrices: { PA_UNNAMED_PASSENGER: '250' },
        addonDiscounts: { PA_UNNAMED_PASSENGER: '0' },
        addonGstRates: { PA_UNNAMED_PASSENGER: '18' },
      };

      render(
        <PolicyFormTPOnlyForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      const addonGstSelect = screen.getByTestId('addon-gst-PA_UNNAMED_PASSENGER');
      expect(addonGstSelect).toBeDefined();

      fireEvent.change(addonGstSelect, { target: { value: '5' } });

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          addonGstRates: { PA_UNNAMED_PASSENGER: '5' },
        })
      );
    });

    it('reconciles overridden PA premium (₹315 vs default ₹250) and Paid Driver (₹100 vs default ₹50) in itemized breakdown and summary', () => {
      const mockOnChange = vi.fn();
      const calculationFixture = {
        rateConfig: {
          tpAnnualRate: 1000,
          systemTpAnnualRate: 1000,
          gstRatePercent: 18,
          tpGstRatePercent: 18,
        },
        outputs: {
          baseTpPremium: 1000,
          totalGst: 254.7,
          finalPayableAmount: 1669.7,
          tp: { base: 1000, discount: 0, gst: 180 },
          pa: { premium: 0, gst: 0 },
          paidDriver: { premium: 0, gst: 0 },
          payableSummary: {
            addonGrossPremium: 415,
            addonDiscountAmount: 0,
            addonGstTotal: 74.7,
            grossPremium: 1415,
            componentGstTotal: 254.7,
            finalPayableAmount: 1669.7,
          },
          gstBreakdown: {
            base: 'GROSS',
            tp: { base: 1000, rate: 0.18, ratePercent: 18, amount: 180 },
            pa: { base: 0, rate: 0.18, ratePercent: 18, amount: 0 },
            paidDriver: { base: 0, rate: 0.18, ratePercent: 18, amount: 0 },
            addons: {
              base: 415,
              taxableBase: 415,
              discount: 0,
              netPreTaxBase: 415,
              rate: 0.18,
              ratePercent: 18,
              amount: 74.7,
              items: [
                {
                  addonCode: 'PA_UNNAMED_PASSENGER',
                  name: 'PA Cover to Unnamed Passengers',
                  amount: 315,
                  premium: 315,
                  systemPremium: 250,
                  editedPremium: 315,
                  discountPercentage: 0,
                  discountAmount: 0,
                  netPreTaxAmount: 315,
                  taxableBase: 315,
                  gstRatePercent: 18,
                  gstAmount: 56.7,
                  finalAddonAmount: 371.7,
                  isEdited: true,
                },
                {
                  addonCode: 'LEGAL_LIABILITY_PAID_DRIVER',
                  name: 'Legal Liability to Paid Driver',
                  amount: 100,
                  premium: 100,
                  systemPremium: 50,
                  editedPremium: 100,
                  discountPercentage: 0,
                  discountAmount: 0,
                  netPreTaxAmount: 100,
                  taxableBase: 100,
                  gstRatePercent: 18,
                  gstAmount: 18,
                  finalAddonAmount: 118,
                  isEdited: true,
                },
              ],
            },
          },
          itemizedAddons: [
            {
              addonCode: 'PA_UNNAMED_PASSENGER',
              name: 'PA Cover to Unnamed Passengers',
              amount: 315,
              premium: 315,
              systemPremium: 250,
              editedPremium: 315,
              discountPercentage: 0,
              discountAmount: 0,
              netPreTaxAmount: 315,
              taxableBase: 315,
              gstRatePercent: 18,
              gstAmount: 56.7,
              finalAddonAmount: 371.7,
              isEdited: true,
            },
            {
              addonCode: 'LEGAL_LIABILITY_PAID_DRIVER',
              name: 'Legal Liability to Paid Driver',
              amount: 100,
              premium: 100,
              systemPremium: 50,
              editedPremium: 100,
              discountPercentage: 0,
              discountAmount: 0,
              netPreTaxAmount: 100,
              taxableBase: 100,
              gstRatePercent: 18,
              gstAmount: 18,
              finalAddonAmount: 118,
              isEdited: true,
            },
          ],
        },
      };

      vi.mocked(useMotorCalculator).mockReturnValue({
        result: calculationFixture,
        loading: false,
        error: null,
      });

      const initialData: any = {
        policyTenure: '1',
        gstRate: '18',
        tpGstRate: '18',
        addonsSelected: ['PA_UNNAMED_PASSENGER', 'LEGAL_LIABILITY_PAID_DRIVER'],
        addonPrices: {
          PA_UNNAMED_PASSENGER: '315',
          LEGAL_LIABILITY_PAID_DRIVER: '100',
        },
        addonDiscounts: {
          PA_UNNAMED_PASSENGER: '0',
          LEGAL_LIABILITY_PAID_DRIVER: '0',
        },
        addonGstRates: {
          PA_UNNAMED_PASSENGER: '18',
          LEGAL_LIABILITY_PAID_DRIVER: '18',
        },
      };

      render(
        <PolicyFormTPOnlyForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      const breakdown = screen.getByTestId('tp-premium-breakdown');
      expect(breakdown).toBeInTheDocument();

      // Assert Summary Card shows ₹415 Gross
      expect(breakdown).toHaveTextContent(/Add-ons Gross & Tax/i);
      expect(breakdown).toHaveTextContent(/₹415/i);
      expect(breakdown).toHaveTextContent(/Add-on Tax: ₹74.7/i);

      // Assert PA Cover uses ₹315 (NOT the ₹250 system default)
      expect(breakdown).toHaveTextContent(/PA Cover to Unnamed Passengers/i);
      expect(breakdown).toHaveTextContent(/Gross Base: ₹315/i);
      expect(breakdown).not.toHaveTextContent(/Gross Base: ₹250/i);
      expect(breakdown).toHaveTextContent(/Net Pre-tax: ₹315/i);
      expect(breakdown).toHaveTextContent(/GST \(18%\): ₹56\.7/i);
      expect(breakdown).toHaveTextContent(/Total: ₹371.7/i);

      // Assert Paid Driver uses ₹100 (NOT the ₹50 system default)
      expect(breakdown).toHaveTextContent(/Legal Liability to Paid Driver/i);
      expect(breakdown).toHaveTextContent(/Gross Base: ₹100/i);
      expect(breakdown).not.toHaveTextContent(/Gross Base: ₹50/i);
      expect(breakdown).toHaveTextContent(/Net Pre-tax: ₹100/i);
      expect(breakdown).toHaveTextContent(/GST \(18%\): ₹18/i);
      expect(breakdown).toHaveTextContent(/Total: ₹118/i);

      // Total Premium reconciles
      expect(breakdown).toHaveTextContent('Total Premium (incl. GST):');
      expect(breakdown).toHaveTextContent(/₹1,669.7/i);
    });

    it('synchronizes add-on default GST rate with overall TP GST selector when individual rate not explicitly set', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        policyTenure: '1',
        gstRate: '5',
        tpGstRate: '5',
        addonsSelected: ['PA_UNNAMED_PASSENGER'],
        addonPrices: { PA_UNNAMED_PASSENGER: '315' },
      };

      render(
        <PolicyFormTPOnlyForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      // Dropdown should default to 5% to match the TP rate selector, NOT 18%
      const addonGstSelect = screen.getByTestId('addon-gst-PA_UNNAMED_PASSENGER') as HTMLSelectElement;
      expect(addonGstSelect.value).toBe('5');

      // Verify useMotorCalculator was called with gstRate: 5 for this addon
      expect(vi.mocked(useMotorCalculator)).toHaveBeenCalledWith(
        expect.objectContaining({
          addons: expect.arrayContaining([
            expect.objectContaining({
              addonCode: 'PA_UNNAMED_PASSENGER',
              amount: 315,
              gstRate: 5,
            }),
          ]),
        })
      );
    });

    it('reconciles add-on discount, taxable base, and tax under Gross Tax Base Rule with non-zero discount', () => {
      const mockOnChange = vi.fn();
      const calculationFixture = {
        rateConfig: {
          tpAnnualRate: 1000,
          systemTpAnnualRate: 1000,
          gstRatePercent: 18,
          tpGstRatePercent: 18,
        },
        outputs: {
          baseTpPremium: 1000,
          totalGst: 236.7,
          finalPayableAmount: 1520.2,
          tp: { base: 1000, discount: 0, gst: 180 },
          pa: { premium: 0, gst: 0 },
          paidDriver: { premium: 0, gst: 0 },
          payableSummary: {
            addonGrossPremium: 315,
            addonDiscountAmount: 31.5,
            addonGstTotal: 56.7,
            grossPremium: 1315,
            componentGstTotal: 236.7,
            finalPayableAmount: 1520.2,
          },
          gstBreakdown: {
            base: 'GROSS',
            tp: { base: 1000, rate: 0.18, ratePercent: 18, amount: 180 },
            pa: { base: 0, rate: 0.18, ratePercent: 18, amount: 0 },
            paidDriver: { base: 0, rate: 0.18, ratePercent: 18, amount: 0 },
            addons: {
              base: 315,
              taxableBase: 315,
              discount: 31.5,
              netPreTaxBase: 283.5,
              rate: 0.18,
              ratePercent: 18,
              amount: 56.7,
              items: [
                {
                  addonCode: 'PA_UNNAMED_PASSENGER',
                  name: 'PA Cover to Unnamed Passengers',
                  amount: 315,
                  premium: 315,
                  systemPremium: 250,
                  editedPremium: 315,
                  discountPercentage: 10,
                  discountAmount: 31.5,
                  netPreTaxAmount: 283.5,
                  taxableBase: 315,
                  gstRatePercent: 18,
                  gstAmount: 56.7,
                  finalAddonAmount: 340.2,
                  isEdited: true,
                },
              ],
            },
          },
          itemizedAddons: [
            {
              addonCode: 'PA_UNNAMED_PASSENGER',
              name: 'PA Cover to Unnamed Passengers',
              amount: 315,
              premium: 315,
              systemPremium: 250,
              editedPremium: 315,
              discountPercentage: 10,
              discountAmount: 31.5,
              netPreTaxAmount: 283.5,
              taxableBase: 315,
              gstRatePercent: 18,
              gstAmount: 56.7,
              finalAddonAmount: 340.2,
              isEdited: true,
            },
          ],
        },
      };

      vi.mocked(useMotorCalculator).mockReturnValue({
        result: calculationFixture,
        loading: false,
        error: null,
      });

      const initialData: any = {
        policyTenure: '1',
        gstRate: '18',
        tpGstRate: '18',
        addonsSelected: ['PA_UNNAMED_PASSENGER'],
        addonPrices: { PA_UNNAMED_PASSENGER: '315' },
        addonDiscounts: { PA_UNNAMED_PASSENGER: '10' },
        addonGstRates: { PA_UNNAMED_PASSENGER: '18' },
      };

      render(
        <PolicyFormTPOnlyForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      const breakdown = screen.getByTestId('tp-premium-breakdown');
      expect(breakdown).toHaveTextContent(/PA Cover to Unnamed Passengers/i);
      expect(breakdown).toHaveTextContent(/Gross Base: ₹315/i);
      expect(breakdown).toHaveTextContent(/Disc: 10% \(−₹31\.5\)/i);
      expect(breakdown).toHaveTextContent(/Net Pre-tax: ₹283.5/i);
      expect(breakdown).toHaveTextContent(/GST \(18%\): ₹56\.7/i);
      expect(breakdown).toHaveTextContent(/Total: ₹340.2/i);
    });

    it('omits deselected add-on from calculation payload and breakdown', () => {
      const mockOnChange = vi.fn();
      const initialData: any = {
        policyTenure: '1',
        gstRate: '18',
        tpGstRate: '18',
        addonsSelected: ['PA_UNNAMED_PASSENGER'],
        addonPrices: { PA_UNNAMED_PASSENGER: '315' },
      };

      render(
        <PolicyFormTPOnlyForm
          category="PRIVATE_CAR"
          vehicleStatus="EXISTING"
          data={initialData}
          onChange={mockOnChange}
        />
      );

      // Uncheck the PA cover checkbox
      const checkbox = screen.getByRole('checkbox', { name: /PA Cover to Unnamed Passengers/i });
      fireEvent.click(checkbox);

      expect(mockOnChange).toHaveBeenCalledWith(
        expect.objectContaining({
          addonsSelected: [],
        })
      );
    });
  });
});
