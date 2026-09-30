'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Activity,
  Calendar,
  StickyNote,
  Folder,
  MessageSquare,
  GitMerge,
  Clock,
  BarChart3,
  Plus,
  Car,
  RefreshCw,
  ArrowRightLeft,
  CheckCircle2,
  X,
} from 'lucide-react';
import { ChunkedFileUploader } from '../../upload/chunked-file-uploader';
import { toast } from 'sonner';
import { apiClient } from '../../../lib/api-client';
import { MotorQuoteWizard } from '../motor-quote/MotorQuoteWizard';
import { QuoteCard } from '../motor-quote/QuoteCard';
import type { SavedMotorQuote } from '../motor-quote/motorFormTypes';

interface FollowUpItem {
  id: string;
  type: string;
  text: string;
  time: string;
  status: string;
}

interface NoteItem {
  id: string;
  author: string;
  text: string;
  isPinned: boolean;
  createdAt: string;
}

export function LeadTabsContainer({
  leadId,
  leadContact,
}: {
  leadId: string;
  leadContact?: {
    name?: string;
    phone?: string;
    email?: string;
    address?: string;
    pan?: string;
    rm?: string;
  };
}) {
  const [activeTab, setActiveTab] = useState<string>('ACTIVITIES');

  const [activities, setActivities] = useState<FollowUpItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [motorQuotes, setMotorQuotes] = useState<SavedMotorQuote[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [showMotorWizard, setShowMotorWizard] = useState(false);

  // Comparison & Clone state
  const [cloneQuoteData, setCloneQuoteData] = useState<any>(null);
  const [activeCaseId, setActiveCaseId] = useState<string | undefined>(undefined);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [isLoadingComparison, setIsLoadingComparison] = useState(false);

  // Modal state
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  // Load activities & notes from authoritative backend API
  const loadActivitiesAndNotes = useCallback(async () => {
    try {
      const res = await apiClient.get(`/leads/${leadId}`);
      const leadData = res.data;
      if (leadData?.activities) {
        setActivities(
          leadData.activities.map((a: any) => ({
            id: a.id,
            type: a.type || 'TASK',
            text: a.subject || a.description || 'Follow-up',
            time: a.dueDate ? new Date(a.dueDate).toLocaleDateString() : 'Scheduled',
            status: a.status || 'PENDING',
          })),
        );
      }
      if (leadData?.notes) {
        setNotes(
          leadData.notes.map((n: any) => ({
            id: n.id,
            author: n.createdById || 'Agent',
            text: n.content,
            isPinned: false,
            createdAt: new Date(n.createdAt).toLocaleDateString(),
          })),
        );
      }
    } catch {
      setActivities([]);
      setNotes([]);
    }
  }, [leadId]);

  useEffect(() => {
    loadActivitiesAndNotes();
  }, [loadActivitiesAndNotes]);

  // Load motor quotes: API first
  const loadMotorQuotes = useCallback(async () => {
    setIsLoadingQuotes(true);
    try {
      const res = await apiClient.get(`/quotations?leadId=${leadId}&productType=MOTOR`);
      const apiQuotes: SavedMotorQuote[] = (res.data?.data || res.data || [])
        .filter((q: any) => q.vehicleCategory)
        .map((q: any) => ({
          id: q.id,
          quotationCode: q.quotationCode,
          vehicleCategory: q.vehicleCategory,
          policyType: q.policyType,
          insurerName: q.insurerName,
          registrationNumber: q.registrationNumber || '',
          totalPremium: Number(q.totalPremium || 0),
          idv: Number(q.sumInsured || 0),
          ncbPercentage: q.ncbPercentage || 0,
          policyStartDate: (q.motorMetadata as any)?.policyDetails?.policyStartDate || '',
          policyEndDate: (q.motorMetadata as any)?.policyDetails?.policyEndDate || '',
          status: q.status || 'DRAFT',
          createdAt: q.createdAt,
          proposerDetails: (q.motorMetadata as any)?.proposerDetails,
          vehicleDetails: (q.motorMetadata as any)?.vehicleDetails,
          policyDetails: (q.motorMetadata as any)?.policyDetails,
          caseId: q.caseId || (q.motorMetadata as any)?.caseId || undefined,
          motorDocuments: q.motorDocuments || [],
        }));

      setMotorQuotes(apiQuotes);
    } catch {
      setMotorQuotes([]);
    } finally {
      setIsLoadingQuotes(false);
    }
  }, [leadId]);

  useEffect(() => {
    if (activeTab === 'QUOTATIONS') {
      loadMotorQuotes();
    }
  }, [activeTab, loadMotorQuotes]);

  // Form states
  const [actType, setActType] = useState('Call');
  const [actText, setActText] = useState('');
  const [noteText, setNoteText] = useState('');

  const handleAddActivity = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actText) return;
    try {
      const typeNormalized =
        actType.toUpperCase() === 'CALL'
          ? 'CALL'
          : actType.toUpperCase() === 'EMAIL'
            ? 'EMAIL'
            : actType.toUpperCase() === 'MEETING'
              ? 'MEETING'
              : 'TASK';
      await apiClient.post(`/leads/${leadId}/activities`, {
        type: typeNormalized,
        subject: actText,
        dueDate: new Date(),
      });
      toast.success('Follow-up activity scheduled!');
      setActText('');
      setShowAddActivity(false);
      await loadActivitiesAndNotes();
    } catch (err: any) {
      toast.error(`Failed to schedule activity: ${err.message || 'Error'}`);
    }
  };

  const handleAddNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText) return;
    try {
      await apiClient.post(`/leads/${leadId}/notes`, {
        content: noteText,
      });
      toast.success('Note added to lead!');
      setNoteText('');
      setShowAddNote(false);
      await loadActivitiesAndNotes();
    } catch (err: any) {
      toast.error(`Failed to save note: ${err.message || 'Error'}`);
    }
  };

  const handleQuoteSaved = (quote: any) => {
    setMotorQuotes((prev) => [quote, ...prev]);
    loadMotorQuotes();
  };

  // Phase 5: Real Document Upload & Motor Association Pipeline
  const handleUploadQuote = async (quotationId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('name', file.name);
      formData.append('entityType', 'QUOTATION');
      formData.append('entityId', quotationId);
      formData.append('category', 'INSURER_QUOTE');

      toast.info('Uploading quotation PDF...');
      const uploadRes = await apiClient.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      const documentId = uploadRes.data?.id;
      if (documentId) {
        await apiClient.post(`/motor/quotations/${quotationId}/documents`, {
          documentId,
          documentType: 'INSURER_QUOTE',
        });
        toast.success('Quotation PDF attached and registered successfully!');
        loadMotorQuotes();
      }
    } catch (err: any) {
      toast.error(`Failed to upload document: ${err.response?.data?.message || err.message}`);
    }
  };

  // Phase 7: Add Another Quote & Compare
  const handleAddComparisonQuote = (quote: SavedMotorQuote) => {
    const rawQuote = quote as any;
    const meta = (rawQuote.motorMetadata as any) || {};
    setActiveCaseId(rawQuote.caseId || undefined);
    setCloneQuoteData({
      category: quote.vehicleCategory,
      policyType: quote.policyType,
      proposerDetails: quote.proposerDetails || meta.proposerDetails,
      vehicleDetails: quote.vehicleDetails || meta.vehicleDetails,
      previousPolicyDetails: meta.previousPolicyDetails,
      caseId: rawQuote.caseId || undefined,
    });
    setShowMotorWizard(true);
  };

  const handleOpenComparison = async (caseIdParam?: string) => {
    let caseId = caseIdParam;
    if (!caseId) {
      const quoteWithCase = motorQuotes.find((q: any) => q.caseId);
      caseId = (quoteWithCase as any)?.caseId;
    }
    if (caseId) {
      setIsLoadingComparison(true);
      setShowComparisonModal(true);
      try {
        const res = await apiClient.get(`/motor/quotation-cases/${caseId}/compare`);
        setComparisonData(res.data);
      } catch (err: any) {
        toast.error(`Failed to load comparison: ${err.response?.data?.message || err.message}`);
      } finally {
        setIsLoadingComparison(false);
      }
    } else {
      setShowComparisonModal(true);
    }
  };

  const handleSelectWinningQuote = async (caseId: string, quoteId: string) => {
    try {
      await apiClient.post(`/motor/quotation-cases/${caseId}/select`, {
        quotationId: quoteId,
      });
      toast.success('Winning quotation selected!');
      setShowComparisonModal(false);
      loadMotorQuotes();
    } catch (err: any) {
      toast.error(`Failed to select quotation: ${err.response?.data?.message || err.message}`);
    }
  };

  const tabs = [
    { id: 'OVERVIEW', label: 'Overview', icon: <Activity className="h-3.5 w-3.5" /> },
    { id: 'ACTIVITIES', label: 'Follow-ups & Activities', icon: <Calendar className="h-3.5 w-3.5" />, badge: activities.length },
    { id: 'NOTES', label: 'Notes', icon: <StickyNote className="h-3.5 w-3.5" />, badge: notes.length },
    { id: 'DOCUMENTS', label: 'Documents', icon: <Folder className="h-3.5 w-3.5" /> },
    { id: 'QUOTATIONS', label: 'Motor Quotations', icon: <Car className="h-3.5 w-3.5" />, badge: motorQuotes.length },
    { id: 'COMMUNICATION', label: 'Communication', icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { id: 'WORKFLOW', label: 'Workflow & SLA', icon: <GitMerge className="h-3.5 w-3.5" /> },
    { id: 'TIMELINE', label: 'Timeline', icon: <Clock className="h-3.5 w-3.5" /> },
    { id: 'ANALYTICS', label: 'Analytics', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  ];

  return (
    <>
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        {/* Tab Navigation Bar */}
        <div className="flex border-b text-xs overflow-x-auto p-1.5 bg-muted/20 space-x-1">
          {tabs.map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'bg-background shadow text-primary font-bold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {t.icon}
              <span>{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className="px-1.5 py-0.5 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div className="p-6 text-xs space-y-4">

          {/* OVERVIEW TAB */}
          {activeTab === 'OVERVIEW' && (
            <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 space-y-2">
              <h4 className="font-bold text-sm text-primary">Lead Overview & Status Metrics</h4>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Lead ID</span><div className="font-bold">{leadId}</div></div>
                <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Activities</span><div className="font-bold">{activities.length}</div></div>
                <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Notes</span><div className="font-bold">{notes.length}</div></div>
                <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Motor Quotes</span><div className="font-bold text-emerald-600">{motorQuotes.length}</div></div>
              </div>
            </div>
          )}

          {/* ACTIVITIES TAB */}
          {activeTab === 'ACTIVITIES' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm">Follow-up Activity Timeline</h4>
                <button
                  onClick={() => setShowAddActivity(!showAddActivity)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center space-x-1"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>Schedule Follow-up</span>
                </button>
              </div>

              {showAddActivity && (
                <form onSubmit={handleAddActivity} className="p-4 rounded-xl border bg-background space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div>
                      <label className="font-bold block mb-1">Activity Type</label>
                      <select value={actType} onChange={(e) => setActType(e.target.value)} className="w-full p-2 rounded border bg-card text-xs">
                        <option value="Call">Call</option>
                        <option value="Meeting">Meeting</option>
                        <option value="WhatsApp">WhatsApp</option>
                        <option value="Email">Email</option>
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="font-bold block mb-1">Activity Notes / Objective *</label>
                      <input
                        type="text"
                        required
                        value={actText}
                        onChange={(e) => setActText(e.target.value)}
                        placeholder="e.g. Call client to discuss policy add-on terms"
                        className="w-full p-2 rounded border bg-card text-xs"
                      />
                    </div>
                  </div>
                  <div className="flex justify-end space-x-2">
                    <button type="button" onClick={() => setShowAddActivity(false)} className="px-3 py-1.5 rounded border">Cancel</button>
                    <button type="submit" className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-bold">Save Activity</button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {activities.map((f) => (
                  <div key={f.id} className="p-3 rounded-lg border bg-card flex justify-between items-center">
                    <div className="space-y-0.5">
                      <div className="font-bold text-foreground">{f.type}: {f.text}</div>
                      <div className="text-[10px] text-muted-foreground">{f.time}</div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600">{f.status}</span>
                  </div>
                ))}
                {activities.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground border border-dashed rounded-xl">
                    No follow-up activities recorded. Click &quot;Schedule Follow-up&quot; to add one.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* NOTES TAB */}
          {activeTab === 'NOTES' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm">Lead Notes & Reminders</h4>
                <button onClick={() => setShowAddNote(!showAddNote)} className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center space-x-1">
                  <Plus className="h-3.5 w-3.5" />
                  <span>Add Note</span>
                </button>
              </div>

              {showAddNote && (
                <form onSubmit={handleAddNote} className="p-4 rounded-xl border bg-background space-y-3">
                  <textarea
                    required
                    rows={2}
                    value={noteText}
                    onChange={(e) => setNoteText(e.target.value)}
                    placeholder="Type notes about client preferences, cover requests, or internal comments..."
                    className="w-full p-2.5 rounded border bg-card text-xs"
                  />
                  <div className="flex justify-end space-x-2">
                    <button type="button" onClick={() => setShowAddNote(false)} className="px-3 py-1.5 rounded border">Cancel</button>
                    <button type="submit" className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-bold">Save Note</button>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {notes.map((n) => (
                  <div key={n.id} className="p-3 rounded-lg border bg-amber-500/10 border-amber-500/30 text-amber-900 dark:text-amber-200">
                    <div className="font-bold">📌 Note (by {n.author}):</div>
                    <p className="mt-1">{n.text}</p>
                  </div>
                ))}
                {notes.length === 0 && (
                  <div className="p-6 text-center text-muted-foreground border border-dashed rounded-xl">
                    No notes added yet. Click &quot;Add Note&quot; to write one.
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ================================================================ */}
          {/* MOTOR QUOTATIONS TAB                                              */}
          {/* ================================================================ */}
          {activeTab === 'QUOTATIONS' && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h4 className="font-bold text-sm text-foreground">Motor Insurance Quotations</h4>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {motorQuotes.length} quote{motorQuotes.length !== 1 ? 's' : ''} — mapped by vehicle registration number
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    onClick={loadMotorQuotes}
                    disabled={isLoadingQuotes}
                    className="p-2 rounded-lg border hover:bg-accent text-muted-foreground transition-colors"
                  >
                    <RefreshCw className={`h-3.5 w-3.5 ${isLoadingQuotes ? 'animate-spin' : ''}`} />
                  </button>
                  {motorQuotes.length >= 2 && (
                    <button
                      onClick={() => handleOpenComparison()}
                      className="px-3 py-2 rounded-xl border bg-muted/30 hover:bg-muted font-bold text-xs flex items-center gap-1.5 transition-all text-foreground"
                    >
                      <ArrowRightLeft className="h-3.5 w-3.5 text-primary" />
                      Compare Quotes
                    </button>
                  )}
                  <button
                    onClick={() => {
                      setCloneQuoteData(null);
                      setActiveCaseId(undefined);
                      setShowMotorWizard(true);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-primary text-primary-foreground font-extrabold text-xs flex items-center gap-1.5 shadow-sm hover:bg-primary/90 transition-all"
                  >
                    <Car className="h-3.5 w-3.5" />
                    + New Motor Quote
                  </button>
                </div>
              </div>

              {isLoadingQuotes ? (
                <div className="p-8 text-center text-muted-foreground animate-pulse text-xs">
                  Loading motor quotations...
                </div>
              ) : motorQuotes.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {motorQuotes.map((q) => (
                    <QuoteCard
                      key={q.id}
                      quote={q}
                      onUploadQuote={handleUploadQuote}
                      onAddComparisonQuote={handleAddComparisonQuote}
                    />
                  ))}
                </div>
              ) : (
                <div className="p-10 text-center border border-dashed rounded-2xl space-y-3">
                  <div className="text-4xl">🚘</div>
                  <div className="font-bold text-sm text-foreground">No Motor Quotes Yet</div>
                  <p className="text-[11px] text-muted-foreground max-w-xs mx-auto">
                    Click &quot;+ New Motor Quote&quot; to capture a motor insurance quotation across 8 vehicle categories and 3 policy types.
                  </p>
                  <button
                    onClick={() => {
                      setCloneQuoteData(null);
                      setActiveCaseId(undefined);
                      setShowMotorWizard(true);
                    }}
                    className="px-4 py-2 rounded-xl bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all inline-flex items-center gap-1.5"
                  >
                    <Car className="h-3.5 w-3.5" />
                    Create First Motor Quote
                  </button>
                </div>
              )}
            </div>
          )}

          {/* WORKFLOW TAB */}
          {activeTab === 'WORKFLOW' && (
            <div className="space-y-3">
              <div className="p-4 rounded-xl border bg-card space-y-2">
                <h4 className="font-bold text-sm">Workflow State Machine</h4>
                <div className="flex items-center space-x-2 text-xs">
                  <span>Active Target SLA: <strong>24 Hours</strong></span>
                  <span>• Lead Workspace ID: <strong>{leadId}</strong></span>
                </div>
              </div>
            </div>
          )}

          {/* DOCUMENTS TAB */}
          {activeTab === 'DOCUMENTS' && (
            <div className="space-y-4">
              <h4 className="font-bold text-sm">Lead Document Vault</h4>
              <ChunkedFileUploader entityType="LEAD" entityId={leadId} />
            </div>
          )}

          {['COMMUNICATION', 'TIMELINE', 'ANALYTICS'].includes(activeTab) && (
            <div className="py-8 text-center text-muted-foreground border border-dashed rounded-xl">
              Workspace Module <strong>{activeTab}</strong> for Lead ID {leadId} is ready.
            </div>
          )}
        </div>
      </div>

      {/* Motor Quote Wizard Modal */}
      <MotorQuoteWizard
        isOpen={showMotorWizard}
        leadId={leadId}
        leadContact={leadContact}
        caseId={activeCaseId}
        cloneQuoteData={cloneQuoteData}
        onClose={() => {
          setShowMotorWizard(false);
          setCloneQuoteData(null);
          setActiveCaseId(undefined);
        }}
        onSaved={handleQuoteSaved}
      />

      {/* Quotation Comparison Modal */}
      {showComparisonModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-5xl bg-card rounded-2xl border shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
            <div className="flex items-center justify-between px-6 py-4 border-b bg-muted/20">
              <div className="flex items-center gap-3">
                <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary font-bold">
                  <ArrowRightLeft className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="font-bold text-base text-foreground">
                    Multi-Quote Comparison Matrix
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {comparisonData?.caseCode ? `Case: ${comparisonData.caseCode}` : 'Side-by-side comparison of partner quotes'}
                    {comparisonData?.registrationNumber ? ` | Reg: ${comparisonData.registrationNumber}` : ''}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowComparisonModal(false)}
                className="p-2 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-x-auto flex-1">
              {isLoadingComparison ? (
                <div className="py-12 text-center text-muted-foreground text-sm animate-pulse">
                  Loading side-by-side quotation comparison...
                </div>
              ) : comparisonData?.quotes?.length > 0 ? (
                <div className="min-w-[650px]">
                  <table className="w-full border-collapse text-left text-xs">
                    <thead>
                      <tr className="border-b bg-muted/30">
                        <th className="p-3 font-bold text-muted-foreground">Feature / Parameter</th>
                        {comparisonData.quotes.map((q: any) => (
                          <th key={q.quotationId} className="p-3 font-extrabold text-foreground border-l">
                            <div className="text-sm">{q.insurerName}</div>
                            <div className="text-[10px] text-muted-foreground font-mono">{q.quotationCode}</div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y text-xs">
                      <tr>
                        <td className="p-3 font-semibold text-muted-foreground">Policy Type</td>
                        {comparisonData.quotes.map((q: any) => (
                          <td key={q.quotationId} className="p-3 font-medium border-l">{q.policyType}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-muted-foreground">IDV (Insured Value)</td>
                        {comparisonData.quotes.map((q: any) => (
                          <td key={q.quotationId} className="p-3 font-bold border-l">
                            {q.idv ? `₹${Number(q.idv).toLocaleString('en-IN')}` : '—'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-muted-foreground">NCB Slab</td>
                        {comparisonData.quotes.map((q: any) => (
                          <td key={q.quotationId} className="p-3 font-medium border-l">{q.ncbPercentage}%</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-muted-foreground">Base OD Premium</td>
                        {comparisonData.quotes.map((q: any) => (
                          <td key={q.quotationId} className="p-3 font-mono border-l">₹{Number(q.baseOdPremium || 0).toLocaleString('en-IN')}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-muted-foreground">Add-ons Premium</td>
                        {comparisonData.quotes.map((q: any) => (
                          <td key={q.quotationId} className="p-3 font-mono border-l">₹{Number(q.totalAddonsPremium || 0).toLocaleString('en-IN')}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-muted-foreground">Total Discounts</td>
                        {comparisonData.quotes.map((q: any) => (
                          <td key={q.quotationId} className="p-3 font-mono text-amber-600 border-l">-₹{Number(q.totalDiscount || 0).toLocaleString('en-IN')}</td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-muted-foreground">Statutory GST (18%)</td>
                        {comparisonData.quotes.map((q: any) => (
                          <td key={q.quotationId} className="p-3 font-mono border-l">+₹{Number(q.totalGst || 0).toLocaleString('en-IN')}</td>
                        ))}
                      </tr>
                      <tr className="bg-emerald-500/5 font-bold">
                        <td className="p-3 font-black text-foreground">Final Payable Premium</td>
                        {comparisonData.quotes.map((q: any) => (
                          <td key={q.quotationId} className="p-3 font-black text-sm text-emerald-600 dark:text-emerald-400 border-l">
                            ₹{Number(q.finalPayable || 0).toLocaleString('en-IN')}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <td className="p-3 font-semibold text-muted-foreground">Action</td>
                        {comparisonData.quotes.map((q: any) => (
                          <td key={q.quotationId} className="p-3 border-l">
                            {q.isSelected ? (
                              <span className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-500/10 text-emerald-700 text-xs font-bold border border-emerald-300">
                                <CheckCircle2 className="h-3.5 w-3.5" /> Selected Winner
                              </span>
                            ) : (
                              <button
                                onClick={() => handleSelectWinningQuote(comparisonData.caseId, q.quotationId)}
                                className="px-3.5 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs hover:bg-primary/90 transition-all shadow-sm"
                              >
                                Select This Quote
                              </button>
                            )}
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="py-12 text-center text-muted-foreground text-sm">
                  No quotes found for this comparison case. Generate another quote to compare.
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
