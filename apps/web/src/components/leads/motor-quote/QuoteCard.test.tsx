import { act, render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { QuoteCard } from './QuoteCard';
import { useAuthStore } from '../../../store/auth-store';

vi.mock('./QuotationCompletionView', () => ({
  QuotationCompletionView: () => <div data-testid="completion-view" />,
}));

vi.mock('../../../lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));

function renderQuoteCard(quoteOverrides: Record<string, any> = {}, userRole = 'AGENT') {
  useAuthStore.setState({
    user: { id: 'u-1', role: userRole, roles: [userRole] } as any,
    isAuthenticated: true,
  });
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const quote = {
    id: 'quote-1',
    quotationCode: 'QT-2026-11-000045',
    insurerName: 'IFFCO-Tokio General Insurance Co. Ltd.',
    vehicleCategory: 'PRIVATE_CAR',
    policyType: 'PACKAGE',
    totalPremium: 15000,
    status: 'PAYMENT_DONE',
    ...quoteOverrides,
  } as any;

  return render(
    <QueryClientProvider client={queryClient}>
      <QuoteCard
        quote={quote}
        onUploadQuote={vi.fn()}
        onSubmitToBackOffice={vi.fn().mockResolvedValue(undefined)}
      />
    </QueryClientProvider>,
  );
}

describe('QuoteCard back-office handoff button visibility', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows Select & Send to Back Office to ADMIN as well as AGENT', () => {
    const { rerender } = renderQuoteCard({}, 'AGENT');
    expect(screen.getByRole('button', { name: /select & send to back office/i })).toBeEnabled();

    const qc = new QueryClient();
    act(() => {
      useAuthStore.setState({
        user: { id: 'u-admin', role: 'ADMIN', roles: ['ADMIN'] } as any,
        isAuthenticated: true,
      });
    });
    rerender(
      <QueryClientProvider client={qc}>
        <QuoteCard
          quote={{
            id: 'quote-1',
            quotationCode: 'QT-2026-11-000045',
            insurerName: 'IFFCO-Tokio General Insurance Co. Ltd.',
            vehicleCategory: 'PRIVATE_CAR',
            policyType: 'PACKAGE',
            totalPremium: 15000,
            status: 'PAYMENT_DONE',
          } as any}
          onUploadQuote={vi.fn()}
          onSubmitToBackOffice={vi.fn().mockResolvedValue(undefined)}
        />
      </QueryClientProvider>,
    );
    expect(screen.getByRole('button', { name: /select & send to back office/i })).toBeEnabled();
  });

  it('shows Select & Send to Back Office to BACK_OFFICE as well as AGENT and ADMIN', () => {
    renderQuoteCard({}, 'BACK_OFFICE');
    expect(screen.getByRole('button', { name: /select & send to back office/i })).toBeEnabled();
  });

  it('hides Select & Send to Back Office from CUSTOMER', () => {
    renderQuoteCard({}, 'CUSTOMER');
    expect(screen.queryByRole('button', { name: /select & send to back office/i })).toBeNull();
  });

  it('hides Select & Send to Back Office for terminal statuses', () => {
    renderQuoteCard({ status: 'CONVERTED_TO_POLICY' }, 'ADMIN');
    expect(screen.queryByRole('button', { name: /select & send to back office/i })).toBeNull();
  });

  it('renders disabled Sent to Back Office state when backOfficeSubmittedAt is present', () => {
    renderQuoteCard({ backOfficeSubmittedAt: '2026-11-11T05:24:44.595Z' }, 'ADMIN');
    expect(screen.getByRole('button', { name: /sent to back office/i })).toBeDisabled();
  });
});
