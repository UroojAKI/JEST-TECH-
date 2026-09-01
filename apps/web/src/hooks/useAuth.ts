'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authRepository } from '../repositories/auth.repository';
import { useAuthStore } from '../store/auth-store';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';

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

      const destination = data?.landingWorkspace || (responseData as any).landingWorkspace || '/workspace';
      window.location.href = destination;
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Invalid email or password');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authRepository.logout,
    onSuccess: () => {
      clearAuthStore();
      queryClient.clear();
      toast.success('Logged out successfully');
      router.push('/login');
    },
    onError: () => {
      // Clear client session even when the network request fails. Server-side
      // refresh-token revocation remains authoritative on the next request.
      clearAuthStore();
      queryClient.clear();
      router.push('/login');
    },
  });

  return {
    user,
    isAuthenticated,
    isLoading,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error
      ? (loginMutation.error as any).response?.data?.message || 'Invalid email or password'
      : null,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
