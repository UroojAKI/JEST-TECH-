'use client';

import React, { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Phone, PhoneMissed, PhoneOff, Play, RefreshCw, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { telephonyRepository, CallHistoryItem } from '../../repositories/telephony.repository';

const OUTCOME_STYLES: Record<string, { label: string; className: string }> = {
  CONNECTED: { label: 'Connected', className: 'bg-emerald-500/10 text-emerald-700 border-emerald-500/30' },
  NO_ANSWER: { label: 'No answer', className: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  BUSY: { label: 'Busy', className: 'bg-amber-500/10 text-amber-700 border-amber-500/30' },
  FAILED: { label: 'Failed', className: 'bg-rose-500/10 text-rose-700 border-rose-500/30' },
  INITIATED: { label: 'In progress', className: 'bg-blue-500/10 text-blue-700 border-blue-500/30' },
};

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

function OutcomeIcon({ outcome }: { outcome: string }) {
  if (outcome === 'CONNECTED') return <Phone className="h-4 w-4 text-emerald-600" />;
  if (outcome === 'FAILED') return <PhoneOff className="h-4 w-4 text-rose-600" />;
  if (outcome === 'INITIATED') return <Clock className="h-4 w-4 text-blue-600" />;
  return <PhoneMissed className="h-4 w-4 text-amber-600" />;
}

/** Plays one recording; downloads it only when the user presses Play */
function RecordingPlayer({ callId }: { callId: string }) {
  const [src, setSrc] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    return () => {
      if (src) URL.revokeObjectURL(src);
    };
  }, [src]);

  const load = async () => {
    setIsLoading(true);
    try {
      const blob = await telephonyRepository.getRecordingBlob(callId);
      setSrc(URL.createObjectURL(blob));
    } catch {
      toast.error('Could not load the recording. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  if (src) {
    return <audio controls autoPlay src={src} className="h-8 w-full max-w-xs" />;
  }
  return (
    <button
      onClick={load}
      disabled={isLoading}
      className="px-3 py-1.5 rounded-lg border bg-card hover:bg-accent text-xs font-bold flex items-center space-x-1.5 disabled:opacity-50"
    >
      {isLoading ? <RefreshCw className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5 text-primary" />}
      <span>{isLoading ? 'Loading…' : 'Play recording'}</span>
    </button>
  );
}

export function CallHistoryPanel({ leadId }: { leadId: string }) {
  const { data: calls = [], isLoading, isError, refetch, isFetching } = useQuery({
    queryKey: ['lead-calls', leadId],
    queryFn: () => telephonyRepository.listLeadCalls(leadId),
    enabled: !!leadId,
    // Keep checking while a call is still in progress
    refetchInterval: (query) =>
      (query.state.data as CallHistoryItem[] | undefined)?.some((c) => c.callOutcome === 'INITIATED')
        ? 10000
        : false,
  });

  return (
    <div className="p-5 rounded-2xl border bg-card space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">
          Call History
        </h3>
        <button
          onClick={() => refetch()}
          className="p-1.5 rounded-lg hover:bg-accent text-muted-foreground"
          title="Refresh"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isFetching ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {isLoading && <p className="text-xs text-muted-foreground">Loading calls…</p>}
      {isError && <p className="text-xs text-rose-600">Could not load call history.</p>}
      {!isLoading && !isError && calls.length === 0 && (
        <p className="text-xs text-muted-foreground">No calls yet. Use the green Call button above to call this customer.</p>
      )}

      <div className="space-y-2">
        {calls.map((call) => {
          const isIncoming = call.callType === 'INBOUND';
          const baseStyle = OUTCOME_STYLES[call.callOutcome] || {
            label: call.callOutcome.replace(/_/g, ' '),
            className: 'bg-muted text-foreground border-border',
          };
          const style =
            isIncoming && call.callOutcome === 'NO_ANSWER'
              ? { ...baseStyle, label: 'Missed' }
              : baseStyle;
          return (
            <div
              key={call.id}
              className="p-3 rounded-xl border flex flex-col sm:flex-row sm:items-center gap-3 justify-between"
            >
              <div className="flex items-start space-x-3 min-w-0">
                <div className="mt-0.5">
                  <OutcomeIcon outcome={call.callOutcome} />
                </div>
                <div className="min-w-0 space-y-0.5">
                  <div className="flex items-center flex-wrap gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${style.className}`}>
                      {style.label}
                    </span>
                    <span className="text-xs font-semibold text-foreground">
                      {new Date(call.createdAt).toLocaleString('en-IN', {
                        day: '2-digit',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                    {call.durationSeconds > 0 && (
                      <span className="text-xs text-muted-foreground">· {formatDuration(call.durationSeconds)}</span>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground truncate">
                    {isIncoming ? (
                      <>
                        Incoming from {call.fromNumber || 'unknown number'}
                        {call.agentName !== 'No agent' ? ` → answered by ${call.agentName}` : ''}
                        {call.ivrOption ? ` · pressed ${call.ivrOption}` : ''}
                      </>
                    ) : (
                      <>
                        {call.agentName}
                        {call.toNumber ? ` → ${call.toNumber}` : ''}
                      </>
                    )}
                    {call.provider === 'EXOTEL' ? ' · via Exotel' : ' · logged manually'}
                  </p>
                  {call.notes && <p className="text-[11px] text-foreground">{call.notes}</p>}
                </div>
              </div>
              {call.hasRecording && <RecordingPlayer callId={call.id} />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
