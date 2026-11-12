import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import UserManagementPage from './page';
import { useAdminUsers } from '../../../hooks/useAdmin';
import { adminRepository } from '../../../repositories/admin.repository';
import { apiClient } from '../../../lib/api-client';

const invalidateQueriesMock = vi.fn();
const updateUserMock = vi.fn();

vi.mock('../../../hooks/useAdmin', () => ({
  useAdminUsers: vi.fn(),
}));

vi.mock('../../../repositories/admin.repository', () => ({
  adminRepository: {
    getBranches: vi.fn().mockResolvedValue([]),
    getRoles: vi.fn().mockResolvedValue([
      { code: 'AGENT', name: 'Insurance Agent' },
      { code: 'BACK_OFFICE', name: 'Back Office Operations' },
      { code: 'ADMIN', name: 'Administrator' },
    ]),
    createUser: vi.fn(),
    resetUserPassword: vi.fn(),
  },
}));

vi.mock('../../../lib/api-client', () => ({
  apiClient: {
    post: vi.fn(),
  },
}));

vi.mock('@tanstack/react-query', () => ({
  useQueryClient: () => ({ invalidateQueries: invalidateQueriesMock }),
  useQuery: ({ queryKey }: { queryKey: string[] }) => {
    if (queryKey[0] === 'admin-roles') {
      return {
        data: [
          { code: 'AGENT', name: 'Insurance Agent' },
          { code: 'BACK_OFFICE', name: 'Back Office Operations' },
          { code: 'ADMIN', name: 'Administrator' },
        ],
      };
    }
    return { data: [] };
  },
}));

vi.mock('../../../components/layout/app-shell', () => ({
  AppShell: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

vi.mock('../../../components/ui/status-badge', () => ({
  StatusBadge: ({ status }: { status: string }) => <span>{status}</span>,
}));

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

describe('UserManagementPage mobile number workflow', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    updateUserMock.mockResolvedValue({});
    (useAdminUsers as any).mockReturnValue({
      users: [
        {
          id: 'user-1',
          employeeCode: 'EMP-000001',
          firstName: 'Asha',
          lastName: 'Verma',
          email: 'asha@example.com',
          phone: '1234567890',
          role: 'AGENT',
          status: 'ACTIVE',
          collectContacts: false,
        },
      ],
      isLoading: false,
      isFetching: false,
      isError: false,
      updateUserStatus: vi.fn(),
      updateUser: updateUserMock,
      isUpdating: false,
    });
  });

  it('displays user mobile number in the table and submits phone in Provision User form', async () => {
    (adminRepository.createUser as any).mockResolvedValue({
      id: 'user-2',
      initialPassword: 'TempPassword123',
    });

    const { container } = render(<UserManagementPage />);

    expect(screen.getByText('1234567890')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Provision User/i }));

    const textInputs = container.querySelectorAll('form input[type="text"], form input[type="email"], form input[type="tel"]');
    fireEvent.change(textInputs[0], { target: { value: 'Rohan' } });
    fireEvent.change(textInputs[1], { target: { value: 'Shah' } });
    fireEvent.change(textInputs[2], { target: { value: 'rohan@example.com' } });

    const mobileInput = screen.getByPlaceholderText('10-digit mobile number');
    fireEvent.change(mobileInput, { target: { value: '98765abc43210' } });
    expect((mobileInput as HTMLInputElement).value).toBe('9876543210');

    const submitButton = container.querySelector('form button[type="submit"]') as HTMLButtonElement;
    fireEvent.click(submitButton);

    await waitFor(() => {
      expect(adminRepository.createUser).toHaveBeenCalledWith(
        expect.objectContaining({
          firstName: 'Rohan',
          lastName: 'Shah',
          email: 'rohan@example.com',
          phone: '9876543210',
        })
      );
    });
  });

  it('submits optional phone in Invite User mode and allows editing existing mobile number', async () => {
    (apiClient.post as any).mockResolvedValue({ data: { success: true } });

    const { container } = render(<UserManagementPage />);

    fireEvent.click(screen.getByRole('button', { name: /Invite User/i }));
    const textInputs = container.querySelectorAll('form input[type="text"], form input[type="email"]');
    fireEvent.change(textInputs[0], { target: { value: 'Neha' } });
    fireEvent.change(textInputs[1], { target: { value: 'Kapoor' } });
    fireEvent.change(textInputs[2], { target: { value: 'neha@example.com' } });
    fireEvent.change(screen.getByPlaceholderText('10-digit mobile number'), {
      target: { value: '1234567890' },
    });

    fireEvent.click(screen.getByRole('button', { name: /Send 72-hour invitation/i }));

    await waitFor(() => {
      expect(apiClient.post).toHaveBeenCalledWith(
        '/users/invitations',
        expect.objectContaining({
          email: 'neha@example.com',
          phone: '1234567890',
        })
      );
    });

    fireEvent.click(screen.getByTitle('Edit Mobile Number'));
    const editInput = screen.getByPlaceholderText('Enter 10-digit mobile number');
    expect((editInput as HTMLInputElement).value).toBe('1234567890');
    fireEvent.change(editInput, { target: { value: '9988776655' } });
    fireEvent.click(screen.getByRole('button', { name: /Save Mobile/i }));

    await waitFor(() => {
      expect(updateUserMock).toHaveBeenCalledWith({
        id: 'user-1',
        data: { phone: '9988776655' },
      });
    });
  });
});
