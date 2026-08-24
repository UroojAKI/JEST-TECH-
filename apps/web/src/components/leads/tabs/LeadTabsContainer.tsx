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

  // Per-lead storage keys
  const activitiesKey = `jest_lead_activities_${leadId}`;
  const notesKey = `jest_lead_notes_${leadId}`;
  const localQuotesKey = `jest_motor_quotes_${leadId}`;

  const [activities, setActivities] = useState<FollowUpItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [motorQuotes, setMotorQuotes] = useState<SavedMotorQuote[]>([]);
  const [isLoadingQuotes, setIsLoadingQuotes] = useState(false);
  const [showMotorWizard, setShowMotorWizard] = useState(false);

  // Modal state
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);

  // Load per-lead items on mount
  useEffect(() => {
    try {
      const savedActs = localStorage.getItem(activitiesKey);
      setActivities(savedActs ? JSON.parse(savedActs) : []);
      const savedNotes = localStorage.getItem(notesKey);
      setNotes(savedNotes ? JSON.parse(savedNotes) : []);
    } catch {
      setActivities([]);
      setNotes([]);
    }
  }, [leadId, activitiesKey, notesKey]);

  // Load motor quotes: API first, then merge with localStorage
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
        }));

      // Merge with localStorage quotes (remove those already in API)
      const localRaw = JSON.parse(localStorage.getItem(localQuotesKey) || '[]');
      const apiIds = new Set(apiQuotes.map((q) => q.id));
      const localOnly = localRaw.filter((q: any) => q.id?.startsWith('local-') && !apiIds.has(q.id));

      setMotorQuotes([...apiQuotes, ...localOnly]);
    } catch {
      // Fallback to localStorage entirely
      try {
        const localRaw = JSON.parse(localStorage.getItem(localQuotesKey) || '[]');
        setMotorQuotes(localRaw);
      } catch {
        setMotorQuotes([]);
      }
    } finally {
      setIsLoadingQuotes(false);
    }
  }, [leadId, localQuotesKey]);

  useEffect(() => {
    if (activeTab === 'QUOTATIONS') {
      loadMotorQuotes();
    }
  }, [activeTab, loadMotorQuotes]);

  // Form states
  const [actType, setActType] = useState('Call');
  const [actText, setActText] = useState('');
  const [noteText, setNoteText] = useState('');

  const handleAddActivity = (e: React.FormEvent) => {
    e.preventDefault();
    if (!actText) return;
    const newAct: FollowUpItem = {
      id: `ACT-${Date.now().toString().slice(-4)}`,
      type: actType,
      text: actText,
      time: 'Just now',
      status: 'Scheduled',
    };
    const updated = [newAct, ...activities];
    setActivities(updated);
    localStorage.setItem(activitiesKey, JSON.stringify(updated));
    toast.success('Follow-up activity scheduled!');
    setActText('');
    setShowAddActivity(false);
  };

  const handleAddNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!noteText) return;
    const newNote: NoteItem = {
      id: `NOTE-${Date.now().toString().slice(-4)}`,
      author: 'Active User',
      text: noteText,
      isPinned: true,
      createdAt: 'Just now',
    };
    const updated = [newNote, ...notes];
    setNotes(updated);
    localStorage.setItem(notesKey, JSON.stringify(updated));
    toast.success('Note added to lead!');
    setNoteText('');
    setShowAddNote(false);
  };

  const handleQuoteSaved = (quote: any) => {
    setMotorQuotes((prev) => [quote, ...prev]);
    loadMotorQuotes();
  };

  const handleUploadQuote = (id: string) => {
    toast.info(`Upload PDF for quote ${id} — use the document vault above.`);
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
                  <button
                    onClick={() => setShowMotorWizard(true)}
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
                    <QuoteCard key={q.id} quote={q} onUploadQuote={handleUploadQuote} />
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
                    onClick={() => setShowMotorWizard(true)}
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
        onClose={() => setShowMotorWizard(false)}
        onSaved={handleQuoteSaved}
      />
    </>
  );
}
