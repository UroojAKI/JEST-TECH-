'use client';

import React, { useState } from 'react';
import { useQuery, useQueryClient, useMutation } from '@tanstack/react-query';
import { quotationsRepository, QuotationCompletionResult } from '../../../repositories/quotations.repository';
import { toast } from 'sonner';
import {
  CheckCircle2,
  AlertTriangle,
  ChevronRight,
  X,
  FileCheck2,
  ShieldCheck,
  CreditCard,
  UserCheck,
  Clock,
  Car,
  FileText,
  Save,
  Loader2,
  Edit3,
} from 'lucide-react';

interface Props {
  quotationId: string;
  quotationCode?: string;
  compact?: boolean;
  onProceedToProposal?: () => void;
  onConductInspection?: () => void;
}

const SECTION_ICONS: Record<string, React.ReactNode> = {
  customer: <UserCheck className="h-4 w-4" />,
  vehicle: <Car className="h-4 w-4" />,
  coverage: <FileText className="h-4 w-4" />,
  previousPolicy: <Clock className="h-4 w-4" />,
  inspection: <ShieldCheck className="h-4 w-4" />,
  payment: <CreditCard className="h-4 w-4" />,
};

const FIELD_INPUT_CONFIG: Record<string, { label: string; placeholder: string; type?: string }> = {
  customerName: { label: 'Customer Full Name', placeholder: 'e.g. Rajesh Sharma' },
  phone: { label: 'Mobile Number', placeholder: '10-digit mobile number', type: 'tel' },
  email: { label: 'Email Address', placeholder: 'e.g. rajesh@example.com', type: 'email' },
  dateOfBirth: { label: 'Date of Birth', placeholder: 'YYYY-MM-DD', type: 'date' },
  panNumber: { label: 'PAN or Aadhaar KYC', placeholder: 'e.g. ABCDE1234F' },
  registrationNumber: { label: 'Registration Plate Number', placeholder: 'e.g. MH02AB1234' },
  engineNumber: { label: 'Engine Number', placeholder: 'e.g. ENG987654321' },
  chassisNumber: { label: 'Chassis Number / VIN', placeholder: 'e.g. MA3ER45S900123456' },
  previousPolicyNumber: { label: 'Previous Policy Number', placeholder: 'e.g. POL-PREV-2025-01' },
  previousInsurerName: { label: 'Previous Insurer Name', placeholder: 'e.g. HDFC ERGO General Insurance' },
  previousPolicyExpiryDate: { label: 'Previous Policy Expiry Date', placeholder: 'YYYY-MM-DD', type: 'date' },
};

