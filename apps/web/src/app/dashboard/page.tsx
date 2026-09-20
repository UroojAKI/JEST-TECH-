'use client';
 
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../store/auth-store';

export default function DashboardPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    const roles = (user?.roles?.length ? user.roles : (user?.role ? [user.role] : []))
      .map((r: string) => String(r).toUpperCase());

    if (roles.some((r) => ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMINISTRATOR'].includes(r))) {
      router.replace('/workspace/admin');
    } else if (roles.some((r) => ['BACK_OFFICE', 'OPERATIONS', 'UNDERWRITER', 'FINANCE', 'FINANCE_OFFICER', 'CLAIMS_HANDLER'].includes(r))) {
      router.replace('/workspace/operations');
    } else if (roles.some((r) => ['AGENT', 'SALES_AGENT'].includes(r))) {
      router.replace('/workspace/sales');
    } else {
      router.replace('/workspace');
    }
  }, [isAuthenticated, user, router]);

  return null;
}
