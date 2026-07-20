'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore, Role } from '@/store/auth';
import { Shield, Key, Mail, Sparkles } from 'lucide-react';

import { api } from '@/lib/api';

const QUICK_PROFILES = [
  { email: 'superadmin@jest.com', role: 'SUPER_ADMIN' as Role, label: 'Super Admin', color: 'from-pink-500 to-rose-500' },
  { email: 'admin@jest.com', role: 'ADMIN' as Role, label: 'Admin', color: 'from-amber-500 to-orange-500' },
  { email: 'manager@jest.com', role: 'BRANCH_MANAGER' as Role, label: 'Manager', color: 'from-emerald-500 to-teal-500' },
  { email: 'agent@jest.com', role: 'SALES_AGENT' as Role, label: 'Sales Agent', color: 'from-indigo-500 to-blue-500' },
];

export default function LoginPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { email, password });
      setAuth(response.data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  const handleQuickLogin = async (profile: typeof QUICK_PROFILES[0]) => {
    setEmail(profile.email);
    setPassword('Password123!');
    setLoading(true);
    setError('');

    try {
      const response = await api.post('/auth/login', { email: profile.email, password: 'Password123!' });
      setAuth(response.data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.message || 'Invalid email or password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-slate-950 p-6">
      {/* Dynamic Animated Gradient Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-950/40 via-slate-950 to-violet-950/40 animate-gradient-bg" />
      <div className="absolute -top-40 -left-40 h-96 w-96 rounded-full bg-indigo-500/10 blur-[128px]" />
      <div className="absolute -bottom-40 -right-40 h-96 w-96 rounded-full bg-violet-500/10 blur-[128px]" />

      {/* Main Glassmorphism Card */}
      <div className="glass relative z-10 w-full max-w-md rounded-2xl p-8 shadow-2xl transition-all duration-300 hover:shadow-indigo-500/10">
        <div className="mb-8 text-center">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-tr from-indigo-500 to-violet-500 text-white shadow-lg mb-4">
            <Shield className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white flex items-center justify-center gap-2">
            JEST Platform <Sparkles className="h-4 w-4 text-indigo-400" />
          </h1>
          <p className="mt-2 text-sm text-slate-400">Modular Insurance Infrastructure</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          <div className="space-y-2">
            <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Email Address</label>
            <div className="relative">
              <Mail className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@jestpolicy.com"
                className="w-full rounded-lg bg-slate-900/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 border border-slate-800 focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-slate-400">Password</label>
            <div className="relative">
              <Key className="absolute left-3 top-3 h-5 w-5 text-slate-500" />
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full rounded-lg bg-slate-900/60 py-2.5 pl-10 pr-4 text-sm text-white placeholder-slate-500 border border-slate-800 focus:border-indigo-500 focus:outline-none transition-colors"
              />
            </div>
          </div>

          {error && <p className="text-xs text-rose-400 text-center">{error}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-gradient-to-r from-indigo-500 to-violet-500 py-3 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 hover:from-indigo-600 hover:to-violet-600 transition-all focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-slate-950 disabled:opacity-50"
          >
            {loading ? 'Authenticating...' : 'Sign In'}
          </button>
        </form>

        {/* Quick Access panel */}
        <div className="mt-8 border-t border-slate-900 pt-6">
          <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider text-center mb-4">Quick Testing Access</p>
          <div className="grid grid-cols-2 gap-3">
            {QUICK_PROFILES.map((p) => (
              <button
                key={p.role}
                onClick={() => handleQuickLogin(p)}
                disabled={loading}
                className="flex flex-col items-center justify-center rounded-lg border border-slate-900 bg-slate-950/40 p-3 hover:border-slate-800 hover:bg-slate-900/40 transition-all text-left"
              >
                <span className="text-xs font-bold text-white">{p.label}</span>
                <span className="text-[10px] text-slate-500 truncate w-full text-center">{p.email}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
