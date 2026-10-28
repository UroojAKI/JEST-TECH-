import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MotorQuoteWizard } from './MotorQuoteWizard';
import { apiClient } from '../../../lib/api-client';

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('@/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
    post: vi.fn(),
  },
}));

vi.mock('../../../repositories/leads.repository', () => ({
  leadsRepository: {
    getLeadContext: vi.fn().mockResolvedValue(null),
  },
}));

vi.mock('../../agents/AgentSelector', () => ({
  AgentSelector: () => <div data-testid="agent-selector" />,
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [] }),
}));

vi.mock('./InspectionDialog', () => ({
  InspectionDialog: () => <div data-testid="inspection-dialog" />,
}));

describe('MotorQuoteWizard SAOD Navigation & TP Verification Control-Flow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // The wizard performs a vehicle lookup before evaluating the selected policy rules.
    // Return an explicit empty response unless a test overrides this endpoint.
    vi.mocked(apiClient.get).mockImplementation(async () => ({ data: {} }) as any);
    vi.mocked(apiClient.post).mockImplementation(async (url: string, data?: any) => {
      if (url === '/motor/journeys') {
        return { data: { journeyId: 'journey-test-123' } } as any;
      }
      if (url === '/motor/rules/evaluate') {
        if (data?.newPolicyType === 'SAOD') {
          if (data?.activeTpVerifiedByUserConfirmed && data?.activeTpPolicyNumber) {
            return {
              data: {
                ruleEvaluation: {
                  inspectionRequired: false,
                  ncb: 20,
                  saodTpValid: true,
                  tpVerificationRequired: false,
                  nextStep: 'QUOTATION',
                },
              },
            } as any;
          }
          return {
            data: {
              ruleEvaluation: {
                inspectionRequired: false,
                ncb: 0,
                saodTpValid: false,
                tpVerificationRequired: true,
                nextStep: 'TP_VERIFICATION',
              },
            },
          } as any;
        }
        return {
          data: {
            ruleEvaluation: {
              inspectionRequired: false,
              ncb: 20,
              nextStep: 'QUOTATION',
            },
          },
        } as any;
      }
      return { data: {} } as any;
    });
  });

  it('advances from Step 4 SAOD directly to Step 5 (Active TP Verification & Eligibility) without skipping', async () => {
    const { container } = render(
      <MotorQuoteWizard
        isOpen={true}
        initialCategory="PRIVATE_CAR"
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    // Step 1: Customer Info
    const nameInput = screen.getByPlaceholderText('e.g. John Doe');
    const mobileInput = screen.getByPlaceholderText('10-digit number');
    fireEvent.change(nameInput, { target: { value: 'Rajesh Sharma' } });
    fireEvent.change(mobileInput, { target: { value: '9876543210' } });

    const continueBtn = screen.getByRole('button', { name: /continue/i });
    fireEvent.click(continueBtn);

    // Step 2: Vehicle Details
    await waitFor(() => {
      expect(screen.getByRole('heading', { name: 'Vehicle Details' })).toBeInTheDocument();
    });

    const regInput = screen.getByPlaceholderText(/KA-22-AB-1234/i);
    fireEvent.change(regInput, { target: { value: 'MH02AB1234' } });

    fireEvent.click(continueBtn);

    // Step 3: Previous Policy Details
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Not Available/i })).toBeInTheDocument();
    });

    // Select Not Available
    const notAvailableBtn = screen.getByRole('button', { name: /Not Available/i });
    fireEvent.click(notAvailableBtn);

    fireEvent.click(continueBtn);

    // Step 4: Policy Type
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /SAOD/i })).toBeInTheDocument();
    });

    // Select SAOD
    const saodBtn = screen.getByRole('button', { name: /SAOD/i });
    fireEvent.click(saodBtn);

    // Click Continue from Step 4
    fireEvent.click(continueBtn);

    // MUST advance to Step 5: Active TP Verification & Eligibility
    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Active Third-Party Policy Verification' })
      ).toBeInTheDocument();
    });

    // Verify continue button is DISABLED until TP details are completed and confirmed
    expect(continueBtn).toBeDisabled();

    // Fill TP details in Step 5
    const insurerSelect = screen.getByDisplayValue(/— Select TP Insurer —/i);
    fireEvent.change(insurerSelect, { target: { value: 'Tata AIG General Insurance' } });

    const policyInput = screen.getByPlaceholderText(/e\.g\. TP\/2024\/123456789/i);
    fireEvent.change(policyInput, { target: { value: 'TP/2025/99887766' } });

    // Target the active TP fields by their labels; other wizard steps can also
    // contain date inputs, so indexing all date inputs is ambiguous.
    const tpStartDate = screen.getByText(/TP Start Date/i).parentElement?.querySelector('input[type="date"]');
    const tpExpiryDate = screen.getByText(/TP Expiry Date/i).parentElement?.querySelector('input[type="date"]');
    expect(tpStartDate).not.toBeNull();
    expect(tpExpiryDate).not.toBeNull();
    fireEvent.change(tpStartDate!, { target: { value: '2025-01-01' } });
    fireEvent.change(tpExpiryDate!, { target: { value: '2027-01-01' } });

    const methodRadio = screen.getByLabelText(/Policy Document/i);
    fireEvent.click(methodRadio);

    // Confirm checkbox
    const confirmCheckbox = screen.getByRole('checkbox', {
      name: /I have verified the active TP policy/i,
    });
    fireEvent.click(confirmCheckbox);

    // Wait for rule evaluation to run and succeed
    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/motor/rules/evaluate',
        expect.objectContaining({
          newPolicyType: 'SAOD',
          activeTpPolicyNumber: 'TP/2025/99887766',
          activeTpVerifiedByUserConfirmed: true,
        })
      );
    });

    // Now Continue should become enabled
    await waitFor(() => {
      expect(continueBtn).not.toBeDisabled();
    });

    // Click Continue to advance to Step 6
    fireEvent.click(continueBtn);

    // Step 6: Premium & Coverages with SAOD Verified TP Banner
    await waitFor(() => {
      expect(screen.getByText(/Active TP Policy Details \(SAOD\)/i)).toBeInTheDocument();
      expect(screen.getAllByDisplayValue('TP/2025/99887766').length).toBeGreaterThanOrEqual(1);
    });

    // Test Back button navigation: Step 6 -> Step 5
    const backBtn = screen.getByRole('button', { name: /back/i });
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(
        screen.getByRole('heading', { name: 'Active Third-Party Policy Verification' })
      ).toBeInTheDocument();
    });

    // Step 5 -> Step 4
    fireEvent.click(backBtn);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /SAOD/i })).toBeInTheDocument();
    });
  });
});
