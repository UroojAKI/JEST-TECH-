'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  Loader2,
  RefreshCw,
  ShieldCheck,
  Clock,
  UserCheck,
  Car,
  FileCheck2,
  CreditCard,
  AlertTriangle,
} from 'lucide-react';
import { toast } from 'sonner';
import { policiesRepository } from '../../repositories/policies.repository';
import { UpdatePolicyDetailsDialog } from '../leads/motor-quote/UpdatePolicyDetailsDialog';

export interface GateStatus {
  passed: boolean;
  status: string;
  detail: string;
}

export interface BackOfficeQueueItem {
  id: string;
  quotationCode: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  salesAgentName: string;
  productType: string;
  insurerName: string;
  totalPremium: number;
  paymentAmount: number;
  paymentReference?: string;
  createdAt: string;
  slaRemainingHours: number;
  slaStatus: 'CRITICAL' | 'WARNING' | 'ON_TRACK';
  gates: {
    customer: GateStatus;
    vehicle: GateStatus;
    inspection: GateStatus;
    payment: GateStatus;
    documents: GateStatus;
  };
  allGatesPassed: boolean;
  nextAction: string;
}

export function MotorIssuanceQueue() {
  const [queue, setQueue] = useState<BackOfficeQueueItem[]>([]);
  const [summary, setSummary] = useState<{
    totalPending: number;
    readyCount: number;
    blockedCount: number;
    issuedCount: number;
  }>({ totalPending: 0, readyCount: 0, blockedCount: 0, issuedCount: 0 });
  const [loading, setLoading] = useState(true);
  const [issuingId, setIssuingId] = useState<string | null>(null);
  const [selectedQuote, setSelectedQuote] = useState<string | null>(null);

  const loadQueue = async () => {
    setLoading(true);
    try {
      const res = await policiesRepository.getBackOfficeQueue();
      setQueue(res.data || []);
      if (res.summary) setSummary(res.summary);
    } catch (error: any) {
      console.error(error);
      toast.error('Unable to load Back-Office policy issuance queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadQueue();
  }, []);

  const handleDirectIssue = async (quotationId: string) => {
    setIssuingId(quotationId);
    try {
      const res = await policiesRepository.issueFromQueue(quotationId);
      toast.success(res.message || 'Policy issued successfully!');
      await loadQueue();
    } catch (error: any) {
      const errMsg =
        error.response?.data?.message ||
        error.message ||
        'Failed to issue policy';
      toast.error(errMsg);
    } finally {
      setIssuingId(null);
    }
  };

  return (
    <div className="space-y-5">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Back-Office Policy Issuance Workbench (G021)</h1>
          <p className="text-xs text-muted-foreground">
            Multi-gate issuance validator enforcing Customer KYC, Vehicle Integrity, Break-in Inspection & Payment Clearance.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => void loadQueue()}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card hover:bg-accent text-xs font-semibold shadow-sm transition"
          >
            {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            <span>Refresh Queue</span>
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-3.5 rounded-xl border bg-emerald-500/5 border-emerald-500/20 space-y-1">
          <div className="text-[10px] uppercase font-bold text-emerald-600">Ready to Issue (All Gates Passed)</div>
          <div className="text-2xl font-black text-emerald-700">{summary.readyCount}</div>
        </div>
        <div className="p-3.5 rounded-xl border bg-amber-500/5 border-amber-500/20 space-y-1">
          <div className="text-[10px] uppercase font-bold text-amber-600">Blocked by Stage Gates</div>
          <div className="text-2xl font-black text-amber-700">{summary.blockedCount}</div>
        </div>
        <div className="p-3.5 rounded-xl border bg-blue-500/5 border-blue-500/20 space-y-1">
          <div className="text-[10px] uppercase font-bold text-blue-600">Total In Queue</div>
          <div className="text-2xl font-black text-blue-700">{queue.length}</div>
        </div>
      </div>

      {/* Queue Listing */}
      {queue.length === 0 && !loading ? (
        <div className="rounded-xl border bg-card p-10 text-center space-y-2">
          <ShieldCheck className="h-10 w-10 mx-auto text-muted-foreground" />
          <h3 className="font-bold text-base">Back-Office Issuance Queue is Empty</h3>
          <p className="text-xs text-muted-foreground max-w-md mx-auto">
            All customer quotations have been processed or are awaiting payment clearance.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {queue.map((item) => (
            <div
              key={item.id}
              className={`rounded-xl border bg-card p-4 transition-all shadow-sm ${
                item.allGatesPassed ? 'border-emerald-500/40 bg-emerald-500/[0.02]' : 'border-border'
              }`}
            >
              <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                {/* Primary Info */}
                <div className="space-y-1.5">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-bold text-base text-foreground font-mono">{item.quotationCode}</span>
                    <span className="text-xs font-semibold text-muted-foreground">• {item.customerName}</span>
                    {item.allGatesPassed ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
                        READY TO ISSUE
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                        GATES BLOCKED
                      </span>
                    )}

                    {/* SLA Badge */}
                    <span
                      className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        item.slaStatus === 'CRITICAL'
                          ? 'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300'
                          : item.slaStatus === 'WARNING'
                            ? 'bg-amber-100 text-amber-700 dark:bg-amber-950 dark:text-amber-300'
                            : 'bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300'
                      }`}
                    >
                      <Clock className="h-3 w-3" />
                      SLA: {item.slaRemainingHours}h Left
                    </span>
                  </div>

                  <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                    <span>Product: <strong>{item.productType}</strong></span>
                    <span>Insurer: <strong>{item.insurerName}</strong></span>
                    <span>Agent: <strong>{item.salesAgentName}</strong></span>
                    <span>Premium: <strong className="text-foreground font-mono">₹{item.totalPremium.toLocaleString('en-IN')}</strong></span>
                  </div>

                  {/* Multi-Gate Checklist Chips */}
                  <div className="pt-2 flex items-center gap-2 flex-wrap text-xs">
                    {/* Customer Gate */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${
                        item.gates.customer.passed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                      }`}
                      title={item.gates.customer.detail}
                    >
                      <UserCheck className="h-3.5 w-3.5" />
                      <span>Customer KYC: {item.gates.customer.status}</span>
                    </div>

                    {/* Vehicle Gate */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${
                        item.gates.vehicle.passed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                      }`}
                      title={item.gates.vehicle.detail}
                    >
                      <Car className="h-3.5 w-3.5" />
                      <span>Vehicle Specs: {item.gates.vehicle.status}</span>
                    </div>

                    {/* Inspection Gate */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${
                        item.gates.inspection.passed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                      }`}
                      title={item.gates.inspection.detail}
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      <span>Inspection: {item.gates.inspection.status}</span>
                    </div>

                    {/* Payment Gate */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${
                        item.gates.payment.passed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'
                      }`}
                      title={item.gates.payment.detail}
                    >
                      <CreditCard className="h-3.5 w-3.5" />
                      <span>Payment: {item.gates.payment.status}</span>
                    </div>

                    {/* Documents Gate */}
                    <div
                      className={`flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${
                        item.gates.documents.passed
                          ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300'
                          : 'bg-amber-500/10 border-amber-500/30 text-amber-700 dark:text-amber-300'
                      }`}
                      title={item.gates.documents.detail}
                    >
                      <FileCheck2 className="h-3.5 w-3.5" />
                      <span>Docs (G017): {item.gates.documents.status}</span>
                    </div>
                  </div>

                  {/* Next Action Recommendation */}
                  <div className="pt-1 text-[11px] text-muted-foreground flex items-center gap-1.5">
                    <span className="font-semibold text-foreground">Next Action:</span>
                    <span>{item.nextAction}</span>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-row lg:flex-col items-end gap-2 shrink-0">
                  {item.allGatesPassed ? (
                    <button
                      type="button"
                      disabled={issuingId === item.id}
                      onClick={() => handleDirectIssue(item.id)}
                      className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold shadow-sm transition"
                    >
                      {issuingId === item.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      <span>1-Click Issue Policy</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={() => setSelectedQuote(item.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border bg-card hover:bg-accent text-xs font-semibold transition"
                  >
                    <span>Manual Policy Entry</span>
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {selectedQuote && (
        <UpdatePolicyDetailsDialog
          isOpen={Boolean(selectedQuote)}
          quotationId={selectedQuote}
          onClose={() => setSelectedQuote(null)}
          onSaved={() => {
            setSelectedQuote(null);
            toast.success('Policy issued successfully');
            void loadQueue();
          }}
        />
      )}
    </div>
  );
}
