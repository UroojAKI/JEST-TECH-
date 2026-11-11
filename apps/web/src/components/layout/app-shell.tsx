'use client';

import React from 'react';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { AppFooter } from './app-footer';
import NotificationDrawer from '../dashboard/notification-drawer';
import { ProfileDrawer } from './profile-drawer';
import { CommandPalette } from '../search/command-palette';
import { useUIStore } from '../../store/ui-store';

export function AppShell({
  children,
  activeWorkspace,
}: {
  children: React.ReactNode;
  activeWorkspace?: string;
}) {
  const isNotificationDrawerOpen = useUIStore((s) => s.isNotificationDrawerOpen);
  const setNotificationDrawerOpen = useUIStore((s) => s.setNotificationDrawerOpen);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased selection:bg-primary selection:text-primary-foreground">
      {/* Global Command Palette */}
      <CommandPalette />

      {/* Header */}
      <AppHeader />

      {/* Main Container */}
      <div className="flex min-w-0 flex-1">
        <AppSidebar />
        <main className="min-w-0 flex-1 overflow-x-hidden px-3 py-4 sm:px-4 lg:p-6 bg-muted/10 flex flex-col justify-between">
          <div className="space-y-6">{children}</div>
          <AppFooter />
        </main>
      </div>

      {/* Slide-over Drawers */}
      <NotificationDrawer
        isOpen={isNotificationDrawerOpen}
        onClose={() => setNotificationDrawerOpen(false)}
      />
      <ProfileDrawer />
    </div>
  );
}

