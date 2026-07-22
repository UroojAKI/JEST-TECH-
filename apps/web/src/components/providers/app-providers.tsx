'use client';

import React from 'react';
import { ThemeProvider } from 'next-themes';
import { Toaster } from 'sonner';
import QueryProvider from './query-provider';
import { PermissionProvider } from './permission-provider';
import { IdleTimeoutProvider } from './idle-timeout-provider';

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
      <QueryProvider>
        <PermissionProvider>
          <IdleTimeoutProvider>
            {children}
            <Toaster position="top-right" richColors closeButton />
          </IdleTimeoutProvider>
        </PermissionProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}
