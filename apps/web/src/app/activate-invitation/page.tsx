'use client';

import React, { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { apiClient } from '../../lib/api-client';
import { toast } from 'sonner';
import { KeyRound, Loader2, ShieldCheck } from 'lucide-react';

function InvitationActivationForm() {
  const params = useSearchParams();
  const router = useRouter();
  const token = params.get('token') || '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const activate = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!token || token.length < 32) {
      toast.error('This invitation link is invalid. Ask your administrator for a new invitation.');
      return;
    }
    if (password.length < 12) {
      toast.error('Use a password with at least 12 characters.');
      return;
    }
    if (password !== confirmPassword) {
      toast.error('Passwords do not match.');
      return;
    }
    setSubmitting(true);
    try {
      await apiClient.post('/auth/activate-invitation', { token, password });
      toast.success('Your account is activated. You can now sign in.');
      router.replace('/login');
    } catch (error: any) {
      toast.error(error?.response?.data?.message || 'Invitation activation failed. The link may have expired or already been used.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-muted/30 px-4 py-10">
      <form onSubmit={activate} className="w-full max-w-md space-y-5 rounded-2xl border bg-card p-7 shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary">
          <ShieldCheck className="h-6 w-6" />
        </div>
        <div>
          <h1 className="text-xl font-black">Activate your account</h1>
          <p className="mt-1 text-sm text-muted-foreground">Create a password to activate your JEST Policy CRM account. Invitation links are single-use and expire after 72 hours.</p>
        </div>
        {!token ? (
          <p role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">Invitation token is missing. Open the complete link from your invitation email.</p>
        ) : (
          <>
            <label className="block space-y-1.5 text-sm font-semibold">
              Password
              <input type="password" autoComplete="new-password" minLength={12} required value={password} onChange={(event) => setPassword(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5 font-normal" placeholder="At least 12 characters" />
            </label>
            <label className="block space-y-1.5 text-sm font-semibold">
              Confirm password
              <input type="password" autoComplete="new-password" minLength={12} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="w-full rounded-lg border bg-background px-3 py-2.5 font-normal" placeholder="Re-enter your password" />
            </label>
            <button type="submit" disabled={submitting || !password || !confirmPassword} className="flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2.5 text-sm font-bold text-primary-foreground disabled:opacity-50">
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
              Activate account
            </button>
          </>
        )}
        <p className="text-center text-xs text-muted-foreground">If this link has expired or was already used, contact your administrator for a new invitation.</p>
      </form>
    </main>
  );
}

export default function ActivateInvitationPage() {
  return <Suspense fallback={<div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Loading invitation…</div>}><InvitationActivationForm /></Suspense>;
}
