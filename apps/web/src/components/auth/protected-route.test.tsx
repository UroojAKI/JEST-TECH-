import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import ProtectedRoute from './protected-route';
import { useAuthStore } from '@/store/auth';
import { useRouter } from 'next/navigation';
import { getSafeInternalDestination } from '@/lib/api-client';

const mockReplace = vi.fn();
const mockPush = vi.fn();

vi.mock('@/store/auth', () => ({
  useAuthStore: vi.fn(),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    replace: mockReplace,
    push: mockPush,
  }),
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

  it('redirects with safe returnUrl when not authenticated', () => {
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
    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringMatching(/^\/login\?returnUrl=/)
    );
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

  it('redirects to /unauthorized when user does not have allowed role', () => {
    (useAuthStore as any).mockReturnValue({
      isAuthenticated: true,
      user: { role: 'AGENT' },
      _hasHydrated: true,
    });

    render(
      <ProtectedRoute allowedRoles={['ADMIN']}>
        <div data-testid="protected-content">Protected Content</div>
      </ProtectedRoute>
    );

    expect(mockReplace).toHaveBeenCalledWith('/unauthorized');
  });

  describe('getSafeInternalDestination helper', () => {
    it('preserves valid internal paths with query parameters', () => {
      expect(getSafeInternalDestination('/workspace/finance?tab=receipts')).toBe(
        '/workspace/finance?tab=receipts'
      );
    });

    it('rejects external URLs and defaults to /workspace', () => {
      expect(getSafeInternalDestination('https://malicious.com/steal')).toBe('/workspace');
      expect(getSafeInternalDestination('http://52.66.15.81/steal')).toBe('/workspace');
    });

    it('rejects protocol-relative URLs', () => {
      expect(getSafeInternalDestination('//malicious.com')).toBe('/workspace');
      expect(getSafeInternalDestination('/\\malicious.com')).toBe('/workspace');
    });

    it('rejects /login destination to prevent redirect loops', () => {
      expect(getSafeInternalDestination('/login')).toBe('/workspace');
      expect(getSafeInternalDestination('/login?reason=session_expired')).toBe('/workspace');
    });
  });
});
