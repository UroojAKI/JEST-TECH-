'use client';

import React from 'react';
import { useTheme } from 'next-themes';
import {
  Bell,
  Search,
  Moon,
  Sun,
  Menu,
  User,
  ShieldCheck,
  Building2,
  ChevronDown,
} from 'lucide-react';
import { useUIStore } from '../../store/ui-store';
import { useAuthStore } from '../../store/auth-store';
import { useCustomerContext } from '../../store/customer-context';
import { BreadcrumbNav } from './breadcrumb-nav';

export function AppHeader() {
  const { theme, setTheme } = useTheme();
  const { user } = useAuthStore();
  const {
    toggleSidebar,
    setCommandPaletteOpen,
    setNotificationDrawerOpen,
    setProfileDrawerOpen,
  } = useUIStore();
  const { activeCustomerName, clearActiveCustomer } = useCustomerContext();

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-background/95 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      {/* Left section: Mobile menu + Breadcrumbs */}
      <div className="flex items-center space-x-3">
        <button
          onClick={toggleSidebar}
          className="rounded-md p-1.5 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Toggle Navigation"
        >
          <Menu className="h-5 w-5" />
        </button>
        <BreadcrumbNav />
      </div>

      {/* Middle section: Active Customer Context Badge (if selected) */}
      {activeCustomerName && (
        <div className="hidden md:flex items-center space-x-2 rounded-full bg-primary/10 px-3 py-1 text-xs text-primary font-medium border border-primary/20">
          <Building2 className="h-3.5 w-3.5" />
          <span>Active Context: <strong>{activeCustomerName}</strong></span>
          <button
            onClick={clearActiveCustomer}
            className="ml-1 rounded-full p-0.5 hover:bg-primary/20 transition-colors"
            title="Clear customer context"
          >
            ×
          </button>
        </div>
      )}

      {/* Right section: Cmd+K Search, Theme, Notifications, User Profile */}
      <div className="flex items-center space-x-2">
        {/* Global Search Button */}
        <button
          onClick={() => setCommandPaletteOpen(true)}
          className="hidden sm:flex items-center space-x-2 rounded-md border bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
        >
          <Search className="h-3.5 w-3.5" />
          <span>Search...</span>
          <kbd className="pointer-events-none inline-flex h-4 select-none items-center rounded border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground opacity-100">
            ⌘K
          </kbd>
        </button>

        {/* Theme Toggle */}
        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Toggle theme"
        >
          <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
          <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
          <span className="sr-only">Toggle theme</span>
        </button>

        {/* Notification Bell */}
        <button
          onClick={() => setNotificationDrawerOpen(true)}
          className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors"
          title="Notifications"
        >
          <Bell className="h-4 w-4" />
          <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive animate-pulse" />
        </button>

        {/* User Profile Avatar Trigger */}
        <button
          onClick={() => setProfileDrawerOpen(true)}
          className="flex items-center space-x-2 rounded-md p-1.5 hover:bg-accent transition-colors"
        >
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-primary/20 text-xs font-bold text-primary">
            {user?.firstName?.[0] || 'U'}
          </div>
          <div className="hidden md:flex flex-col text-left text-xs">
            <span className="font-semibold leading-none">{user?.firstName} {user?.lastName}</span>
            <span className="text-[10px] text-muted-foreground">{user?.roles?.[0] || 'User'}</span>
          </div>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
