'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { MessageSquare, PhoneCall, Mail, MessageCircle, FileText, Send, Download, Filter, UserCheck } from 'lucide-react';
import { useCommunications } from '../../../hooks/useCommunications';
import { toast } from 'sonner';
import { StatusBadge } from '../../../components/ui/status-badge';

export default function CommunicationHubPage() {
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');
  const [showSendForm, setShowSendForm] = useState(false);
  const [channel, setChannel] = useState('WHATSAPP');
  const [customerId, setCustomerId] = useState('');
  const [subject, setSubject] = useState('');
  const [message, setMessage] = useState('');

  const { communications, sendMessage, isSending } = useCommunications({
    channel: selectedChannel !== 'ALL' ? selectedChannel : undefined,
  });

  const filteredComms = communications.filter((c: any) => {
    if (selectedChannel === 'ALL') return true;
    return c.channel === selectedChannel;
  });

  return (
    <AppShell>
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b pb-4">
        <div>
          <h1 className="text-xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-5 w-5 text-primary" /> Omnichannel Communication Hub & Timeline
          </h1>
          <p className="text-xs text-muted-foreground">Unified customer interaction stream across WhatsApp, SMS, Email, Call Notes, and Internal Team Messages</p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => setShowSendForm(true)}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
            <span>+ Send Message</span>
          </button>
        </div>
      </div>

      {showSendForm && (
        <div className="p-4 rounded-xl border bg-card shadow-sm space-y-4 mb-4">
          <h2 className="text-sm font-bold">Send Communication</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold mb-1">Channel</label>
              <select className="w-full p-2 border rounded" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="WHATSAPP">WhatsApp</option>
                <option value="EMAIL">Email</option>
                <option value="SMS">SMS</option>
                <option value="PHONE_CALL">Phone Call</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold mb-1">Customer ID</label>
              <input type="text" className="w-full p-2 border rounded" value={customerId} onChange={(e) => setCustomerId(e.target.value)} placeholder="e.g. CUST-123" />
            </div>
            {channel === 'EMAIL' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold mb-1">Subject</label>
                <input type="text" className="w-full p-2 border rounded" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Subject..." />
              </div>
            )}
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold mb-1">Message</label>
              <textarea className="w-full p-2 border rounded" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Type your message..."></textarea>
            </div>
          </div>
          <div className="flex space-x-2">
            <button
              disabled={isSending}
              onClick={() => {
                sendMessage({ channel, customerId, subject, messageContent: message }, {
                  onSuccess: () => {
                    toast.success('Message sent!');
                    setShowSendForm(false);
                    setCustomerId('');
                    setSubject('');
                    setMessage('');
                  }
                });
              }}
              className="px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow"
            >
              {isSending ? 'Sending...' : 'Send'}
            </button>
            <button onClick={() => setShowSendForm(false)} className="px-4 py-2 text-xs font-bold rounded-lg border bg-background hover:bg-accent text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Communication Analytics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Messages Today</span>
          <div className="text-lg font-black text-foreground">{communications.length}</div>
          <span className="text-[10px] text-emerald-600 font-semibold">98.4% Delivered</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">WhatsApp Engagement</span>
          <div className="text-lg font-black text-emerald-600">84.2% Read Rate</div>
          <span className="text-[10px] text-muted-foreground font-semibold">Highest Channel</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Avg Customer Response</span>
          <div className="text-lg font-black text-primary">14 Minutes</div>
          <span className="text-[10px] text-muted-foreground font-semibold">Turnaround Speed</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Failed Deliveries</span>
          <div className="text-lg font-black text-emerald-600">0 Failed</div>
          <span className="text-[10px] text-emerald-600 font-semibold">100% Provider Health</span>
        </div>
      </div>

      {/* Channel Filters */}
      <div className="flex border-b text-xs overflow-x-auto p-1 bg-card rounded-xl border space-x-1">
        {[
          { id: 'ALL', label: 'All Channels' },
          { id: 'WHATSAPP', label: 'WhatsApp' },
          { id: 'EMAIL', label: 'Email' },
          { id: 'SMS', label: 'SMS Alerts' },
          { id: 'PHONE_CALL', label: 'Phone Calls & Notes' },
        ].map((ch) => (
          <button
            key={ch.id}
            onClick={() => setSelectedChannel(ch.id)}
            className={`px-3.5 py-2 rounded-lg font-bold transition-colors ${
              selectedChannel === ch.id
                ? 'bg-primary text-primary-foreground shadow'
                : 'text-muted-foreground hover:bg-accent hover:text-foreground'
            }`}
          >
            {ch.label}
          </button>
        ))}
      </div>

      {/* Timeline Stream */}
      <div className="space-y-3 text-xs">
        {filteredComms.map((c: any) => (
          <div key={c.id} className="p-4 rounded-xl border bg-card shadow-sm space-y-2">
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  {c.channel}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-foreground border">
                  {c.category}
                </span>
                <span className="font-bold text-foreground text-sm">{c.customerName || c.customerId}</span>
              </div>
              <span className="text-muted-foreground font-mono text-[11px]">{c.timestamp || new Date(c.createdAt).toLocaleString()}</span>
            </div>

            <p className="text-foreground text-xs leading-relaxed">{c.messageContent}</p>

            <div className="flex justify-between items-center pt-2 border-t text-[11px]">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <span>From: <strong>{c.sender}</strong></span>
                <span>To: <strong>{c.recipient || c.customerId}</strong></span>
              </div>
              <div className="flex items-center space-x-2 font-mono">
                {c.relatedEntity && <span className="text-primary font-bold">{c.relatedEntity.type} #{c.relatedEntity.number}</span>}
                <StatusBadge status={c.status} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
