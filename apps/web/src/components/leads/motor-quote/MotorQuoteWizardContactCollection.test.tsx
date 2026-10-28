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

vi.mock('./InspectionDialog', () => ({
  InspectionDialog: () => <div data-testid="inspection-dialog" />,
}));

let mockCurrentUserPreference: any = { collectContacts: false };
let mockAgentPreference: any = null;

vi.mock('@tanstack/react-query', () => ({
  useQuery: ({ queryKey }: { queryKey: any[] }) => {
    if (queryKey[0] === 'current-user-contact-preference') {
      return { data: mockCurrentUserPreference, isLoading: false };
    }
    if (queryKey[0] === 'agent-contact-preference') {
      return { data: mockAgentPreference, isLoading: false };
    }
    return { data: [], isLoading: false };
  },
}));

describe('MotorQuoteWizard Contact Collection Enforcement (Step 1)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCurrentUserPreference = { collectContacts: false };
    mockAgentPreference = null;
    vi.mocked(apiClient.get).mockImplementation(async () => ({ data: {} }) as any);
    vi.mocked(apiClient.post).mockImplementation(async () => ({ data: { journeyId: 'j-1' } }) as any);
  });

  it('allows proceeding at Step 1 when contact collection is OFF (fields optional)', () => {
    mockCurrentUserPreference = { collectContacts: false };

    render(
      <MotorQuoteWizard
        isOpen={true}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByText(/Contact collection is/i)).toBeInTheDocument();
    expect(screen.getByText(/OFF/i)).toBeInTheDocument();

    const nextBtn = screen.getByRole('button', { name: /Continue/i });
    expect(nextBtn).not.toBeDisabled();
  });

  it('blocks proceeding at Step 1 when contact collection is ON and customer details are missing', () => {
    mockCurrentUserPreference = { collectContacts: true };

    render(
      <MotorQuoteWizard
        isOpen={true}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    expect(screen.getByText(/Contact collection ON/i)).toBeInTheDocument();
    expect(screen.getByText(/Customer name and mobile number are required/i)).toBeInTheDocument();

    const nextBtn = screen.getByRole('button', { name: /Continue/i });
    expect(nextBtn).toBeDisabled();
  });

  it('enables proceeding at Step 1 when contact collection is ON and valid details are entered', async () => {
    mockCurrentUserPreference = { collectContacts: true };

    render(
      <MotorQuoteWizard
        isOpen={true}
        onClose={vi.fn()}
        onSaved={vi.fn()}
      />
    );

    const nextBtn = screen.getByRole('button', { name: /Continue/i });
    expect(nextBtn).toBeDisabled();

    // Fill customer name
    const nameInput = screen.getByPlaceholderText(/e\.g\. John Doe/i);
    fireEvent.change(nameInput, { target: { value: 'Rahul Sharma' } });

    // Still disabled because mobile is missing
    expect(nextBtn).toBeDisabled();

    // Fill valid 10-digit mobile
    const mobileInput = screen.getByPlaceholderText(/10-digit number/i);
    fireEvent.change(mobileInput, { target: { value: '9876543210' } });

    // Now valid -> Continue button enabled!
    expect(nextBtn).not.toBeDisabled();
  });
});
