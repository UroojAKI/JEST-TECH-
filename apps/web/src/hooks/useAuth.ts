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
      setUser(data.user);
      toast.success(`Welcome back, ${data.user.firstName}!`);
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
