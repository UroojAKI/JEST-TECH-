import Link from 'next/link';
import { Home, SearchX } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md p-8 glass rounded-3xl border border-white/10 shadow-2xl flex flex-col items-center text-center space-y-6 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-transparent opacity-50 -z-10 animate-gradient-bg" />
        
        <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
          <SearchX className="w-12 h-12 text-primary" />
        </div>
        
        <div className="space-y-3">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground bg-clip-text text-transparent bg-gradient-to-r from-foreground to-foreground/60">
            404
          </h1>
          <h2 className="text-xl font-semibold text-foreground">
            Page Not Found
          </h2>
          <p className="text-muted-foreground text-sm">
            The page you are looking for doesn't exist or has been moved to a new location.
          </p>
        </div>

        <div className="pt-4 w-full">
          <Link
            href="/dashboard"
            className="w-full flex items-center justify-center gap-2 bg-primary text-primary-foreground px-4 py-3 rounded-lg font-medium hover:bg-primary/90 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-primary/20"
          >
            <Home className="w-5 h-5" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
