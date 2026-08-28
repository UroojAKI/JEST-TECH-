'use client';

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  ArrowRight,
  TrendingUp,
  DollarSign,
  Briefcase,
  RotateCcw,
  ShieldAlert,
  BarChart3,
  Settings,
  ShieldCheck,
  Loader2,
  Sparkles,
} from 'lucide-react';
import { workspaceRepository } from '../../repositories/workspace.repository';
import { useAuthStore } from '../../store/auth-store';

const ICON_MAP: Record<string, React.ReactNode> = {
  TrendingUp: <TrendingUp className="h-6 w-6 text-emerald-500" />,
  DollarSign: <DollarSign className="h-6 w-6 text-amber-500" />,
  Briefcase: <Briefcase className="h-6 w-6 text-blue-500" />,
  RotateCcw: <RotateCcw className="h-6 w-6 text-purple-500" />,
  ShieldAlert: <ShieldAlert className="h-6 w-6 text-rose-500" />,
  BarChart3: <BarChart3 className="h-6 w-6 text-indigo-500" />,
  Settings: <Settings className="h-6 w-6 text-slate-500" />,
};

const COLOR_MAP: Record<string, { border: string; bg: string; badge: string }> = {
  SALES: { border: 'hover:border-emerald-500/50', bg: 'bg-emerald-500/10', badge: 'bg-emerald-500/15 text-emerald-600' },
  FINANCE: { border: 'hover:border-amber-500/50', bg: 'bg-amber-500/10', badge: 'bg-amber-500/15 text-amber-600' },
  BACK_OFFICE: { border: 'hover:border-blue-500/50', bg: 'bg-blue-500/10', badge: 'bg-blue-500/15 text-blue-600' },
  RENEWALS: { border: 'hover:border-purple-500/50', bg: 'bg-purple-500/10', badge: 'bg-purple-500/15 text-purple-600' },
  CLAIMS: { border: 'hover:border-rose-500/50', bg: 'bg-rose-500/10', badge: 'bg-rose-500/15 text-rose-600' },
  MANAGEMENT: { border: 'hover:border-indigo-500/50', bg: 'bg-indigo-500/10', badge: 'bg-indigo-500/15 text-indigo-600' },
  ADMINISTRATION: { border: 'hover:border-slate-500/50', bg: 'bg-slate-500/10', badge: 'bg-slate-500/15 text-slate-600' },
};

export default function WorkspaceHubPage() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuthStore();

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['user-workspaces'],
    queryFn: () => workspaceRepository.getUserWorkspaces(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  // If user only has 1 workspace authorized, automatically navigate there
  useEffect(() => {
    if (!isLoading && workspaces.length === 1 && workspaces[0].href) {
      router.replace(workspaces[0].href);
    }
  }, [workspaces, isLoading, router]);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-4">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <div className="text-sm font-medium text-muted-foreground animate-pulse">
          Resolving authorized enterprise workspaces...
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto py-8 px-4 sm:px-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center space-x-2 text-primary text-xs font-bold uppercase tracking-wider mb-2">
          <ShieldCheck className="h-4 w-4" />
          <span>Multi-User Role Routing</span>
        </div>
        <h1 className="text-3xl font-black tracking-tight flex items-center gap-2">
          Enterprise Workspaces <Sparkles className="h-5 w-5 text-primary" />
        </h1>
        <p className="text-sm text-muted-foreground mt-1 max-w-2xl">
          Welcome back, <strong className="text-foreground">{user?.firstName} {user?.lastName}</strong>.
          Select an authorized department workbench to begin your operational workflow.
        </p>
      </div>

      {/* Workspaces Card Grid */}
      {workspaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed p-12 text-center">
          <Layers className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
          <h3 className="text-base font-bold">No Authorized Workspaces</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Your account has not been assigned to any functional workspace. Please contact your system administrator.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {workspaces.map((ws) => {
            const colors = COLOR_MAP[ws.code] || {
              border: 'hover:border-primary/50',
              bg: 'bg-primary/10',
              badge: 'bg-primary/15 text-primary',
            };

            return (
              <div
                key={ws.code}
                onClick={() => router.push(ws.href)}
                className={`group relative rounded-2xl border bg-card p-6 shadow-xs hover:shadow-lg transition-all duration-200 cursor-pointer flex flex-col justify-between ${colors.border}`}
              >
                <div>
                  <div className="flex items-start justify-between mb-4">
                    <div className={`h-12 w-12 rounded-xl flex items-center justify-center ${colors.bg}`}>
                      {ICON_MAP[ws.icon] || <Layers className="h-6 w-6 text-primary" />}
                    </div>
                    <span className={`text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ${colors.badge}`}>
                      {ws.code}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-card-foreground group-hover:text-primary transition-colors">
                    {ws.title}
                  </h3>
                  <p className="text-xs text-muted-foreground mt-2 leading-relaxed">
                    {ws.description}
                  </p>
                </div>

                <div className="mt-6 pt-4 border-t flex items-center justify-between text-xs font-semibold text-primary">
                  <span>Enter Workspace</span>
                  <ArrowRight className="h-4 w-4 transform group-hover:translate-x-1 transition-transform" />
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
