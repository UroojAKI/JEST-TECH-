'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
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
    onSuccess: (data) => {
      // Normalize API response: API returns `role` (string), but UserSession expects
      // `roles` (array) and `permissions` (array). Map them here.
      const rawUser = data.user as any;
      const normalizedUser = {
        ...rawUser,
        roles: rawUser.roles ?? (rawUser.role ? [rawUser.role] : []),
        permissions: rawUser.permissions ?? [],
      };
      setUser(normalizedUser);
      toast.success(`Welcome back, ${normalizedUser.firstName}!`);
      router.push('/dashboard');
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
      clearAuthStore();
      router.push('/login');
    },
  });

  return {
    user,
    isAuthenticated,
    isLoading,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
