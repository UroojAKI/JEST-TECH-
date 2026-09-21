'use client';

import React, { useState, useEffect } from 'react';
import { UserCheck, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { apiClient } from '../../lib/api-client';

export interface AgentOption {
  id: string;
  agentCode: string;
  isActive: boolean;
  user?: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };
}

interface Props {
  value?: string | null;
  onChange?: (agentId: string, agentCode: string) => void;
  readOnly?: boolean;
  className?: string;
  label?: string;
  required?: boolean;
}

export function AgentSelector({
  value,
  onChange,
  readOnly = false,
  className = '',
  label = 'Assigned Agent',
  required = false,
}: Props) {
  const [agents, setAgents] = useState<AgentOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadAgents() {
      try {
        setLoading(true);
        const res = await apiClient.get('/agents');
        const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
        if (isMounted) {
          setAgents(data);
          setError(null);
        }
      } catch (err: any) {
        if (isMounted) {
          setError('Failed to load agents list');
          console.error('AgentSelector fetch error:', err);
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }
    loadAgents();
    return () => {
      isMounted = false;
    };
  }, []);

  const selectedAgent = agents.find((a) => a.id === value);

  if (readOnly) {
    return (
      <div className={`space-y-1.5 ${className}`}>
        {label && (
          <label className="text-xs font-semibold text-muted-foreground">
            {label}
          </label>
        )}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-muted/30 text-sm">
          <Shield className="h-4 w-4 text-primary shrink-0" />
          <span className="font-mono font-bold text-xs bg-primary/10 text-primary px-2 py-0.5 rounded">
            {selectedAgent?.agentCode || 'AGT-SYSTEM'}
          </span>
          <span className="text-foreground font-medium truncate">
            {selectedAgent?.user
              ? `${selectedAgent.user.firstName} ${selectedAgent.user.lastName}`
              : 'Direct / System Assigned'}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="text-xs font-semibold text-foreground flex items-center justify-between">
          <span>
            {label} {required && <span className="text-rose-500">*</span>}
          </span>
          {selectedAgent && (
            <span className="text-[10px] font-mono text-muted-foreground">
              Code: {selectedAgent.agentCode}
            </span>
          )}
        </label>
      )}

      {loading ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border bg-card text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span>Loading agents...</span>
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg border border-rose-500/30 bg-rose-500/10 text-xs text-rose-600">
          <AlertCircle className="h-3.5 w-3.5" />
          <span>{error}</span>
        </div>
      ) : (
        <div className="relative">
          <select
            value={value || ''}
            onChange={(e) => {
              const chosen = agents.find((a) => a.id === e.target.value);
              if (chosen && onChange) {
                onChange(chosen.id, chosen.agentCode);
              } else if (!e.target.value && onChange) {
                onChange('', '');
              }
            }}
            className="w-full text-xs rounded-lg border border-input bg-card px-3 py-2 pr-8 text-foreground shadow-xs focus:border-primary focus:outline-hidden focus:ring-1 focus:ring-primary appearance-none cursor-pointer"
          >
            <option value="">-- Select Authoritative Agent --</option>
            {agents
              .filter((a) => a.isActive !== false)
              .map((agent) => {
                const name = agent.user
                  ? `${agent.user.firstName} ${agent.user.lastName}`
                  : 'Agent';
                return (
                  <option key={agent.id} value={agent.id}>
                    [{agent.agentCode}] {name} {agent.user?.phone ? `• ${agent.user.phone}` : ''}
                  </option>
                );
              })}
          </select>
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none text-muted-foreground">
            <UserCheck className="h-4 w-4" />
          </div>
        </div>
      )}
    </div>
  );
}
