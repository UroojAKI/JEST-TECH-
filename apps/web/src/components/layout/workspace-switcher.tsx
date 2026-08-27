'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import {
  Layers,
  ChevronDown,
  Check,
  TrendingUp,
  DollarSign,
  Briefcase,
  RotateCcw,
  ShieldAlert,
  BarChart3,
  Settings,
  Grid,
} from 'lucide-react';
import { workspaceRepository } from '../../repositories/workspace.repository';
import { useAuthStore } from '../../store/auth-store';

const ICON_MAP: Record<string, React.ReactNode> = {
  TrendingUp: <TrendingUp className="h-4 w-4 text-emerald-500" />,
  DollarSign: <DollarSign className="h-4 w-4 text-amber-500" />,
  Briefcase: <Briefcase className="h-4 w-4 text-blue-500" />,
  RotateCcw: <RotateCcw className="h-4 w-4 text-purple-500" />,
  ShieldAlert: <ShieldAlert className="h-4 w-4 text-rose-500" />,
  BarChart3: <BarChart3 className="h-4 w-4 text-indigo-500" />,
  Settings: <Settings className="h-4 w-4 text-slate-500" />,
};

export function WorkspaceSwitcher() {
  const router = useRouter();
  const pathname = usePathname();
  const { isAuthenticated } = useAuthStore();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const { data: workspaces = [], isLoading } = useQuery({
    queryKey: ['user-workspaces'],
    queryFn: () => workspaceRepository.getUserWorkspaces(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  // Close dropdown on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Determine active workspace from pathname
  const getActiveWorkspace = () => {
    if (!workspaces || workspaces.length === 0) return null;
    return workspaces.find((w) => pathname === w.href || pathname.startsWith(w.href + '/')) || workspaces[0];
  };

  const activeWorkspace = getActiveWorkspace();

  if (isLoading || !workspaces || workspaces.length === 0) {
    return null;
  }

  // If user has only 1 workspace, show minimal non-clickable badge
  if (workspaces.length === 1 && activeWorkspace) {
    return (
      <div className="hidden lg:flex items-center space-x-1.5 rounded-lg border bg-muted/30 px-2.5 py-1 text-xs font-semibold text-muted-foreground">
        {ICON_MAP[activeWorkspace.icon] || <Layers className="h-3.5 w-3.5 text-primary" />}
        <span>{activeWorkspace.title}</span>
      </div>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 rounded-lg border bg-card/80 px-2.5 py-1.5 text-xs font-semibold shadow-xs hover:bg-accent hover:text-foreground transition-all duration-150 border-primary/20"
        title="Switch active role workspace"
      >
        <div className="flex items-center space-x-1.5">
          {activeWorkspace ? (
            ICON_MAP[activeWorkspace.icon] || <Layers className="h-3.5 w-3.5 text-primary" />
          ) : (
            <Layers className="h-3.5 w-3.5 text-primary" />
          )}
          <span className="max-w-[140px] truncate text-foreground font-bold">
            {activeWorkspace ? activeWorkspace.title : 'Workspaces'}
          </span>
        </div>
        <ChevronDown
          className={`h-3.5 w-3.5 text-muted-foreground transition-transform duration-200 ${
            isOpen ? 'rotate-180 text-primary' : ''
          }`}
        />
      </button>

      {isOpen && (
        <div className="absolute left-0 mt-1.5 w-72 rounded-xl border bg-card p-1.5 shadow-xl z-50 animate-in fade-in-50 zoom-in-95 duration-150">
          <div className="px-2.5 py-1.5 border-b mb-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
              Authorized Workspaces
            </div>
            <div className="text-[11px] text-muted-foreground">
              Switch role context to access specific workflows
            </div>
          </div>

          <div className="max-h-64 overflow-y-auto space-y-0.5">
            {workspaces.map((ws) => {
              const isCurrent = activeWorkspace?.code === ws.code;
              return (
                <button
                  key={ws.code}
                  onClick={() => {
                    setIsOpen(false);
                    router.push(ws.href);
                  }}
                  className={`w-full flex items-start space-x-2.5 rounded-lg px-2.5 py-2 text-left text-xs transition-colors ${
                    isCurrent
                      ? 'bg-primary/10 text-primary font-bold'
                      : 'hover:bg-accent text-card-foreground'
                  }`}
                >
                  <div className="mt-0.5 shrink-0">
                    {ICON_MAP[ws.icon] || <Layers className="h-4 w-4" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold truncate">{ws.title}</span>
                      {isCurrent && <Check className="h-3.5 w-3.5 text-primary shrink-0 ml-1" />}
                    </div>
                    <p className="text-[10px] text-muted-foreground line-clamp-1 mt-0.5">
                      {ws.description}
                    </p>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="border-t mt-1 pt-1">
            <button
              onClick={() => {
                setIsOpen(false);
                router.push('/workspace');
              }}
              className="w-full flex items-center justify-center space-x-1.5 rounded-md px-2 py-1.5 text-[11px] font-semibold text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              <Grid className="h-3 w-3" />
              <span>Workspace Hub Overview</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
