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
    onSuccess: (responseData) => {
      const data = (responseData as any).data || responseData;
      // Normalize API response: API returns `role` (string), but UserSession expects
      // `roles` (array) and `permissions` (array). Map them here.
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
      const accessToken = data?.accessToken || (responseData as any).accessToken;
      const refreshToken = data?.refreshToken || (responseData as any).refreshToken;
      if (accessToken && typeof window !== 'undefined') {
        document.cookie = `access_token=${accessToken}; path=/; max-age=900; SameSite=Lax`;
        localStorage.setItem('jest_access_token', accessToken);
      }
      if (refreshToken && typeof window !== 'undefined') {
        document.cookie = `refresh_token=${refreshToken}; path=/; max-age=2592000; SameSite=Lax`;
        localStorage.setItem('jest_refresh_token', refreshToken);
      }
      setUser(normalizedUser);
      toast.success(`Welcome back, ${normalizedUser.firstName}!`);
      if (typeof window !== 'undefined') {
        window.location.href = '/workspace';
      } else {
        router.push('/workspace');
      }
    },
    onError: (error: any) => {
      toast.error(error.response?.data?.message || 'Invalid email or password');
    },
  });

  const logoutMutation = useMutation({
    mutationFn: authRepository.logout,
    onSuccess: () => {
      if (typeof window !== 'undefined') {
        document.cookie = 'access_token=; path=/; max-age=0';
        document.cookie = 'refresh_token=; path=/; max-age=0';
        localStorage.removeItem('jest_access_token');
        localStorage.removeItem('jest_refresh_token');
      }
      clearAuthStore();
      queryClient.clear();
      toast.success('Logged out successfully');
      router.push('/login');
    },
    onError: () => {
      if (typeof window !== 'undefined') {
        document.cookie = 'access_token=; path=/; max-age=0';
        document.cookie = 'refresh_token=; path=/; max-age=0';
        localStorage.removeItem('jest_access_token');
        localStorage.removeItem('jest_refresh_token');
      }
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
    loginError: loginMutation.error ? (loginMutation.error as any).response?.data?.message || 'Invalid email or password' : null,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };

}
