'use client';

import React from 'react';
import { AppHeader } from './app-header';
import { AppSidebar } from './app-sidebar';
import { AppFooter } from './app-footer';
import { NotificationDrawer } from './notification-drawer';
import { ProfileDrawer } from './profile-drawer';
import { CommandPalette } from '../search/command-palette';

export function AppShell({
  children,
  activeWorkspace,
}: {
  children: React.ReactNode;
  activeWorkspace?: string;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col antialiased selection:bg-primary selection:text-primary-foreground">
      {/* Global Command Palette */}
      <CommandPalette />

      {/* Header */}
      <AppHeader />

      {/* Main Container */}
      <div className="flex flex-1">
        <AppSidebar />
        <main className="flex-1 overflow-x-hidden p-6 bg-muted/10 flex flex-col justify-between">
          <div className="space-y-6">{children}</div>
          <AppFooter />
        </main>
      </div>

      {/* Slide-over Drawers */}
      <NotificationDrawer />
      <ProfileDrawer />
    </div>
  );
}
