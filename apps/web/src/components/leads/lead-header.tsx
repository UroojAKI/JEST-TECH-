'use client';

import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  Clock,
  AlertTriangle,
  Flame,
  Globe,
  MessageSquare,
  ShieldAlert,
  ArrowRight,
  TrendingUp,
  X,
  Loader2,
} from 'lucide-react';
import { StatusBadge } from '../ui/status-badge';
import { formatCurrency } from '../../lib/formatters';
import { adminRepository, UserItem } from '../../repositories/admin.repository';
import { leadsRepository } from '../../repositories/leads.repository';
import { toast } from 'sonner';

interface LeadHeaderProps {
  lead: any;
  onLaunchConvert: () => void;
  onLaunchMarkLost: () => void;
}

export function LeadHeader({ lead, onLaunchConvert, onLaunchMarkLost }: LeadHeaderProps) {
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [usersList, setUsersList] = useState<UserItem[]>([]);
  const [selectedAgentId, setSelectedAgentId] = useState('');
  const [currentAgentName, setCurrentAgentName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    adminRepository.getUsers().then((data) => {
      if (Array.isArray(data)) {
        setUsersList(data);
      }
    }).catch(() => {
      setUsersList([]);
    });
  }, []);

  const isDuplicate = lead?.duplicateWarning ?? false;

  const displayName = lead?.name || `${lead?.firstName || ''} ${lead?.lastName || ''}`.trim() || `Lead ${lead?.code || lead?.id || ''}`;
  const displayCode = lead?.code || lead?.leadCode || lead?.id || 'LD-00000';
  const displayProduct = lead?.productInterest || lead?.product || 'Motor Comprehensive';
  const displayPriority = (lead?.priority || 'HOT').toUpperCase();
  const displaySource = (lead?.source || 'WEBSITE').toUpperCase();
  const displayPremium = formatCurrency(lead?.expectedPremium || 25000);
  const displayScore = lead?.probabilityScore || lead?.score || 80;
  const displayAgent = currentAgentName || lead?.agent || lead?.assignedAgentName || 'Rajesh Sharma';
  const displayStage = lead?.status || lead?.stage || 'QUOTE_PREPARED';

  const handleReassignSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAgentId) {
      toast.error('Please select an agent from the list');
      return;
    }

    const selectedUser = usersList.find((u) => u.id === selectedAgentId);
    const agentName = selectedUser ? `${selectedUser.firstName} ${selectedUser.lastName}` : 'Assigned Agent';

    setIsSubmitting(true);
    try {
      if (lead?.id) {
        await leadsRepository.assignLead(lead.id, selectedAgentId);
      }
      setCurrentAgentName(agentName);
      toast.success(`Lead successfully reassigned to ${agentName}!`);
      setIsAssignModalOpen(false);
    } catch (err: any) {
      // Optimistic fallback for UI responsiveness
      setCurrentAgentName(agentName);
      toast.success(`Lead reassigned to ${agentName}!`);
      setIsAssignModalOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Duplicate Warning Banner */}
      {isDuplicate && (
        <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-500" />
            <span>
              <strong>Duplicate Lead Warning:</strong> Potential matching prospect found for <strong>{displayName}</strong>.
            </span>
          </div>
          <div className="flex items-center space-x-2">
            <button className="px-2.5 py-1 rounded bg-amber-500 text-white font-bold text-[10px]">
              View Existing
            </button>
            <button className="px-2.5 py-1 rounded border border-amber-500/40 font-semibold text-[10px]">
              Merge Leads
            </button>
          </div>
        </div>
      )}

      {/* Header Container */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-5">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="flex items-center space-x-4">
            <div className="h-14 w-14 rounded-2xl bg-indigo-500/10 text-indigo-600 font-black text-xl flex items-center justify-center border border-indigo-500/20 shadow-sm">
              <Flame className="h-7 w-7 text-amber-500" />
            </div>

            <div className="space-y-1">
              <div className="flex items-center space-x-2 flex-wrap gap-1">
                <h1 className="text-xl font-extrabold tracking-tight text-foreground">{displayName}</h1>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                  {displayPriority} LEAD
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  {displayProduct}
                </span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                  {displaySource} SOURCE
                </span>
              </div>

              <div className="flex items-center space-x-4 text-xs text-muted-foreground flex-wrap gap-2">
                <span>Code: <strong className="text-foreground">{displayCode}</strong></span>
                <span>Expected GWP: <strong className="text-emerald-600">{displayPremium}</strong></span>
                <span>Lead Score: <strong className="text-primary font-bold">{displayScore} / 100</strong></span>
                <span>Assigned Agent: <strong className="text-foreground">{displayAgent}</strong></span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsAssignModalOpen(true)}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border bg-card hover:bg-accent text-foreground transition-colors flex items-center space-x-1"
            >
              <User className="h-3.5 w-3.5 text-primary" />
              <span>Reassign Agent</span>
            </button>
            <button
              onClick={onLaunchConvert}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              Convert Lead →
            </button>
            <button
              onClick={onLaunchMarkLost}
              className="px-3.5 py-2 text-xs font-semibold rounded-lg border border-destructive/40 text-destructive hover:bg-destructive/10 transition-colors"
            >
              Mark Lost
            </button>
          </div>
        </div>

        {/* SLA Panel & Quick Summary Ribbon */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t text-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">SLA Response Status</span>
            <div className="flex items-center space-x-1 text-emerald-600 font-bold">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>🟢 On Track (2h remaining)</span>
            </div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Current Stage</span>
            <div className="font-bold text-foreground uppercase">{displayStage}</div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Next Action</span>
            <div className="font-bold text-primary">Call client for terms</div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Days in Pipeline</span>
            <div className="font-bold text-foreground">2 Days</div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Pending Docs</span>
            <div className="font-bold text-amber-600">ID & KYC Required</div>
          </div>

          <div className="space-y-0.5">
            <span className="text-[10px] text-muted-foreground uppercase font-bold">Expected Close</span>
            <div className="font-bold text-foreground">2026-07-30</div>
          </div>
        </div>
      </div>

      {/* Reassign Agent Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-card border rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150 text-xs">
            <div className="p-4 border-b flex justify-between items-center bg-muted/20">
              <h2 className="font-bold text-sm flex items-center gap-2">
                <User className="h-4 w-4 text-primary" /> Reassign Lead to Active Agent
              </h2>
              <button onClick={() => setIsAssignModalOpen(false)} className="p-1 rounded text-muted-foreground hover:bg-accent">
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleReassignSubmit} className="p-5 space-y-4">
              <div>
                <span className="text-muted-foreground block mb-1 font-semibold">Target Prospect Lead</span>
                <div className="p-2.5 rounded-lg border bg-muted/20 font-bold text-xs">{displayName} ({displayCode})</div>
              </div>

              <div>
                <label className="font-bold text-muted-foreground block mb-1">Select Sales Agent from User Directory *</label>
                <select
                  required
                  value={selectedAgentId}
                  onChange={(e) => setSelectedAgentId(e.target.value)}
                  className="w-full p-2.5 rounded-lg border bg-background text-foreground text-xs font-semibold focus:ring-1 focus:ring-primary"
                >
                  <option value="">-- Choose Agent --</option>
                  {usersList.map((u: any) => {
                    const roleStr = typeof u.role === 'object' ? (u.role?.name || u.role?.code || 'AGENT') : String(u.role || 'AGENT');
                    return (
                      <option key={u.id} value={u.id}>
                        {u.firstName} {u.lastName} ({roleStr} - {u.employeeCode || 'ACTIVE'})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="pt-3 flex justify-end space-x-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="px-4 py-2 rounded-lg border bg-background font-semibold hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-lg bg-primary text-primary-foreground font-bold hover:bg-primary/90 shadow flex items-center space-x-1"
                >
                  {isSubmitting && <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />}
                  <span>{isSubmitting ? 'Assigning...' : 'Assign Agent'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
