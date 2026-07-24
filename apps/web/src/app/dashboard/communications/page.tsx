'use client';

import React, { useState } from 'react';
import { AppShell } from '../../../components/layout/app-shell';
import { MessageSquare, PhoneCall, Mail, MessageCircle, FileText, Send, Download, Filter, UserCheck } from 'lucide-react';
import { useCommunications } from '../../../hooks/useCommunications';
import { StatusBadge } from '../../../components/ui/status-badge';

const MOCK_COMMS = [
  {
    id: 'COMM-881',
    customerName: 'Rahul Patil',
    customerId: 'CUST-00104',
    channel: 'WHATSAPP',
    direction: 'OUTBOUND',
    category: 'SYSTEM_GENERATED',
    sender: 'JEST Policy Bot',
    recipient: '+91 98201 12345',
    messageContent: 'Dear Rahul Patil, your Motor Policy POL-001048 has been issued! Total Premium: ₹16,545.',
    status: 'READ',
    relatedEntity: { type: 'POLICY', number: 'POL-001048' },
    timestamp: '2026-07-24 10:15 IST',
  },
  {
    id: 'COMM-882',
    customerName: 'Acme Logistics Pvt Ltd',
    customerId: 'CUST-00105',
    channel: 'EMAIL',
    direction: 'INBOUND',
    category: 'CUSTOMER_REPLY',
    sender: 'claims@acmelogistics.com',
    recipient: 'support@jest.com',
    messageContent: 'Re: Claim CLM-2026-0042. Attaching surveyor inspection report and workshop invoice.',
    status: 'DELIVERED',
    relatedEntity: { type: 'CLAIM', number: 'CLM-2026-0042' },
    timestamp: '2026-07-24 09:30 IST',
  },
  {
    id: 'COMM-883',
    customerName: 'Sunita Kulkarni',
    customerId: 'CUST-00106',
    channel: 'PHONE_CALL',
    direction: 'OUTBOUND',
    category: 'MANUAL',
    sender: 'Rajesh Sharma (Sales Agent)',
    recipient: '+91 98920 54321',
    messageContent: 'Call Note: Discussed Health Optima policy renewal. Customer requested quote recalculation with ₹10L sum insured.',
    status: 'DELIVERED',
    relatedEntity: { type: 'RENEWAL', number: 'POL-001050' },
    timestamp: '2026-07-23 16:45 IST',
  },
];

export default function CommunicationHubPage() {
  const [selectedChannel, setSelectedChannel] = useState<string>('ALL');

  const filteredComms = MOCK_COMMS.filter((c) => {
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
            onClick={() => alert('Opening Send Communication Drawer...')}
            className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-primary text-primary-foreground shadow hover:bg-primary/90"
          >
            <Send className="h-4 w-4" />
            <span>+ Send Message</span>
          </button>
        </div>
      </div>

      {/* Communication Analytics Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
        <div className="p-3.5 rounded-xl border bg-card space-y-1">
          <span className="text-[10px] font-bold text-muted-foreground uppercase">Messages Today</span>
          <div className="text-lg font-black text-foreground">1,480</div>
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
        {filteredComms.map((c) => (
          <div key={c.id} className="p-4 rounded-xl border bg-card shadow-sm space-y-2">
            <div className="flex justify-between items-center border-b pb-2">
              <div className="flex items-center space-x-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                  {c.channel}
                </span>
                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-muted text-foreground border">
                  {c.category}
                </span>
                <span className="font-bold text-foreground text-sm">{c.customerName}</span>
              </div>
              <span className="text-muted-foreground font-mono text-[11px]">{c.timestamp}</span>
            </div>

            <p className="text-foreground text-xs leading-relaxed">{c.messageContent}</p>

            <div className="flex justify-between items-center pt-2 border-t text-[11px]">
              <div className="flex items-center space-x-2 text-muted-foreground">
                <span>From: <strong>{c.sender}</strong></span>
                <span>To: <strong>{c.recipient}</strong></span>
              </div>
              <div className="flex items-center space-x-2 font-mono">
                <span className="text-primary font-bold">{c.relatedEntity.type} #{c.relatedEntity.number}</span>
                <StatusBadge status={c.status} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </AppShell>
  );
}
