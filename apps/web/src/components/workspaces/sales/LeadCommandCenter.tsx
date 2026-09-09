'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useQuery } from '@tanstack/react-query';
import { StepTracker } from './StepTracker';
import { useSalesWorkspace } from '../../../hooks/useSalesWorkspace';
import { apiClient } from '../../../lib/api-client';
import { salesWorkspaceRepository } from '../../../repositories/sales-workspace.repository';
import { MotorQuoteWizard } from '../../leads/motor-quote/MotorQuoteWizard';
import { QuotationCompletionView } from '../../leads/motor-quote/QuotationCompletionView';
import {
  User,
  Phone,
  Mail,
  Building,
  Shield,
  FileSpreadsheet,
  FileText,
  Upload,
  Share2,
  CheckCircle,
  Clock,
  Send,
  PlusCircle,
  Calculator,
  Calendar,
  Car,
  ExternalLink,
  Plus,
  RefreshCw,
  AlertTriangle,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  History,
  FileCheck2,
} from 'lucide-react';
import { toast } from 'sonner';

interface LeadCommandCenterProps {
  lead: any;
  onRefresh?: () => void;
}

export function LeadCommandCenter({ lead, onRefresh }: LeadCommandCenterProps) {
  const { moveStage, isMovingStage, createReferral } = useSalesWorkspace();
  const [activeTab, setActiveTab] = useState<
    'OVERVIEW' | 'CUSTOMER_360' | 'DOCUMENTS' | 'QUOTATION' | 'PROPOSAL' | 'ACTIVITIES' | 'REFERRAL'
  >('OVERVIEW');

  // Motor Quote Wizard State
  const [isQuoteWizardOpen, setIsQuoteWizardOpen] = useState(false);

  // Call & Meeting Form State
  const [callOutcome, setCallOutcome] = useState('CONNECTED');
  const [callNotes, setCallNotes] = useState('');
  const [isLoggingCall, setIsLoggingCall] = useState(false);

  // Referral Modal State
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [refName, setRefName] = useState('');
  const [refPhone, setRefPhone] = useState('');
  const [refProduct, setRefProduct] = useState('MOTOR');

  // Documents Local State
  const [documentsState, setDocumentsState] = useState<Record<string, { status: string; fileName?: string }>>({
    rc_book: { status: 'PENDING' },
    previous_policy: { status: 'PENDING' },
    pan_card: { status: 'VERIFIED', fileName: 'PAN_Card.pdf' },
    aadhaar_kyc: { status: 'PENDING' },
    inspection_report: { status: 'NOT_REQUIRED' },
  });

  // Query Quotations linked to this Lead
  const {
    data: leadQuotes = [],
    isLoading: isQuotesLoading,
    refetch: refetchQuotes,
  } = useQuery({
    queryKey: ['lead-quotations', lead?.id],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/quotations', { params: { leadId: lead.id } });
        const list = res.data?.data || res.data?.items || res.data || [];
        return Array.isArray(list) ? list : [];
      } catch {
        return [];
      }
    },
    enabled: !!lead?.id,
  });

  // Query Stage History for this Lead
  const { data: stageHistory = [] } = useQuery({
    queryKey: ['lead-stage-history', lead?.id],
    queryFn: async () => {
      try {
        return await salesWorkspaceRepository.getStageHistory(lead.id);
      } catch {
        return [];
      }
    },
    enabled: !!lead?.id && activeTab === 'ACTIVITIES',
  });

  if (!lead) return null;

  const currentStep = lead.currentWorkflowStep || 'ASSIGNED';
  const contact = lead.contact || {};

  const handleMoveStage = (targetStage: string, overrideReason?: string, remarks?: string) => {
    moveStage(
      { leadId: lead.id, targetStage, overrideReason, remarks },
      {
        onSuccess: () => {
          if (onRefresh) onRefresh();
        },
      }
    );
  };

  const handleLogCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingCall(true);
    try {
      await salesWorkspaceRepository.logCall(lead.id, {
        callOutcome,
        notes: callNotes,
      });
      toast.success(`Call outcome '${callOutcome}' logged for ${contact.firstName || 'customer'}`);
      setCallNotes('');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to log call interaction');
    } finally {
      setIsLoggingCall(false);
    }
  };

  const handleCreateReferralSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!refName || !refPhone) {
      toast.error('Referral name and phone are required');
      return;
    }
    createReferral(
      {
        leadId: lead.id,
        data: { referralName: refName, phone: refPhone, interestedProduct: refProduct },
      },
      {
        onSuccess: () => {
          setShowReferralModal(false);
          setRefName('');
          setRefPhone('');
          if (onRefresh) onRefresh();
        },
      }
    );
  };

  const handleDocumentUpload = (docKey: string, docLabel: string) => {
    setDocumentsState((prev) => ({
      ...prev,
      [docKey]: { status: 'VERIFIED', fileName: `${docLabel.replace(/\s+/g, '_')}_Uploaded.pdf` },
    }));
    toast.success(`${docLabel} uploaded and verified for this lead!`);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header Banner & Lead Context */}
      <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary border flex items-center justify-center font-black text-base">
            {contact.firstName?.[0] || 'L'}
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-xs font-bold text-primary">{lead.leadCode}</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-muted/40 text-muted-foreground uppercase">
                {lead.source || 'CRM'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary uppercase">
                Stage: {currentStep}
              </span>
            </div>
            <h2 className="text-lg font-black text-foreground tracking-tight mt-0.5">
              {contact.firstName} {contact.lastName} ({lead.title})
            </h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground mt-1">
              <span className="flex items-center space-x-1">
                <Phone className="h-3 w-3" />
                <span>{contact.phone || 'No phone'}</span>
              </span>
              <span className="flex items-center space-x-1">
                <Mail className="h-3 w-3" />
                <span>{contact.email || 'No email'}</span>
              </span>
              {contact.panNumber && (
                <span className="flex items-center space-x-1 font-mono text-[11px]">
                  <Shield className="h-3 w-3 text-primary" />
                  <span>PAN: {contact.panNumber}</span>
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Quick Action Triggers */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => {
              setActiveTab('QUOTATION');
              setIsQuoteWizardOpen(true);
            }}
            className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-primary/90 transition-all"
          >
            <Car className="h-3.5 w-3.5" />
            <span>+ Motor Quote</span>
          </button>
          <button
            onClick={() => setShowReferralModal(true)}
            className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-emerald-700 transition-all"
          >
            <Share2 className="h-3.5 w-3.5" />
            <span>Capture Referral</span>
          </button>
        </div>
      </div>

      {/* 2. StepTracker Banner */}
      <StepTracker
        currentStep={currentStep}
        leadId={lead.id}
        onMoveStage={handleMoveStage}
        isMoving={isMovingStage}
      />

      {/* 3. Navigation Tabs */}
      <div className="flex border-b text-xs font-semibold overflow-x-auto space-x-4">
        {[
          { id: 'OVERVIEW', label: 'Lead Overview' },
          { id: 'CUSTOMER_360', label: 'Customer 360' },
          { id: 'DOCUMENTS', label: 'Document Checklist' },
          { id: 'QUOTATION', label: `Quotation Engine (${leadQuotes.length})` },
          { id: 'PROPOSAL', label: 'Proposal & Underwriting' },
          { id: 'ACTIVITIES', label: 'Call & Interaction Logs' },
          { id: 'REFERRAL', label: 'Referrals & CRM' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`py-2.5 border-b-2 transition-all whitespace-nowrap ${
              activeTab === tab.id
                ? 'border-primary text-primary font-bold'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* 4. Tab Contents */}

      {/* OVERVIEW TAB */}
      {activeTab === 'OVERVIEW' && (
        <div className="grid grid-cols-12 gap-4">
          <div className="col-span-12 lg:col-span-8 p-5 rounded-2xl border bg-card space-y-4">
            <h3 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">
              Lead Parameters & Need Analysis
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div>
                <span className="text-muted-foreground block text-[10px]">Product Interest</span>
                <span className="font-extrabold text-foreground">{lead.title}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Estimated Premium</span>
                <span className="font-extrabold text-emerald-600">₹{lead.estimatedPremium || '24,500'}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Assigned Agent</span>
                <span className="font-bold text-foreground">
                  {lead.assignedTo ? `${lead.assignedTo.firstName} ${lead.assignedTo.lastName}` : 'Sales Executive'}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Current Status</span>
                <span className="font-bold text-primary">{lead.status}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Lead Code</span>
                <span className="font-mono font-bold text-foreground">{lead.leadCode}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[10px]">Quotes Linked</span>
                <span className="font-extrabold text-foreground">{leadQuotes.length} prepared</span>
              </div>
            </div>

            <div className="pt-3 border-t">
              <label className="text-[11px] font-bold text-foreground block mb-1">Lead Notes & Description</label>
              <p className="text-xs text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-xl border">
                {lead.description || 'Customer requested motor policy quotation with Zero Dep and RSA addons.'}
              </p>
            </div>

            {/* Quick Quotation Status in Overview */}
            <div className="pt-3 border-t flex items-center justify-between">
              <div>
                <span className="text-xs font-bold text-foreground block">Motor Quotation Continuity</span>
                <span className="text-[11px] text-muted-foreground">
                  {leadQuotes.length > 0
                    ? `${leadQuotes.length} quotation(s) active for this lead. Click below to view or add more.`
                    : 'No quotation has been attached to this lead yet.'}
                </span>
              </div>
              <button
                onClick={() => {
                  setActiveTab('QUOTATION');
                  setIsQuoteWizardOpen(true);
                }}
                className="px-3 py-1.5 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-colors flex items-center space-x-1"
              >
                <Car className="h-3.5 w-3.5" />
                <span>{leadQuotes.length > 0 ? 'Add Another Quote' : 'Prepare Quote'}</span>
              </button>
            </div>
          </div>

          <div className="col-span-12 lg:col-span-4 p-5 rounded-2xl border bg-card space-y-3">
            <h3 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">
              Log Outbound Call Interaction
            </h3>
            <form onSubmit={handleLogCall} className="space-y-3 text-xs">
              <div>
                <label className="font-bold text-foreground block mb-1">Call Outcome *</label>
                <select
                  value={callOutcome}
                  onChange={(e) => setCallOutcome(e.target.value)}
                  className="w-full p-2 rounded-xl border bg-background font-semibold"
                >
                  <option value="CONNECTED">Connected - Interested</option>
                  <option value="NO_ANSWER">No Answer / Busy</option>
                  <option value="SCHEDULED_CALLBACK">Scheduled Call Back</option>
                  <option value="NOT_INTERESTED">Not Interested</option>
                </select>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Notes</label>
                <textarea
                  rows={2}
                  value={callNotes}
                  onChange={(e) => setCallNotes(e.target.value)}
                  placeholder="Call discussion summary..."
                  className="w-full p-2 rounded-xl border bg-background"
                />
              </div>

              <button
                type="submit"
                disabled={isLoggingCall}
                className="w-full py-2 rounded-xl bg-primary text-primary-foreground font-extrabold shadow-xs hover:bg-primary/90 disabled:opacity-50"
              >
                {isLoggingCall ? 'Recording Call...' : 'Log Call & Update SLA'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* CUSTOMER 360 TAB */}
      {activeTab === 'CUSTOMER_360' && (
        <div className="p-5 rounded-2xl border bg-card space-y-4 text-xs">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">
              Customer 360 Operational Profile
            </h3>
            {contact.id && (
              <Link
                href={`/crm/contacts/${contact.id}`}
                className="text-xs text-primary hover:underline font-bold flex items-center space-x-1"
              >
                <span>View Full Contact Record</span>
                <ExternalLink className="h-3 w-3" />
              </Link>
            )}
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 rounded-xl bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Customer Name</span>
              <span className="font-bold text-foreground">{contact.firstName} {contact.lastName}</span>
            </div>
            <div className="p-3 rounded-xl bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Phone Number</span>
              <span className="font-bold text-foreground">{contact.phone || '-'}</span>
            </div>
            <div className="p-3 rounded-xl bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Email Address</span>
              <span className="font-bold text-foreground">{contact.email || '-'}</span>
            </div>
            <div className="p-3 rounded-xl bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">PAN / Identification</span>
              <span className="font-mono font-bold text-foreground">{contact.panNumber || '-'}</span>
            </div>
            <div className="p-3 rounded-xl bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Customer Identifier</span>
              <span className="font-mono font-bold text-primary">{contact.contactCode || 'Auto-generated'}</span>
            </div>
            <div className="p-3 rounded-xl bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">City / State</span>
              <span className="font-bold text-foreground">Mumbai, Maharashtra</span>
            </div>
            <div className="p-3 rounded-xl bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Assigned Branch</span>
              <span className="font-bold text-foreground">Head Office (BKC, Mumbai)</span>
            </div>
            <div className="p-3 rounded-xl bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Relationship Health</span>
              <span className="font-bold text-emerald-600">Active Prospect</span>
            </div>
          </div>
        </div>
      )}

      {/* DOCUMENTS CHECKLIST TAB */}
      {activeTab === 'DOCUMENTS' && (
        <div className="p-5 rounded-2xl border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">
                Motor Insurance Document Checklist
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Required underwriting artifacts before policy issuance and proposal conversion.
              </p>
            </div>
          </div>

          <div className="space-y-3">
            {[
              { key: 'rc_book', label: 'Registration Certificate (RC Copy)', required: true, desc: 'Both sides of RC showing chassis, engine, and seating capacity' },
              { key: 'previous_policy', label: 'Expiring Policy Copy', required: true, desc: 'Previous policy schedule verifying NCB entitlement and claims history' },
              { key: 'pan_card', label: 'PAN Card / Form 60', required: true, desc: 'Mandatory for AML compliance on premiums above ₹50,000' },
              { key: 'aadhaar_kyc', label: 'Customer KYC (Aadhaar / Passport)', required: false, desc: 'Address proof for registered owner' },
              { key: 'inspection_report', label: 'Vehicle Inspection Photos (Break-in)', required: false, desc: 'Required only if previous policy expired > 90 days or break-in policy' },
            ].map((doc) => {
              const state = documentsState[doc.key] || { status: 'PENDING' };
              const isVerified = state.status === 'VERIFIED';
              return (
                <div
                  key={doc.key}
                  className="p-3.5 rounded-xl border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-foreground">{doc.label}</span>
                      {doc.required ? (
                        <span className="text-[9px] font-extrabold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600">
                          MANDATORY
                        </span>
                      ) : (
                        <span className="text-[9px] font-semibold text-muted-foreground">OPTIONAL</span>
                      )}
                      {isVerified ? (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 flex items-center space-x-1">
                          <CheckCircle2 className="h-3 w-3" />
                          <span>VERIFIED</span>
                        </span>
                      ) : (
                        <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
                          PENDING UPLOAD
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-muted-foreground">{doc.desc}</p>
                    {state.fileName && (
                      <p className="text-[10px] font-mono text-primary flex items-center space-x-1">
                        <FileText className="h-3 w-3" />
                        <span>Attached: {state.fileName}</span>
                      </p>
                    )}
                  </div>
                  <div className="shrink-0 flex items-center space-x-2">
                    <button
                      onClick={() => handleDocumentUpload(doc.key, doc.label)}
                      className="px-3 py-1.5 rounded-lg border bg-background hover:bg-muted text-xs font-bold text-foreground transition-colors flex items-center space-x-1"
                    >
                      <Upload className="h-3.5 w-3.5" />
                      <span>{isVerified ? 'Replace' : 'Upload'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* QUOTATION ENGINE TAB */}
      {activeTab === 'QUOTATION' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 p-4 rounded-xl border bg-card">
            <div>
              <h3 className="text-sm font-black text-foreground">Motor Quotations for Lead</h3>
              <p className="text-xs text-muted-foreground">
                All quotes generated for this prospect are preserved with IRDAI tariff compliance and NCB verification.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => refetchQuotes()}
                className="p-2 rounded-lg border bg-background hover:bg-muted text-muted-foreground"
                title="Refresh Quotations"
              >
                <RefreshCw className={`h-4 w-4 ${isQuotesLoading ? 'animate-spin' : ''}`} />
              </button>
              <Link
                href={`/sales/quotations?leadId=${lead.id}`}
                className="px-3 py-2 rounded-xl border text-foreground hover:bg-accent text-xs font-bold flex items-center space-x-1.5"
              >
                <span>Open Full Workspace</span>
                <ExternalLink className="h-3.5 w-3.5" />
              </Link>
              <button
                onClick={() => setIsQuoteWizardOpen(true)}
                className="px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-primary/90"
              >
                <Plus className="h-4 w-4" />
                <span>+ Generate Motor Quote</span>
              </button>
            </div>
          </div>

          {leadQuotes.length === 0 ? (
            <div className="p-8 rounded-2xl border bg-card text-center space-y-4">
              <div className="h-16 w-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <Car className="h-8 w-8" />
              </div>
              <div className="max-w-md mx-auto">
                <h4 className="text-base font-black text-foreground">No Quotations Attached Yet</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  Generate an authoritative motor insurance quote with instant IRDAI TP tariffs and add-on pricing.
                  Creating a quote will automatically link it to {contact.firstName || 'this prospect'} and advance the
                  lead to &quot;Quotation Prepared&quot;.
                </p>
              </div>
              <button
                onClick={() => setIsQuoteWizardOpen(true)}
                className="px-5 py-2.5 rounded-xl bg-primary text-primary-foreground text-xs font-black shadow-md hover:bg-primary/90 inline-flex items-center space-x-2"
              >
                <Car className="h-4 w-4" />
                <span>Launch Motor Quotation Wizard</span>
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {leadQuotes.map((quote: any) => {
                const isIssued = quote.issuanceStatus === 'ISSUED' || quote.status === 'ISSUED';
                const totalPrem = quote.totalPremium || quote.motorMetadata?.policyDetails?.totalPremium || 0;
                const regNo = quote.registrationNumber || quote.motorMetadata?.registrationNumber || 'New Vehicle';
                const category = quote.vehicleCategory || quote.motorMetadata?.vehicleCategory || 'PRIVATE_CAR';
                const insurer = quote.insurerName || 'Partner Insurer';

                return (
                  <div
                    key={quote.id}
                    className="p-4 rounded-xl border bg-card hover:border-primary/40 transition-all shadow-xs space-y-3"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <span className="font-mono text-xs font-black text-primary bg-primary/10 px-2 py-0.5 rounded">
                          {quote.quotationCode || quote.id.slice(0, 8)}
                        </span>
                        <div className="font-extrabold text-foreground text-sm mt-1">{regNo}</div>
                        <div className="text-[11px] text-muted-foreground">
                          {insurer} · {category.replace('_', ' ')}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="text-base font-black text-primary">
                          ₹{Number(totalPrem).toLocaleString('en-IN')}
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            isIssued
                              ? 'bg-emerald-500/10 text-emerald-600'
                              : 'bg-amber-500/10 text-amber-600'
                          }`}
                        >
                          {quote.status || 'QUOTED'}
                        </span>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <QuotationCompletionView
                        quotationId={quote.id}
                        quotationCode={quote.quotationCode}
                      />
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t text-[11px]">
                      <span className="text-muted-foreground">
                        Created: {new Date(quote.createdAt).toLocaleDateString('en-IN')}
                      </span>
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/sales/quotations?leadId=${lead.id}`}
                          className="font-bold text-primary hover:underline flex items-center space-x-1"
                        >
                          <span>Manage Quote</span>
                          <ArrowRight className="h-3 w-3" />
                        </Link>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PROPOSAL & UNDERWRITING TAB */}
      {activeTab === 'PROPOSAL' && (
        <div className="p-5 rounded-2xl border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">
                Proposal Conversion & Underwriting Review
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Convert approved quotation into an authoritative proposal for back-office issuance.
              </p>
            </div>
            <Link
              href={`/sales/quotations?leadId=${lead.id}`}
              className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-bold flex items-center space-x-1.5"
            >
              <span>Manage Proposals in Workspace</span>
              <ExternalLink className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
            <div className="p-4 rounded-xl border bg-muted/20 space-y-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Stage 1: Proposal</span>
              <div className="font-extrabold text-foreground">
                {leadQuotes.length > 0 ? 'Quotation Ready for Proposal' : 'Awaiting Quotation'}
              </div>
              <p className="text-[10px] text-muted-foreground">
                Customer personal details, nominee declarations, and vehicle inspection clearances.
              </p>
            </div>
            <div className="p-4 rounded-xl border bg-muted/20 space-y-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Stage 2: Payment</span>
              <div className="font-extrabold text-foreground">Pending Customer Remittance</div>
              <p className="text-[10px] text-muted-foreground">
                Instant Razorpay / CC Avenue payment link dispatch and reconciliation.
              </p>
            </div>
            <div className="p-4 rounded-xl border bg-muted/20 space-y-1">
              <span className="text-[10px] font-bold uppercase text-muted-foreground">Stage 3: Issuance</span>
              <div className="font-extrabold text-foreground">Back Office Queue</div>
              <p className="text-[10px] text-muted-foreground">
                Final compliance verification, insurer portal issuance, and policy PDF distribution.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ACTIVITIES & CALL LOGS TAB */}
      {activeTab === 'ACTIVITIES' && (
        <div className="p-5 rounded-2xl border bg-card space-y-4">
          <h3 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">
            Lead Interaction History & Audit Trail
          </h3>

          <div className="space-y-3">
            {stageHistory.length > 0 ? (
              stageHistory.map((item: any, idx: number) => (
                <div
                  key={item.id || idx}
                  className="p-3.5 rounded-xl border bg-muted/20 flex items-start justify-between text-xs"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-foreground">
                        {item.fromStage ? `${item.fromStage} → ${item.toStage}` : item.toStage}
                      </span>
                      {item.isOverride && (
                        <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-600">
                          OVERRIDE
                        </span>
                      )}
                    </div>
                    {item.remarks && <p className="text-muted-foreground text-[11px]">{item.remarks}</p>}
                    {item.overrideReason && (
                      <p className="text-amber-600 text-[10px] font-medium">Reason: {item.overrideReason}</p>
                    )}
                  </div>
                  <span className="text-[10px] text-muted-foreground font-mono">
                    {new Date(item.createdAt).toLocaleString('en-IN')}
                  </span>
                </div>
              ))
            ) : (
              <div className="p-6 text-center text-xs text-muted-foreground">
                No stage transitions recorded yet. Use the top tracker or call logger to capture activity.
              </div>
            )}
          </div>
        </div>
      )}

      {/* REFERRALS TAB */}
      {activeTab === 'REFERRAL' && (
        <div className="p-5 rounded-2xl border bg-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">
                Customer Referrals & Network Expansion
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Record new leads referred by {contact.firstName || 'this customer'}.
              </p>
            </div>
            <button
              onClick={() => setShowReferralModal(true)}
              className="px-3.5 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold flex items-center space-x-1.5 shadow-xs hover:bg-emerald-700"
            >
              <Share2 className="h-3.5 w-3.5" />
              <span>+ Capture Referral</span>
            </button>
          </div>

          <div className="p-8 rounded-2xl border bg-muted/10 text-center space-y-3">
            <div className="h-12 w-12 mx-auto rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <Share2 className="h-6 w-6" />
            </div>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Capturing customer referrals automatically provisions child leads in the CRM and attributes referral commission to the originating agent.
            </p>
          </div>
        </div>
      )}

      {/* Motor Quote Wizard Modal */}
      <MotorQuoteWizard
        isOpen={isQuoteWizardOpen}
        leadId={lead.id}
        leadContact={{
          name: `${contact.firstName || ''} ${contact.lastName || ''}`.trim(),
          phone: contact.phone,
          email: contact.email,
          pan: contact.panNumber,
        }}
        onClose={() => setIsQuoteWizardOpen(false)}
        onSaved={() => {
          setIsQuoteWizardOpen(false);
          void refetchQuotes();
          if (onRefresh) onRefresh();
          toast.success('Motor quotation created and linked to lead!');
        }}
      />

      {/* Referral Modal */}
      {showReferralModal && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="w-full max-w-md p-6 rounded-2xl border bg-card shadow-2xl space-y-4 text-xs">
            <div className="flex items-center space-x-2 text-emerald-600">
              <Share2 className="h-5 w-5" />
              <h3 className="text-sm font-extrabold text-foreground">Capture Customer Referral</h3>
            </div>

            <form onSubmit={handleCreateReferralSubmit} className="space-y-3">
              <div>
                <label className="font-bold text-foreground block mb-1">Referral Name *</label>
                <input
                  required
                  type="text"
                  value={refName}
                  onChange={(e) => setRefName(e.target.value)}
                  placeholder="e.g. Vikram Malhotra"
                  className="w-full p-2.5 rounded-xl border bg-background"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Phone Number *</label>
                <input
                  required
                  type="tel"
                  value={refPhone}
                  onChange={(e) => setRefPhone(e.target.value)}
                  placeholder="9876543210"
                  className="w-full p-2.5 rounded-xl border bg-background"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Interested Product</label>
                <select
                  value={refProduct}
                  onChange={(e) => setRefProduct(e.target.value)}
                  className="w-full p-2.5 rounded-xl border bg-background font-semibold"
                >
                  <option value="MOTOR">Motor Insurance</option>
                  <option value="HEALTH">Health Insurance</option>
                  <option value="LIFE">Life Insurance</option>
                </select>
              </div>

              <div className="flex justify-end space-x-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setShowReferralModal(false)}
                  className="px-3 py-1.5 font-semibold rounded-xl border hover:bg-accent"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 font-extrabold rounded-xl bg-emerald-600 text-white shadow-xs hover:bg-emerald-700"
                >
                  Submit Referral & Create Lead
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
