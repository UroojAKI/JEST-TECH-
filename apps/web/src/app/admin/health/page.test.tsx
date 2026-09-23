import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import InfrastructureHealthPage from './page';
import { useSystemHealth } from '../../../hooks/useAdmin';

vi.mock('../../../hooks/useAdmin', () => ({
  useSystemHealth: vi.fn(),
}));

vi.mock('../../../components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

describe('InfrastructureHealthPage (F-031, F-046)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders operational state when all subsystems are healthy', () => {
    (useSystemHealth as any).mockReturnValue({
      data: {
        status: 'ok',
        uptime: 3600,
        checks: {
          database: { status: 'ok', latencyMs: 3 },
          redis: { status: 'ok', latencyMs: 1 },
          memory: { status: 'ok', heapUsedMB: 120, heapLimitMB: 512 },
          outbox: { status: 'ok', pendingEvents: 0 },
          disk: { status: 'ok' },
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<InfrastructureHealthPage />);

    expect(screen.getByText(/All Systems Operational/i)).toBeInTheDocument();
    expect(screen.getByText(/200 OK/i)).toBeInTheDocument();
    expect(screen.getAllByText(/Connected/i)).toHaveLength(2);
    expect(screen.getByText(/Ping Latency: 3ms/i)).toBeInTheDocument();
    expect(screen.getByText(/120 MB \/ 512 MB/i)).toBeInTheDocument();
  });

  it('renders degraded state when database is disconnected', () => {
    (useSystemHealth as any).mockReturnValue({
      data: {
        status: 'degraded',
        uptime: 120,
        checks: {
          database: { status: 'down', latencyMs: 0 },
          redis: { status: 'ok', latencyMs: 1 },
          memory: { status: 'ok', heapUsedMB: 100, heapLimitMB: 512 },
          outbox: { status: 'down', pendingEvents: 15 },
          disk: { status: 'ok' },
        },
      },
      isLoading: false,
      isError: false,
    });

    render(<InfrastructureHealthPage />);

    expect(screen.getByText(/Systems Degraded \/ Attention Required/i)).toBeInTheDocument();
    expect(screen.getByText(/Disconnected/i)).toBeInTheDocument();
    expect(screen.getByText(/15 Pending/i)).toBeInTheDocument();
  });

  it('renders loading state when polling', () => {
    (useSystemHealth as any).mockReturnValue({
      data: null,
      isLoading: true,
      isError: false,
    });

    render(<InfrastructureHealthPage />);

    expect(screen.getByText(/Polling System Status\.\.\./i)).toBeInTheDocument();
  });
});
