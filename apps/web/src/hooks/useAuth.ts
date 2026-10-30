'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authRepository } from '../repositories/auth.repository';
import { useAuthStore } from '../store/auth-store';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { getSafeInternalDestination } from '../lib/api-client';

export function useAuth() {
  const { user, isAuthenticated, isLoading, setUser, logout: clearAuthStore } = useAuthStore();
  const queryClient = useQueryClient();
  const router = useRouter();

  const loginMutation = useMutation({
    mutationFn: authRepository.login,
    onSuccess: (responseData) => {
      const data = (responseData as any).data || responseData;
      const rawUser = data?.user || (responseData as any).user;
      if (!rawUser) {
        toast.error('Unable to initialize user session from login response.');
        return;
      }

      const normalizedUser = {
        ...rawUser,
        roles: rawUser.roles ?? (rawUser.role ? [rawUser.role] : []),
        permissions: rawUser.permissions ?? [],
      };

      // Tokens are intentionally absent from the client session. The API sets
      // Secure/HttpOnly cookies and axios sends them with credentials.
      setUser(normalizedUser);
      toast.success(`Welcome back, ${normalizedUser.firstName}!`);

      // Respect and sanitize safe internal return destination if present
      const searchParams =
        typeof window !== 'undefined'
          ? new URLSearchParams(window.location.search)
          : null;
      const returnUrl = searchParams?.get('returnUrl') || searchParams?.get('from');
      const safeReturn = returnUrl ? getSafeInternalDestination(returnUrl) : null;

      const fallbackDestination =
        data?.landingWorkspace || (responseData as any).landingWorkspace || '/workspace';
      const destination =
        safeReturn && safeReturn !== '/workspace' && safeReturn !== '/login'
          ? safeReturn
          : fallbackDestination;

      window.location.href = destination;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Invalid email or password');
    },
  });

  const performCompleteLogout = () => {
    clearAuthStore();
    queryClient.clear();
    if (typeof window !== 'undefined') {
      try {
        localStorage.removeItem('jest-auth-storage');
        sessionStorage.clear();
      } catch {}
      window.location.replace('/login');
    } else {
      router.replace('/login');
    }
  };

  const logoutMutation = useMutation({
    mutationFn: authRepository.logout,
    onSuccess: () => {
      toast.success('Logged out successfully');
      performCompleteLogout();
    },
    onError: () => {
      // Even if network logout call fails, clear local tokens & storage
      performCompleteLogout();
    },
  });

  return {
    user,
    isAuthenticated,
    isLoading,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: (loginMutation.error as any)?.response?.data?.message || null,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
    performCompleteLogout,
  };
}
