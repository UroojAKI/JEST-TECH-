import { Shield } from 'lucide-react';

export default function GlobalLoading() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="relative flex flex-col items-center space-y-4">
        <div className="absolute inset-0 bg-primary/20 blur-[50px] rounded-full w-32 h-32 mx-auto animate-pulse" />
        <div className="relative w-16 h-16 flex items-center justify-center rounded-2xl bg-gradient-to-br from-primary/80 to-primary shadow-xl border border-white/10 animate-pulse">
          <Shield className="w-8 h-8 text-white" />
        </div>
        <div className="flex items-center space-x-1">
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.3s]" />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce [animation-delay:-0.15s]" />
          <div className="w-2 h-2 bg-primary rounded-full animate-bounce" />
        </div>
      </div>
    </div>
  );
}
