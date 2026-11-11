import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { MotorIssuanceQueue } from './MotorIssuanceQueue';
import { policiesRepository } from '../../repositories/policies.repository';

vi.mock('../../repositories/policies.repository', () => ({
  policiesRepository: {
    getBackOfficeQueue: vi.fn(),
    issueFromQueue: vi.fn(),
  },
}));

vi.mock('../../repositories/quotations.repository', () => ({
  quotationsRepository: {
    approveQuotation: vi.fn(),
    rejectQuotation: vi.fn(),
  },
}));

vi.mock('../leads/motor-quote/UpdatePolicyDetailsDialog', () => ({
  UpdatePolicyDetailsDialog: () => <div data-testid="manual-dialog" />,
}));

describe('MotorIssuanceQueue complete policy details', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (policiesRepository.getBackOfficeQueue as any).mockResolvedValue({
      data: [
        {
          id: 'q-motor-1',
          quotationCode: 'QT-2026-11-000044',
          status: 'APPROVED',
          customerName: 'Ramesh Kulkarni',
          customerPhone: '9876543210',
          customerEmail: 'ramesh@example.com',
          customerCity: 'Belagavi',
          customerPincode: '590001',
          customerAddress: '12 College Road, Belagavi, Karnataka, 590001',
          panMasked: 'XXXXX1234F',
          salesAgentName: 'Vikram Singh',
          productType: 'MOTOR',
          policyType: 'PACKAGE',
          policyTenure: 1,
          insurerName: 'ICICI Lombard General Insurance',
          sumInsured: 625000,
          basePremium: 21186,
          gstAmount: 3814,
          odPremium: 15000,
          tpPremium: 4000,
          addonPremium: 2186,
          discountAmount: 1000,
          ncbPercentage: 25,
          totalPremium: 25000,
          paymentAmount: 25000,
          paymentStatus: 'PAID',
          paymentReference: 'UTR998877',
          caseId: 'case-1',
          caseCode: 'MC-2026-0009',
          calculationValid: true,
          createdAt: '2026-11-10T10:00:00.000Z',
          slaRemainingHours: 14.5,
          slaStatus: 'ON_TRACK',
          gates: {
            customer: { passed: true, status: 'PASSED', detail: 'Verified' },
            vehicle: { passed: true, status: 'PASSED', detail: 'KA22AB1234 valid' },
            inspection: { passed: true, status: 'PASSED', detail: 'Not required' },
            payment: { passed: true, status: 'PASSED', detail: 'Paid ₹25,000' },
            documents: { passed: true, status: 'PASSED', detail: 'All verified' },
          },
          allGatesPassed: true,
          nextAction: 'Ready to Issue Policy',
          vehicleDetails: {
            registrationNumber: 'KA22AB1234',
            makeModel: 'Hyundai Creta SX',
            category: 'PRIVATE_CAR',
            fuelType: 'Petrol',
            engineNumber: 'ENG5544',
            chassisNumber: 'CHS9988',
          },
          previousPolicy: {
            previousPolicyType: 'COMPREHENSIVE',
            previousInsurerName: 'HDFC ERGO',
            previousPolicyNumber: 'PREV-7788',
          },
          documents: [
            {
              id: 'doc-1',
              documentType: 'RC_COPY',
              verificationStatus: 'VERIFIED',
              fileName: 'rc.pdf',
              source: 'MOTOR',
            },
          ],
        },
        {
          id: 'q-health-1',
          quotationCode: 'QT-HLT-0002',
          status: 'APPROVED',
          customerName: 'Sneha Joshi',
          salesAgentName: 'Anita Verma',
          productType: 'HEALTH',
          policyType: 'FAMILY_FLOATER',
          insurerName: 'HDFC ERGO Health',
          sumInsured: 1000000,
          basePremium: 16949,
          gstAmount: 3051,
          totalPremium: 20000,
          paymentAmount: 20000,
          createdAt: '2026-11-10T11:00:00.000Z',
          slaRemainingHours: 18,
          slaStatus: 'ON_TRACK',
          gates: {
            customer: { passed: true, status: 'PASSED', detail: 'KYC ok' },
            vehicle: { passed: true, status: 'PASSED', detail: 'N/A' },
            inspection: { passed: true, status: 'PASSED', detail: 'N/A' },
            payment: { passed: true, status: 'PASSED', detail: 'Paid' },
            documents: { passed: false, status: 'BLOCKED', detail: 'Proposal pending' },
          },
          allGatesPassed: false,
          nextAction: 'Awaiting Document Verification',
          healthDetails: {
            planName: 'Optima Secure Global',
            planCategory: 'FAMILY_FLOATER',
            policyForm: 'PORTABILITY',
            memberCount: 3,
            nomineeName: 'Rahul Joshi',
            nomineeRelation: 'SPOUSE',
          },
        },
      ],
      summary: {
        totalPending: 2,
        readyCount: 1,
        blockedCount: 1,
        issuedCount: 4,
      },
    });
  });

  it('displays complete motor and dynamic health details in Table View without hardcoded Health strings and opens full details modal', async () => {
    render(<MotorIssuanceQueue />);

    await waitFor(() => {
      expect(screen.getByText('QT-2026-11-000044')).toBeInTheDocument();
    });

    // Motor rich details visible in Table View
    expect(screen.getByText('Hyundai Creta SX')).toBeInTheDocument();
    expect(screen.getByText('KA22AB1234')).toBeInTheDocument();
    expect(screen.getByText('MC-2026-0009')).toBeInTheDocument();
    expect(screen.getByText(/₹6,25,000/)).toBeInTheDocument();
    expect(screen.getByText(/Eng: ENG5544/)).toBeInTheDocument();

    // Health real dynamic details instead of hardcoded Plan Verified / UW EXEMPT
    expect(screen.getByText('Optima Secure Global')).toBeInTheDocument();
    expect(screen.getAllByText('FAMILY FLOATER').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('PORTABILITY')).toBeInTheDocument();
    expect(screen.queryByText('Plan Verified')).not.toBeInTheDocument();
    expect(screen.queryByText('Medical UW: EXEMPT / PASSED')).not.toBeInTheDocument();

    // Issued Policies tab and card visible with count from summary
    expect(screen.getByText('Issued Policies (4)')).toBeInTheDocument();

    // Open Complete Policy Details Modal for Motor quote
    const detailButtons = screen.getAllByRole('button', { name: /Details/i });
    fireEvent.click(detailButtons[0]);

    expect(screen.getByText('Coverage, IDV & Premium Breakdown')).toBeInTheDocument();
    expect(screen.getByText('Vehicle & Previous Policy Specifications')).toBeInTheDocument();
    expect(screen.getByText(/CHS9988/)).toBeInTheDocument();
    expect(screen.getByText('RC_COPY')).toBeInTheDocument();
  });
});
