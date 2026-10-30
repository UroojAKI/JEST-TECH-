'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';
import { getSafeInternalDestination } from '@/lib/api-client';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export default function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, user, _hasHydrated } = useAuthStore();

  const userRoles = user?.roles || (user?.role ? [user.role] : []);
  const hasAllowedRole =
    !allowedRoles || allowedRoles.some((r) => userRoles.includes(r as any));

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!isAuthenticated) {
      const currentPath =
        typeof window !== 'undefined'
          ? window.location.pathname + window.location.search
          : '';
      const safeTarget = getSafeInternalDestination(currentPath);
      const returnUrlParam = encodeURIComponent(safeTarget);
      router.replace(`/login?returnUrl=${returnUrlParam}`);
    } else if (!hasAllowedRole) {
      router.replace('/unauthorized');
    }
  }, [isAuthenticated, user, allowedRoles, router, _hasHydrated, hasAllowedRole]);

  if (!_hasHydrated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Loading your session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-950 text-white">
        <div className="text-center">
          <div className="h-8 w-8 animate-spin rounded-full border-4 border-indigo-500 border-t-transparent mx-auto mb-4"></div>
          <p className="text-slate-400">Redirecting to login...</p>
        </div>
      </div>
    );
  }

  if (!hasAllowedRole) {
    return null;
  }

  return <>{children}</>;
}
