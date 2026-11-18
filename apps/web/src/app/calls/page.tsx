'use client';

import React, { useEffect, useState } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { PhoneCall, RefreshCw, Search } from 'lucide-react';
import { AppShell } from '../../components/layout/app-shell';
import { CallRow } from '../../components/telephony/CallHistoryPanel';
import { telephonyRepository, CallLogFilters } from '../../repositories/telephony.repository';

const TYPE_OPTIONS: { value: NonNullable<CallLogFilters['type']>; label: string }[] = [
  { value: '', label: 'All calls' },
  { value: 'INBOUND', label: 'Incoming' },
  { value: 'OUTBOUND', label: 'Outgoing' },
];

const RESULT_OPTIONS: { value: NonNullable<CallLogFilters['result']>; label: string }[] = [
  { value: '', label: 'Any result' },
  { value: 'connected', label: 'Connected' },
  { value: 'not_connected', label: 'Missed / not connected' },
];

/**
 * Call Logs: every Exotel call the user may see, including incoming calls
 * from numbers that are not in the CRM yet. Admin and back office see the
 * whole company; agents see their own calls.
 */
export default function CallLogsPage() {
  const [type, setType] = useState<CallLogFilters['type']>('');
  const [result, setResult] = useState<CallLogFilters['result']>('');
  const [phoneInput, setPhoneInput] = useState('');
  const [phone, setPhone] = useState('');
  const [page, setPage] = useState(1);

  // Search only after the user stops typing
  useEffect(() => {
    const t = setTimeout(() => setPhone(phoneInput), 400);
    return () => clearTimeout(t);
  }, [phoneInput]);

  // Any filter change starts again from page 1
  useEffect(() => {
    setPage(1);
  }, [type, result, phone]);

  const { data, isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['call-logs', type, result, phone, page],
    queryFn: () => telephonyRepository.listCalls({ type, result, phone, page }),
    placeholderData: keepPreviousData,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const pageSize = data?.pageSize ?? 25;
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 rounded-xl bg-primary/10">
              <PhoneCall className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-foreground">Call Logs</h1>
              <p className="text-xs text-muted-foreground">
                All incoming and outgoing calls with recordings, including callers not yet in the CRM.
              </p>
            </div>
          </div>
          <button
            onClick={() => refetch()}
            className="px-3 py-2 rounded-xl border bg-card hover:bg-accent text-xs font-bold flex items-center space-x-1.5"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              value={phoneInput}
              onChange={(e) => setPhoneInput(e.target.value)}
              placeholder="Search by phone number…"
              inputMode="tel"
              className="w-full pl-9 pr-3 py-2 rounded-xl border bg-card text-sm"
            />
          </div>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CallLogFilters['type'])}
            className="px-3 py-2 rounded-xl border bg-card text-sm"
            aria-label="Call direction"
          >
            {TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <select
            value={result}
            onChange={(e) => setResult(e.target.value as CallLogFilters['result'])}
            className="px-3 py-2 rounded-xl border bg-card text-sm"
            aria-label="Call result"
          >
            {RESULT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <span className="text-xs text-muted-foreground sm:ml-auto">
            {total} call{total === 1 ? '' : 's'}
          </span>
        </div>

        <div className="p-5 rounded-2xl border bg-card space-y-2">
          {isLoading && <p className="text-xs text-muted-foreground">Loading calls…</p>}
          {isError && <p className="text-xs text-rose-600">Could not load calls. Please refresh.</p>}
          {!isLoading && !isError && items.length === 0 && (
            <p className="text-xs text-muted-foreground">No calls match these filters.</p>
          )}
          {items.map((call) => (
            <CallRow key={call.id} call={call} lead={call.lead} />
          ))}
        </div>

        {lastPage > 1 && (
          <div className="flex items-center justify-center gap-3">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="px-3 py-1.5 rounded-lg border bg-card text-xs font-bold disabled:opacity-40"
            >
              Previous
            </button>
            <span className="text-xs text-muted-foreground">
              Page {page} of {lastPage}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
              disabled={page >= lastPage}
              className="px-3 py-1.5 rounded-lg border bg-card text-xs font-bold disabled:opacity-40"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </AppShell>
  );
}
