import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import User360Page from './page';
import { adminRepository } from '../../../../repositories/admin.repository';

vi.mock('next/navigation', () => ({
  useParams: () => ({ id: 'user-1' }),
  useRouter: () => ({ push: vi.fn() }),
}));

vi.mock('../../../../store/auth-store', () => ({
  useAuthStore: (selector: any) => selector({ user: { id: 'admin-1', role: 'ADMIN' } }),
}));

vi.mock('../../../../repositories/admin.repository', () => ({
  adminRepository: {
    getUserWorkspace: vi.fn(),
    getUserCommissions: vi.fn().mockResolvedValue([]),
    getUserIncentives: vi.fn().mockResolvedValue([]),
    updateUser: vi.fn(),
    updateUserStatus: vi.fn(),
    resetUserPassword: vi.fn(),
  },
}));

vi.mock('../../../../components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../../components/ui/status-badge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock('../../../../components/admin/UserPermissionsManager', () => ({
  UserPermissionsManager: () => <div />,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('User360Page inline mobile number editor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    (adminRepository.getUserWorkspace as any).mockResolvedValue({
      profile: {
        id: 'user-1',
        employeeCode: 'EMP-000001',
        firstName: 'Asha',
        lastName: 'Verma',
        name: 'Asha Verma',
        email: 'asha@example.com',
        phone: '1234567890',
        status: 'ACTIVE',
        companyId: 'comp-1',
        collectContacts: false,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        role: { id: 'r1', name: 'Agent', code: 'AGENT', type: 'AGENT' },
      },
      portfolio: {
        leadsCreated: 0,
        customersManaged: 0,
        quotationsGenerated: 0,
        policiesIssued: 0,
        totalPremiumGenerated: 0,
        totalCommissionEarned: 0,
        openTasks: 0,
        recentLeads: [],
        recentQuotations: [],
        recentPolicies: [],
        recentCustomers: [],
      },
      activities: { recentTimeline: [], recentSessions: [] },
      tasks: [],
      organization: { branch: null, department: null, team: null, subUsers: [] },
    });
    (adminRepository.updateUser as any).mockResolvedValue({
      id: 'user-1',
      phone: '9876543210',
    });
  });

  it('allows ADMIN to edit and save mobile phone inline from User 360 profile', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false } },
    });

    render(
      <QueryClientProvider client={queryClient}>
        <User360Page />
      </QueryClientProvider>,
    );

    const editBtn = await screen.findByTitle('Edit Mobile Number');
    fireEvent.click(editBtn);

    const phoneInput = screen.getByLabelText('Mobile Phone') as HTMLInputElement;
    expect(phoneInput.value).toBe('1234567890');
    fireEvent.change(phoneInput, { target: { value: '9876543210' } });

    fireEvent.click(screen.getByTitle('Save Mobile Number'));

    await waitFor(() => {
      expect(adminRepository.updateUser).toHaveBeenCalledWith('user-1', {
        phone: '9876543210',
      });
    });
  });
});

