'use client';

import React, { useState } from 'react';
import {
  X,
  User,
  Phone,
  Mail,
  Car,
  Shield,
  FileCheck,
  Clock,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

interface Customer360DrawerProps {
  contact?: any;
  isOpen: boolean;
  onClose: () => void;
}

export function Customer360Drawer({ contact, isOpen, onClose }: Customer360DrawerProps) {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'VEHICLES' | 'POLICIES' | 'DOCS' | 'TIMELINE'>('PROFILE');

  if (!isOpen || !contact) return null;

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-xl bg-card border-l h-full shadow-2xl flex flex-col text-xs">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between bg-muted/20">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground font-black flex items-center justify-center text-sm">
              {contact.firstName?.[0] || 'C'}
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground">
                {contact.firstName} {contact.lastName}
              </h2>
              <div className="flex items-center space-x-2 text-[11px] text-muted-foreground mt-0.5">
                <span className="flex items-center space-x-1">
                  <Phone className="h-3 w-3" />
                  <span>{contact.phone || 'N/A'}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Mail className="h-3 w-3" />
                  <span>{contact.email || 'N/A'}</span>
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-lg border hover:bg-accent text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b font-semibold overflow-x-auto px-5">
          {[
            { id: 'PROFILE', label: 'Profile' },
            { id: 'VEHICLES', label: 'Vehicles' },
            { id: 'POLICIES', label: 'Policies' },
            { id: 'DOCS', label: 'Documents' },
            { id: 'TIMELINE', label: 'Timeline' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`py-3 px-3 border-b-2 font-extrabold transition-all whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="p-5 flex-1 overflow-y-auto space-y-4">
          {activeTab === 'PROFILE' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border bg-muted/10 space-y-2">
                <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
                  KYC Verification Details
                </span>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">PAN Number</span>
                    <span className="font-mono font-bold text-foreground">ABCDE1234F</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Aadhaar Number</span>
                    <span className="font-mono font-bold text-foreground">•••• •••• 8812</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Customer Type</span>
                    <span className="font-bold text-foreground">Individual</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">City / State</span>
                    <span className="font-bold text-foreground">Mumbai, MH</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl border space-y-2">
                <span className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
                  Nominee Details
                </span>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Nominee Name</span>
                    <span className="font-bold text-foreground">Sunita Khan</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Relationship</span>
                    <span className="font-bold text-foreground">Spouse</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'VEHICLES' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border bg-card flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <Car className="h-5 w-5 text-primary" />
                  <div>
                    <span className="font-mono font-bold text-primary block">MH12-AB-1234</span>
                    <span className="font-bold text-foreground">Hyundai Creta 1.5 SX Petrol</span>
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                  INSURED
                </span>
              </div>
            </div>
          )}

          {activeTab === 'POLICIES' && (
            <div className="space-y-3">
              <div className="p-3.5 rounded-xl border bg-card space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono font-bold text-primary">POL-8849102</span>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                    ACTIVE
                  </span>
                </div>
                <div className="text-xs font-bold text-foreground">HDFC ERGO • Private Car Zero Dep</div>
                <div className="text-[10px] text-muted-foreground">Expires: 14 Aug 2026 • GWP: ₹24,500</div>
              </div>
            </div>
          )}

          {activeTab === 'DOCS' && (
            <div className="space-y-2">
              {[
                { name: 'Vehicle RC Copy', status: 'VERIFIED' },
                { name: 'Customer PAN Card', status: 'VERIFIED' },
                { name: 'Aadhaar Card Copy', status: 'PENDING' },
              ].map((doc, idx) => (
                <div key={idx} className="p-3 rounded-xl border flex items-center justify-between">
                  <span className="font-bold text-foreground">{doc.name}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      doc.status === 'VERIFIED'
                        ? 'bg-emerald-500/10 text-emerald-600'
                        : 'bg-amber-500/10 text-amber-600'
                    }`}
                  >
                    {doc.status}
                  </span>
                </div>
              ))}
            </div>
          )}

          {activeTab === 'TIMELINE' && (
            <div className="space-y-3 border-l-2 border-primary/20 pl-4">
              <div className="relative">
                <div className="text-[10px] text-muted-foreground font-mono">Today, 10:15 AM</div>
                <div className="font-bold text-foreground">Outbound call logged: Customer confirmed quote acceptance</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
