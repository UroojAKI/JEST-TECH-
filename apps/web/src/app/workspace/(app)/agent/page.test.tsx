import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import AgentWorkspacePage from './page';
import { useQuery } from '@tanstack/react-query';

vi.mock('@/hooks/useAuth', () => ({
  useAuth: () => ({ user: { id: 'u1', role: 'AGENT' } }),
}));

vi.mock('@tanstack/react-query', () => ({
  useQuery: vi.fn(),
}));

describe('AgentWorkspacePage (F-031, F-045)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders dynamic counts from queries without hardcoded values', () => {
    (useQuery as any).mockImplementation(({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'portal-agent-metrics') {
        return {
          data: {
            activePolicies: 42,
            monthlyGwp: 250000,
          },
          isLoading: false,
        };
      }
      if (queryKey[0] === 'portal-active-agents-count') {
        return {
          data: { total: 85 },
          isLoading: false,
        };
      }
      if (queryKey[0] === 'portal-pending-agents-count') {
        return {
          data: { total: 7 },
          isLoading: false,
        };
      }
      return { data: null, isLoading: false };
    });

    render(<AgentWorkspacePage />);

    expect(screen.getByText('85')).toBeInTheDocument();
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('₹2,50,000')).toBeInTheDocument();
  });
});
