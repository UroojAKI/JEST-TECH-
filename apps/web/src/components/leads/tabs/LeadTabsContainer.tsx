'use client';

import React, { useState, useEffect } from 'react';
import {
  Activity,
  Calendar,
  StickyNote,
  Folder,
  FileSpreadsheet,
  MessageSquare,
  GitMerge,
  Clock,
  BarChart3,
  Plus,
  Loader2,
  X,
} from 'lucide-react';
import { ChunkedFileUploader } from '../../upload/chunked-file-uploader';
import { toast } from 'sonner';
import { formatCurrency } from '../../../lib/formatters';

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

interface QuoteItem {
  id: string;
  insurer: string;
  amount: number;
  idv: string;
  status: string;
}

export function LeadTabsContainer({ leadId }: { leadId: string }) {
  const [activeTab, setActiveTab] = useState<string>('ACTIVITIES');

  // Dynamic local storage keys per lead
  const activitiesKey = `jest_lead_activities_${leadId}`;
  const notesKey = `jest_lead_notes_${leadId}`;
  const quotesKey = `jest_lead_quotes_${leadId}`;

  const [activities, setActivities] = useState<FollowUpItem[]>([]);
  const [notes, setNotes] = useState<NoteItem[]>([]);
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);

  // Modals state
  const [showAddActivity, setShowAddActivity] = useState(false);
  const [showAddNote, setShowAddNote] = useState(false);
  const [showAddQuote, setShowAddQuote] = useState(false);

  // Load per-lead items on mount
  useEffect(() => {
    try {
      const savedActs = localStorage.getItem(activitiesKey);
      setActivities(savedActs ? JSON.parse(savedActs) : []);

      const savedNotes = localStorage.getItem(notesKey);
      setNotes(savedNotes ? JSON.parse(savedNotes) : []);

      const savedQuotes = localStorage.getItem(quotesKey);
      setQuotes(savedQuotes ? JSON.parse(savedQuotes) : []);
    } catch (e) {
      setActivities([]);
      setNotes([]);
      setQuotes([]);
    }
  }, [leadId, activitiesKey, notesKey, quotesKey]);

  // Form states
  const [actType, setActType] = useState('Call');
  const [actText, setActText] = useState('');
  const [noteText, setNoteText] = useState('');
  const [quoteInsurer, setQuoteInsurer] = useState('ICICI Lombard');
  const [quoteAmount, setQuoteAmount] = useState(18500);

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

  const handleAddQuote = (e: React.FormEvent) => {
    e.preventDefault();
    const newQuote: QuoteItem = {
      id: `QT-${Date.now().toString().slice(-4)}`,
      insurer: quoteInsurer,
      amount: Number(quoteAmount),
      idv: '₹8,50,000',
      status: 'Generated',
    };
    const updated = [newQuote, ...quotes];
    setQuotes(updated);
    localStorage.setItem(quotesKey, JSON.stringify(updated));
    toast.success(`Quotation generated for ${quoteInsurer}!`);
    setShowAddQuote(false);
  };

  const tabs = [
    { id: 'OVERVIEW', label: 'Overview', icon: <Activity className="h-3.5 w-3.5" /> },
    { id: 'ACTIVITIES', label: 'Follow-ups & Activities', icon: <Calendar className="h-3.5 w-3.5" />, badge: activities.length },
    { id: 'NOTES', label: 'Notes', icon: <StickyNote className="h-3.5 w-3.5" />, badge: notes.length },
    { id: 'DOCUMENTS', label: 'Documents', icon: <Folder className="h-3.5 w-3.5" /> },
    { id: 'QUOTATIONS', label: 'Quotations', icon: <FileSpreadsheet className="h-3.5 w-3.5" />, badge: quotes.length },
    { id: 'COMMUNICATION', label: 'Communication', icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { id: 'WORKFLOW', label: 'Workflow & SLA', icon: <GitMerge className="h-3.5 w-3.5" /> },
    { id: 'TIMELINE', label: 'Timeline', icon: <Clock className="h-3.5 w-3.5" /> },
    { id: 'ANALYTICS', label: 'Analytics', icon: <BarChart3 className="h-3.5 w-3.5" /> },
  ];

  return (
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
              <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                {t.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Tab Body */}
      <div className="p-6 text-xs space-y-4">
        {activeTab === 'OVERVIEW' && (
          <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 space-y-2">
            <h4 className="font-bold text-sm text-primary">Lead Overview & Status Metrics</h4>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Lead ID</span><div className="font-bold">{leadId}</div></div>
              <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Activities Recorded</span><div className="font-bold">{activities.length}</div></div>
              <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Notes Recorded</span><div className="font-bold">{notes.length}</div></div>
              <div><span className="text-[10px] text-muted-foreground uppercase font-bold">Quotes Generated</span><div className="font-bold text-emerald-600">{quotes.length}</div></div>
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
                    <select
                      value={actType}
                      onChange={(e) => setActType(e.target.value)}
                      className="w-full p-2 rounded border bg-card text-xs"
                    >
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
                  <button
                    type="button"
                    onClick={() => setShowAddActivity(false)}
                    className="px-3 py-1.5 rounded border"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-bold">
                    Save Activity
                  </button>
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
                  <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-500/10 text-amber-600">
                    {f.status}
                  </span>
                </div>
              ))}

              {activities.length === 0 && (
                <div className="p-6 text-center text-muted-foreground border border-dashed rounded-xl">
                  No follow-up activities recorded for this lead yet. Click &quot;Schedule Follow-up&quot; above to add one.
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
              <button
                onClick={() => setShowAddNote(!showAddNote)}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center space-x-1"
              >
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
                  <button type="button" onClick={() => setShowAddNote(false)} className="px-3 py-1.5 rounded border">
                    Cancel
                  </button>
                  <button type="submit" className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-bold">
                    Save Note
                  </button>
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
                  No notes added to this lead yet. Click &quot;Add Note&quot; above to write one.
                </div>
              )}
            </div>
          </div>
        )}

        {/* QUOTATIONS TAB */}
        {activeTab === 'QUOTATIONS' && (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <h4 className="font-bold text-sm">Generated Quotations</h4>
              <button
                onClick={() => setShowAddQuote(!showAddQuote)}
                className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs flex items-center space-x-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Generate Quote</span>
              </button>
            </div>

            {showAddQuote && (
              <form onSubmit={handleAddQuote} className="p-4 rounded-xl border bg-background space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label className="font-bold block mb-1">Partner Insurer</label>
                    <select
                      value={quoteInsurer}
                      onChange={(e) => setQuoteInsurer(e.target.value)}
                      className="w-full p-2 rounded border bg-card text-xs"
                    >
                      <option value="ICICI Lombard">ICICI Lombard Motor</option>
                      <option value="HDFC ERGO">HDFC ERGO General</option>
                      <option value="Bajaj Allianz">Bajaj Allianz Insurance</option>
                      <option value="Tata AIG">Tata AIG General</option>
                      <option value="Star Health">Star Health Insurance</option>
                    </select>
                  </div>
                  <div>
                    <label className="font-bold block mb-1">Quoted Premium (₹)</label>
                    <input
                      type="number"
                      required
                      value={quoteAmount}
                      onChange={(e) => setQuoteAmount(Number(e.target.value))}
                      className="w-full p-2 rounded border bg-card text-xs"
                    />
                  </div>
                </div>
                <div className="flex justify-end space-x-2">
                  <button type="button" onClick={() => setShowAddQuote(false)} className="px-3 py-1.5 rounded border">
                    Cancel
                  </button>
                  <button type="submit" className="px-3 py-1.5 rounded bg-primary text-primary-foreground font-bold">
                    Generate Quote
                  </button>
                </div>
              </form>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {quotes.map((q) => (
                <div key={q.id} className="p-4 rounded-xl border bg-card space-y-2">
                  <div className="flex justify-between items-center">
                    <span className="font-bold text-sm">{q.insurer}</span>
                    <span className="font-bold text-emerald-600" suppressHydrationWarning>{formatCurrency(q.amount)}</span>
                  </div>
                  <p className="text-muted-foreground text-[11px]">IDV: {q.idv} • Status: {q.status}</p>
                </div>
              ))}

              {quotes.length === 0 && (
                <div className="md:col-span-2 p-6 text-center text-muted-foreground border border-dashed rounded-xl">
                  No quotations generated for this lead yet. Click &quot;Generate Quote&quot; above to compare quotes.
                </div>
              )}
            </div>
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
            Workspace Module <strong>{activeTab}</strong> for Lead ID {leadId} is ready. Click actions above to log activities.
          </div>
        )}
      </div>
    </div>
  );
}
