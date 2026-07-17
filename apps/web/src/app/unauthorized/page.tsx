'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';

export default function UnauthorizedPage() {
  return (
    <div className="flex h-screen items-center justify-center bg-slate-950 text-white p-6">
      <div className="glass max-w-md w-full rounded-2xl p-8 text-center shadow-2xl">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-rose-500/20 text-rose-400 mb-6">
          <ShieldAlert className="h-6 w-6" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight mb-2">Access Denied</h1>
        <p className="text-sm text-slate-400 mb-6">
          You do not have the required permissions to access this portal page. Please contact your system administrator.
        </p>
        <Link
          href="/dashboard"
          className="inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:bg-indigo-500 transition-colors"
        >
          Return to Dashboard
        </Link>
      </div>
    </div>
  );
}
