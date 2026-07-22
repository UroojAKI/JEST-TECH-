'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-md bg-card border rounded-2xl p-8 text-center shadow-xl space-y-4">
        <div className="inline-flex p-4 rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-8 w-8" />
        </div>
        <h1 className="text-xl font-bold tracking-tight">Access Restricted (403)</h1>
        <p className="text-xs text-muted-foreground">
          You do not have the required permissions or assigned role to view this module.
        </p>
        <div className="pt-4">
          <Link
            href="/dashboard"
            className="inline-flex items-center space-x-2 px-4 py-2 text-xs font-semibold rounded-md bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>Return to Dashboard</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
