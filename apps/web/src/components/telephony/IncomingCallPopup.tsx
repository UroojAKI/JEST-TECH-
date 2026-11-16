'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { PhoneIncoming, X } from 'lucide-react';
import { useAuthStore } from '../../store/auth-store';
import { telephonyRepository } from '../../repositories/telephony.repository';

const IVR_OPTION_LABELS: Record<string, string> = {
  '1': 'Policy renewal',
  '2': 'New policy',
  '3': 'Claims',
  '0': 'Speak to team',
};

/**
 * Shows a pop-up when a customer's call is ringing on the logged-in
 * agent's phone (incoming call through the Exotel IVR).
 */
export function IncomingCallPopup() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const [dismissed, setDismissed] = useState<string[]>([]);

  const { data: calls = [] } = useQuery({
    queryKey: ['incoming-calls'],
    queryFn: () => telephonyRepository.getActiveIncomingCalls(),
    enabled: isAuthenticated,
    refetchInterval: 4000,
    refetchIntervalInBackground: true,
    retry: false,
  });

  const visible = calls.filter((c) => !dismissed.includes(c.id));
  if (!isAuthenticated || visible.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] space-y-3 w-[calc(100%-2rem)] max-w-sm">
      {visible.map((call) => (
        <div
          key={call.id}
          role="alert"
          className="rounded-2xl border border-emerald-500/40 bg-card shadow-xl p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center space-x-3 min-w-0">
              <div className="h-10 w-10 shrink-0 rounded-full bg-emerald-500/15 flex items-center justify-center animate-pulse">
                <PhoneIncoming className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                  Incoming call
                </p>
                <p className="text-sm font-bold text-foreground truncate">
                  {call.lead?.customerName || 'Unknown caller'}
                </p>
                <p className="text-xs text-muted-foreground truncate">
                  {call.fromNumber || 'Number hidden'}
                  {call.lead ? ` · ${call.lead.leadCode}` : ' · not in CRM'}
                </p>
              </div>
            </div>
            <button
              onClick={() => setDismissed((d) => [...d, call.id])}
              className="p-1 rounded-lg text-muted-foreground hover:bg-accent"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {call.ivrOption && (
            <p className="text-xs">
              Pressed <strong>{call.ivrOption}</strong>
              {IVR_OPTION_LABELS[call.ivrOption] ? ` – ${IVR_OPTION_LABELS[call.ivrOption]}` : ''}
            </p>
          )}

          {call.lead ? (
            <Link
              href={`/workspace/sales/leads/${call.lead.id}`}
              onClick={() => setDismissed((d) => [...d, call.id])}
              className="block text-center px-3 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700"
            >
              Open lead
            </Link>
          ) : (
            <p className="text-[11px] text-muted-foreground">
              This number isn&apos;t linked to any lead yet.
            </p>
          )}
        </div>
      ))}
    </div>
  );
}
