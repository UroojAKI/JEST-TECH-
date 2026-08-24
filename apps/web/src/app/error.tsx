'use client';
import { useEffect } from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.error('[GlobalError]', error);
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-8 glass rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center text-center space-y-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-destructive/20 to-transparent opacity-50 -z-10" />
        
        <div className="w-20 h-20 rounded-full bg-destructive/10 flex items-center justify-center border border-destructive/20 mb-2">
          <AlertTriangle className="w-10 h-10 text-destructive" />
        </div>
        
        <div className="space-y-2">
          <h2 className="text-2xl font-bold tracking-tight text-foreground">
            Something went wrong
          </h2>
          <p className="text-muted-foreground text-sm">
            We encountered an unexpected error while processing your request. Our team has been notified.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row w-full gap-3 pt-4">
          <button
            onClick={() => reset()}
            className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-primary/90 transition-colors"
          >
            <RefreshCcw className="w-4 h-4" />
            Try Again
          </button>
          
          <Link
            href="/dashboard"
            className="flex-1 flex items-center justify-center gap-2 bg-secondary text-secondary-foreground px-4 py-2.5 rounded-lg font-medium hover:bg-secondary/80 transition-colors border border-border"
          >
            <Home className="w-4 h-4" />
            Go to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
