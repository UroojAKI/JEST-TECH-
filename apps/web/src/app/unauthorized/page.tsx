'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldCheck, ArrowRight, Home, HelpCircle } from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';

export default function UnauthorizedPage() {
  const user = useAuthStore((s) => s.user);

  // Determine user's primary workspace route
  const getWorkspaceRoute = () => {
    if (!user) return { href: '/login', label: 'Go to Login' };
    const roles = (user.roles?.length ? user.roles : [user.role || ''])
      .filter(Boolean)
      .map((r) => r.toUpperCase());

    if (roles.some((r) => ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMINISTRATOR'].includes(r))) {
      return { href: '/workspace/admin', label: 'Return to Command Center' };
    }
    if (roles.some((r) => ['BACK_OFFICE', 'OPERATIONS', 'UNDERWRITER', 'CLAIMS_HANDLER', 'FINANCE_OFFICER'].includes(r))) {
      return { href: '/workspace/operations', label: 'Return to Operations Workspace' };
    }
    return { href: '/workspace/sales', label: 'Return to My Workspace' };
  };

  const target = getWorkspaceRoute();

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md bg-card border rounded-3xl p-8 text-center shadow-2xl space-y-6">
        <div className="mx-auto w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-inner">
          <ShieldCheck className="h-8 w-8" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-black tracking-tight">Access Restricted</h1>
          <p className="text-sm text-muted-foreground leading-relaxed">
            This module or workspace is reserved for authorized team members. Your account does not currently have permissions to view this area.
          </p>
        </div>

        <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
          <Link
            href={target.href}
            className="w-full sm:w-auto inline-flex items-center justify-center space-x-2 px-5 py-2.5 text-xs font-bold rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-md hover:shadow-lg transition-all"
          >
            <Home className="h-4 w-4" />
            <span>{target.label}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="pt-4 border-t text-[11px] text-muted-foreground flex items-center justify-center space-x-1">
          <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/70" />
          <span>Need access? Please contact your system administrator or team lead.</span>
        </div>
      </div>
    </div>
  );
}
