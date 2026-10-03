import { fireEvent, render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { InspectionDialog } from './InspectionDialog';
import { useAuth } from '../../../hooks/useAuth';
import { apiClient } from '../../../lib/api-client';

vi.mock('../../../hooks/useAuth', () => ({ useAuth: vi.fn() }));
vi.mock('../../../lib/api-client', () => ({
  apiClient: { get: vi.fn(), post: vi.fn() },
}));
vi.mock('./InspectionForm', () => ({
  InspectionForm: () => <div data-testid="inspection-form" />,
}));
vi.mock('sonner', () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

describe('InspectionDialog agent journey', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(useAuth).mockReturnValue({ user: { role: 'AGENT' } } as any);
    vi.mocked(apiClient.get).mockResolvedValue({
      data: { id: 'inspection-1', status: 'IN_PROGRESS' },
    } as any);
  });

  it('shows the evidence form and submit action to an agent, without review controls', async () => {
    render(
      <InspectionDialog
        isOpen
        quotationId="quotation-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('inspection-form')).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /submit for underwriting review/i }),
    ).toBeDisabled();
    expect(
      screen.queryByRole('button', { name: /approve inspection/i }),
    ).not.toBeInTheDocument();
  });

  it('requests inspection initialization for an assigned agent when missing', async () => {
    vi.mocked(apiClient.get).mockResolvedValue({ data: null } as any);
    vi.mocked(apiClient.post).mockResolvedValue({
      data: { id: 'inspection-2', status: 'REQUIRED' },
    } as any);
    render(
      <InspectionDialog
        isOpen
        quotationId="quotation-1"
        onClose={vi.fn()}
        onSuccess={vi.fn()}
      />,
    );

    expect(await screen.findByTestId('inspection-form')).toBeInTheDocument();
    expect(apiClient.post).toHaveBeenCalledWith('/motor/inspections', {
      quotationId: 'quotation-1',
    });
  });
});