export function QuotationCompletionView({
  quotationId,
  quotationCode,
  compact = false,
  onProceedToProposal,
  onConductInspection,
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, string>>({});
  const queryClient = useQueryClient();

  const { data: completion, isLoading, error } = useQuery<QuotationCompletionResult>({
    queryKey: ['quotation-completion', quotationId],
    queryFn: () => quotationsRepository.getQuotationCompletion(quotationId),
    enabled: !!quotationId,
    staleTime: 15000,
  });

  const updateMutation = useMutation({
    mutationFn: (details: Record<string, any>) =>
      quotationsRepository.updateQuotationDetails(quotationId, details),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['quotation-completion', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['motor-quotations-all'] });
      queryClient.invalidateQueries({ queryKey: ['motor-quotation', quotationId] });
      queryClient.invalidateQueries({ queryKey: ['quotations'] });
      toast.success('Quotation details saved and completion recalculated!');
      setEditValues({});
    },
    onError: (err: any) => {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to save quotation details');
    },
  });

  const handleFieldChange = (field: string, val: string) => {
    setEditValues((prev) => ({ ...prev, [field]: val }));
  };

  const handleSaveEdits = () => {
    const cleaned: Record<string, string> = {};
    for (const [k, v] of Object.entries(editValues)) {
      if (v && v.trim() !== '') {
        cleaned[k] = v.trim();
      }
    }
    if (Object.keys(cleaned).length === 0) {
      toast.error('Please enter at least one field to save.');
      return;
    }
    updateMutation.mutate(cleaned);
  };

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground animate-pulse">
        <div className="h-2 w-16 bg-muted rounded-full" />
        <span className="text-[10px]">Calculating...</span>
      </div>
    );
  }

  if (error || !completion) {
    return null;
  }

  const percent = completion.completionPercentage;
  const isComplete = percent === 100;
  const hasEdits = Object.values(editValues).some((v) => v && v.trim() !== '');

  const progressColor =
    percent >= 100
      ? 'bg-emerald-500'
      : percent >= 70
      ? 'bg-blue-500'
      : percent >= 40
      ? 'bg-amber-500'
      : 'bg-rose-500';

  const badgeColor =
    percent >= 100
      ? 'text-emerald-700 bg-emerald-500/10 border-emerald-300 dark:text-emerald-400 dark:border-emerald-800'
      : percent >= 70
      ? 'text-blue-700 bg-blue-500/10 border-blue-300 dark:text-blue-400 dark:border-blue-800'
      : 'text-amber-700 bg-amber-500/10 border-amber-300 dark:text-amber-400 dark:border-amber-800';

  return (
    <>
      {/* TRIGGER BADGE / BAR */}
      <div
        onClick={() => setIsOpen(true)}
        className={`cursor-pointer transition-all hover:opacity-90 ${
          compact ? 'inline-flex items-center gap-2' : 'space-y-1 w-full'
        }`}
        title="Click to view Progressive Quotation Completion Checklist (§24, AUD-033)"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            {isComplete ? (
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            ) : (
              <AlertTriangle className="h-3.5 w-3.5 text-amber-500" />
            )}
            <span
              className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md border ${badgeColor}`}
            >
              {percent}% Complete
            </span>
          </div>
          <span className="text-[10px] text-primary hover:underline font-bold flex items-center">
            {isComplete ? 'View Audit' : 'Missing Details'}
            <ChevronRight className="h-3 w-3 ml-0.5" />
          </span>
        </div>

        {/* PROGRESS TRACK */}
        <div className="w-full bg-muted/60 h-1.5 rounded-full overflow-hidden">
          <div
            className={`h-full ${progressColor} transition-all duration-500 ease-out`}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* DYNAMIC CHECKLIST MODAL */}
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs animate-in fade-in duration-200">
          <div
            className="bg-card text-card-foreground border rounded-2xl max-w-xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
            onClick={(e) => e.stopPropagation()}
          >
            {/* MODAL HEADER */}
            <div className="p-5 border-b flex items-start justify-between bg-muted/20">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileCheck2 className="h-5 w-5 text-primary" />
                  <h3 className="text-base font-black tracking-tight">
                    Quotation Completion Engine
                  </h3>
                  <span className="font-mono text-xs font-bold text-muted-foreground">
                    #{completion.quotationCode || quotationCode}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  Zero fake successes: policies cannot be issued until all criteria sections reach 100% completion. You can fill missing technical fields below and save directly.
                </p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* PROGRESS SUMMARY BANNER */}
            <div className="px-5 py-4 border-b bg-background flex items-center justify-between gap-4">
              <div className="space-y-1 flex-1">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold">Overall Readiness</span>
                  <span className="font-mono font-black text-primary">{percent}%</span>
                </div>
                <div className="w-full bg-muted h-2 rounded-full overflow-hidden">
                  <div
                    className={`h-full ${progressColor} transition-all duration-500`}
                    style={{ width: `${percent}%` }}
                  />
                </div>
              </div>
              <div className="text-right">
                <span
                  className={`text-[11px] font-black uppercase px-2.5 py-1 rounded-full border ${
                    isComplete
                      ? 'bg-emerald-500/10 text-emerald-600 border-emerald-300'
                      : 'bg-amber-500/10 text-amber-600 border-amber-300'
                  }`}
                >
                  {completion.status}
                </span>
              </div>
            </div>

            {/* SECTION LIST */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1">
              {completion.sections.map((sec) => {
                const icon = SECTION_ICONS[sec.section] || <FileText className="h-4 w-4" />;
                const isSecComplete = sec.complete;

                return (
                  <div
                    key={sec.section}
                    className={`p-4 rounded-xl border transition-all ${
                      isSecComplete
                        ? 'border-emerald-500/30 bg-emerald-500/5'
                        : 'border-amber-500/30 bg-amber-500/5'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-1.5 rounded-lg ${
                            isSecComplete
                              ? 'bg-emerald-500/20 text-emerald-700 dark:text-emerald-400'
                              : 'bg-amber-500/20 text-amber-700 dark:text-amber-400'
                          }`}
                        >
                          {icon}
                        </div>
                        <div>
                          <div className="text-xs font-bold text-foreground">{sec.label}</div>
                          <div className="text-[10px] text-muted-foreground">
                            {sec.completedCount} of {sec.applicableCount} criteria satisfied
                          </div>
                        </div>
                      </div>

                      <div>
                        {isSecComplete ? (
                          <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 uppercase bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-200">
                            <CheckCircle2 className="h-3 w-3" />
                            Complete
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-[10px] font-black text-amber-600 uppercase bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-200">
                            <AlertTriangle className="h-3 w-3" />
                            Missing ({sec.missing.length})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* INTERACTIVE MISSING FIELDS FORM (AUD-033) */}
                    {!isSecComplete && sec.missing.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-amber-500/20 space-y-2.5">
                        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground flex items-center justify-between">
                          <span>Action Required to Complete:</span>
                          <span className="text-[9px] text-primary lowercase font-medium">editable inline</span>
                        </div>
                        <div className="space-y-2">
                          {sec.missing.map((item, idx) => {
                            const config = FIELD_INPUT_CONFIG[item.field];
                            return (
                              <div
                                key={idx}
                                className="bg-card p-2.5 rounded-lg border border-border/70 space-y-1.5 shadow-2xs"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-rose-500 font-bold">•</span>
                                    <span className="font-semibold text-xs text-foreground">{item.label}</span>
                                  </div>
                                  <span
                                    className={`text-[9px] font-extrabold uppercase px-1.5 py-0.5 rounded whitespace-nowrap ${
                                      item.requiredFor === 'POLICY_ISSUANCE'
                                        ? 'bg-rose-500/10 text-rose-600'
                                        : item.requiredFor === 'APPROVAL'
                                        ? 'bg-amber-500/10 text-amber-600'
                                        : 'bg-blue-500/10 text-blue-600'
                                    }`}
                                  >
                                    {item.requiredFor.replace('_', ' ')}
                                  </span>
                                </div>

                                {config ? (
                                  <div className="pt-1">
                                    <input
                                      type={config.type || 'text'}
                                      placeholder={config.placeholder}
                                      value={editValues[item.field] ?? ''}
                                      onChange={(e) => handleFieldChange(item.field, e.target.value)}
                                      className="w-full px-2.5 py-1.5 rounded-md border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary border-border font-medium"
                                    />
                                  </div>
                                ) : item.field === 'inspection' ? (
                                  <div className="pt-1">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setIsOpen(false);
                                        onConductInspection?.();
                                      }}
                                      className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold hover:bg-amber-500/20 transition-colors flex items-center gap-1.5"
                                    >
                                      <ShieldCheck className="h-3.5 w-3.5" />
                                      Conduct Break-in / SAOD Inspection
                                    </button>
                                  </div>
                                ) : null}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* MODAL FOOTER */}
            <div className="p-4 border-t bg-muted/20 flex flex-wrap items-center justify-between gap-3">
              <div className="text-[11px] text-muted-foreground">
                {completion.canIssuePolicy ? (
                  <span className="text-emerald-600 font-bold flex items-center gap-1">
                    <CheckCircle2 className="h-3.5 w-3.5" /> Ready for final policy issuance
                  </span>
                ) : (
                  <span>
                    Approval: <strong className={completion.canApprove ? 'text-emerald-600' : 'text-amber-600'}>{completion.canApprove ? 'Allowed' : 'Blocked'}</strong>
                    {' • '}
                    Issuance: <strong className="text-rose-600">Blocked until 100%</strong>
                  </span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(false)}
                  className="px-3 py-1.5 rounded-xl border text-xs font-semibold hover:bg-muted transition-colors"
                >
                  Close
                </button>

                {hasEdits && (
                  <button
                    type="button"
                    onClick={handleSaveEdits}
                    disabled={updateMutation.isPending}
                    className="px-4 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition-colors shadow-xs flex items-center gap-1.5 disabled:opacity-50"
                  >
                    {updateMutation.isPending ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Saving...
                      </>
                    ) : (
                      <>
                        <Save className="h-3.5 w-3.5" />
                        Save & Recalculate
                      </>
                    )}
                  </button>
                )}

                {!isComplete && onProceedToProposal && !hasEdits && (
                  <button
                    type="button"
                    onClick={() => {
                      setIsOpen(false);
                      onProceedToProposal();
                    }}
                    className="px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-xs font-bold hover:bg-primary/90 transition-colors shadow-xs"
                  >
                    Complete Missing Details
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
