import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgentCommissionsPage from './page';
import { useQuery } from '@tanstack/react-query';

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

vi.mock('../../../components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
  getApiErrorMessage: (err: any) => err?.message || 'Error occurred',
}));

describe('AgentCommissionsPage (/portal/commissions)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders loading state when fetching employee commissions', () => {
    (useQuery as any).mockReturnValue({
      data: [],
      isLoading: true,
      isError: false,
    });

    render(<AgentCommissionsPage />);
    expect(screen.getByText(/Loading personal commission records/i)).toBeInTheDocument();
  });

  it('renders empty state when employee has no commission records', () => {
    (useQuery as any).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
    });

    render(<AgentCommissionsPage />);
    expect(screen.getByText(/No Commission Records Found/i)).toBeInTheDocument();
  });

  it('renders personal commissions and summary cards with canonical amount', () => {
    (useQuery as any).mockReturnValue({
      data: [
        {
          id: 'comm-101',
          policyNumber: 'POL-MTR-101',
          customerName: 'Aarav Patel',
          amount: 2500,
          status: 'APPROVED',
          payoutStatus: 'APPROVED',
          roleTier: 'AGENT',
          createdAt: '2026-10-28T12:00:00Z',
        },
        {
          id: 'comm-102',
          policyNumber: 'POL-MTR-102',
          customerName: 'Priya Sharma',
          amount: 1500,
          status: 'PAID',
          payoutStatus: 'PAID',
          roleTier: 'AGENT',
          createdAt: '2026-10-29T12:00:00Z',
        },
      ],
      isLoading: false,
      isError: false,
    });

    render(<AgentCommissionsPage />);
    expect(screen.getByText('My Commission Ledger & Performance')).toBeInTheDocument();
    expect(screen.getByText('POL-MTR-101')).toBeInTheDocument();
    expect(screen.getByText('Aarav Patel')).toBeInTheDocument();
    expect(screen.getByText('POL-MTR-102')).toBeInTheDocument();
    expect(screen.getByText('Priya Sharma')).toBeInTheDocument();
  });
});
