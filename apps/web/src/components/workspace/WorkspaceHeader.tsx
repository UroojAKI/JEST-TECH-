'use client';

import React from 'react';
import Link from 'next/link';
import { useAuthStore } from '../../store/auth-store';
import { useWorkspace } from '../../hooks/useWorkspace';
import { Bell, Search, User, LogOut, Shield, Building } from 'lucide-react';

export function WorkspaceHeader() {
  const { user, logout } = useAuthStore();
  const { jobRole, department, workspace } = useWorkspace();

  return (
    <header className="h-16 border-b bg-card text-card-foreground flex items-center justify-between px-4 sm:px-6 sticky top-0 z-30 shadow-xs">
      {/* Brand & Workspace Title */}
      <div className="flex items-center space-x-3">
        <Link href="/workspace" className="flex items-center space-x-2">
          <div className="h-8 w-8 rounded-lg bg-primary flex items-center justify-center font-black text-primary-foreground text-sm">
            JP
          </div>
          <span className="font-extrabold text-base tracking-tight hidden sm:inline-block">
            JEST Policy CRM
          </span>
        </Link>

        {department && (
          <div className="hidden md:flex items-center space-x-1.5 px-2.5 py-1 rounded-full bg-muted/40 text-muted-foreground text-xs font-semibold">
            <Building className="h-3.5 w-3.5" />
            <span>{department.name}</span>
          </div>
        )}
      </div>

      {/* Center Search */}
      <div className="flex-1 max-w-md mx-4 hidden lg:block">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Global search across Leads, Policies, Claims, Contacts..."
            className="w-full pl-9 pr-4 py-2 text-xs rounded-xl border bg-muted/20 focus:outline-hidden focus:ring-1 focus:ring-primary"
          />
        </div>
      </div>

      {/* User Actions & Avatar */}
      <div className="flex items-center space-x-3">
        <button className="p-2 rounded-lg text-muted-foreground hover:bg-accent relative">
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-card" />
        </button>

        <div className="flex items-center space-x-2 pl-2 border-l">
          <div className="h-8 w-8 rounded-full bg-primary/10 text-primary border flex items-center justify-center font-bold text-xs">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div className="hidden sm:block text-left text-xs">
            <div className="font-bold text-foreground leading-tight">
              {user?.firstName} {user?.lastName}
            </div>
            <div className="text-[10px] text-muted-foreground font-medium">
              {jobRole?.name || user?.roles?.[0] || 'Employee'}
            </div>
          </div>

          <button
            onClick={() => {
              logout();
              window.location.href = '/login';
            }}
            title="Log Out"
            className="p-1.5 rounded-lg text-muted-foreground hover:text-rose-600 hover:bg-rose-500/10 transition-colors"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
