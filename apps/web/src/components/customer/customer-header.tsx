'use client';

import React from 'react';
import {
  User,
  Building2,
  Phone,
  MessageSquare,
  Mail,
  MapPin,
  CreditCard,
  FileCheck,
  ShieldAlert,
  UserCheck,
  Plus,
} from 'lucide-react';

interface CustomerHeaderProps {
  customer: any;
  onLaunchWizard: (wizardType: string) => void;
}

export function CustomerHeader({ customer, onLaunchWizard }: CustomerHeaderProps) {
  const isCorporate = customer?.type === 'CORPORATE';

  return (
    <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-6">
      {/* Top Banner Row */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        {/* Customer Identity */}
        <div className="flex items-center space-x-4">
          <div className="h-16 w-16 rounded-2xl bg-primary text-primary-foreground font-black text-2xl flex items-center justify-center shadow-md">
            {isCorporate ? <Building2 className="h-8 w-8" /> : customer?.name?.[0] || 'C'}
          </div>

          <div className="space-y-1">
            <div className="flex items-center space-x-2">
              <h1 className="text-xl font-extrabold tracking-tight">{customer?.name || 'Acme Logistics Pvt Ltd'}</h1>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20">
                {isCorporate ? 'CORPORATE ACCOUNT' : 'INDIVIDUAL'}
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 border border-amber-500/20">
                VIP
              </span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">
                HIGH PREMIUM
              </span>
            </div>

            <div className="flex items-center space-x-4 text-xs text-muted-foreground">
              <span>Customer ID: <strong className="text-foreground">{customer?.id || 'CUST-001928'}</strong></span>
              <span>Assigned Agent: <strong className="text-foreground">{customer?.agent || 'Rajesh Sharma'}</strong></span>
              <span>Branch: <strong className="text-foreground">{customer?.branch || 'Mumbai HQ'}</strong></span>
            </div>
          </div>
        </div>

        {/* Quick Action Side-Wizard Triggers */}
        <div className="flex flex-wrap gap-2 w-full lg:w-auto justify-end">
          <button
            onClick={() => onLaunchWizard('LEAD')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors shadow-sm"
          >
            + New Lead
          </button>
          <button
            onClick={() => onLaunchWizard('QUOTE')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors shadow-sm"
          >
            + Create Quote
          </button>
          <button
            onClick={() => onLaunchWizard('CLAIM')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border bg-background hover:bg-accent text-foreground transition-colors"
          >
            + Lodge Claim
          </button>
          <button
            onClick={() => onLaunchWizard('DOCUMENT')}
            className="px-3 py-1.5 text-xs font-semibold rounded-lg border bg-background hover:bg-accent text-foreground transition-colors"
          >
            + Upload Doc
          </button>
        </div>
      </div>

      {/* Grid Contact & Statutory Details */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 pt-3 border-t text-xs">
        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Mobile Phone</span>
          <div className="flex items-center space-x-1.5 text-foreground font-semibold">
            <Phone className="h-3.5 w-3.5 text-primary" />
            <span>{customer?.phone || '+91 98765 43210'}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">WhatsApp</span>
          <div className="flex items-center space-x-1.5 text-emerald-600 font-semibold">
            <MessageSquare className="h-3.5 w-3.5" />
            <a href={`https://wa.me/${customer?.phone}`} target="_blank" rel="noreferrer" className="hover:underline">
              Send Message
            </a>
          </div>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Email Address</span>
          <div className="flex items-center space-x-1.5 text-foreground font-semibold truncate">
            <Mail className="h-3.5 w-3.5 text-primary" />
            <span className="truncate">{customer?.email || 'contact@acme.com'}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">PAN Number</span>
          <div className="flex items-center space-x-1.5 text-foreground font-mono font-bold">
            <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{customer?.pan || 'ABCDE1234F'}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">GSTIN</span>
          <div className="flex items-center space-x-1.5 text-foreground font-mono font-bold">
            <FileCheck className="h-3.5 w-3.5 text-muted-foreground" />
            <span>{customer?.gst || '27AAAAA0000A1Z5'}</span>
          </div>
        </div>

        <div className="space-y-0.5">
          <span className="text-[10px] text-muted-foreground uppercase tracking-wider font-bold">Registered Address</span>
          <div className="flex items-center space-x-1.5 text-foreground font-semibold truncate">
            <MapPin className="h-3.5 w-3.5 text-primary" />
            <span className="truncate">{customer?.address || 'BKC, Mumbai 400051'}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
