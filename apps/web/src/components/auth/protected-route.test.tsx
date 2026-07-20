import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProtectedRoute from './protected-route';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(),
}));

describe('ProtectedRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state when not hydrated', () => {
    (useAuthStore as any).mockReturnValue({
      isAuthenticated: false,
      user: null,
      _hasHydrated: false,
    });

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText(/Loading your session/i)).toBeInTheDocument();
  });

  it('shows redirecting state when not authenticated', () => {
    (useAuthStore as any).mockReturnValue({
      isAuthenticated: false,
      user: null,
      _hasHydrated: true,
    });

    render(
      <ProtectedRoute>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByText(/Redirecting to login/i)).toBeInTheDocument();
  });

  it('renders children when authenticated and authorized', () => {
    (useAuthStore as any).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'ADMIN' },
      _hasHydrated: true,
    });

    render(
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );

    expect(screen.getByTestId('protected-content')).toBeInTheDocument();
  });
});
