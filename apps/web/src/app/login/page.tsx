'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import { Shield, Key, Mail, Sparkles } from 'lucide-react';

const QUICK_PROFILES = [
  { email: 'superadmin@jest.com', label: 'Super Admin' },
  { email: 'admin@jest.com', label: 'Admin' },
];

export default function LoginPage() {
  const { login, isLoggingIn, loginError } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    login({ email, password });
  };

  const handleQuickLogin = (email: string) => {
    setEmail(email);
    setPassword('Password@123');
    login({ email, password: 'Password@123' });
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-background p-6">
      <div className="relative z-10 w-full max-w-md rounded-2xl border bg-card p-8 shadow-2xl">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-lg mb-4">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center justify-center gap-2">
            JEST Platform <Sparkles className="h-4 w-4 text-primary" />
          </h1>
          <p className="mt-2 text-xs text-muted-foreground">Enterprise Insurance Infrastructure</p>
        </div>

        {loginError && (
          <div className="mb-4 rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-xs text-destructive font-semibold flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0" />
            <span>{loginError}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">

          <div className="space-y-1.5">
            <label htmlFor="email" className="text-xs font-semibold uppercase text-muted-foreground">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@jest.com"
                className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <label htmlFor="password" className="text-xs font-semibold uppercase text-muted-foreground">Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg border bg-background py-2 pl-9 pr-3 text-xs focus:outline-none focus:ring-1 focus:ring-primary"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoggingIn}
            className="w-full rounded-lg bg-primary py-2.5 text-xs font-bold text-primary-foreground shadow hover:bg-primary/90 transition-all disabled:opacity-50 mt-2"
          >
            {isLoggingIn ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        <div className="mt-8 border-t pt-6">
          <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider text-center mb-3">Quick Testing Access</p>
          <div className="grid grid-cols-2 gap-2">
            {QUICK_PROFILES.map((p) => (
              <button
                key={p.email}
                onClick={() => handleQuickLogin(p.email)}
                disabled={isLoggingIn}
                className="p-2.5 rounded-lg border text-left hover:bg-accent text-xs transition-colors"
              >
                <div className="font-bold">{p.label}</div>
                <div className="text-[10px] text-muted-foreground truncate">{p.email}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
