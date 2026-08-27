'use client';

import React, { useState } from 'react';
import {
  X,
  Phone,
  Mail,
  Car,
  Shield,
  FileText,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { useCustomerWorkspace } from '../../../hooks/useCustomer360';

interface Customer360DrawerProps {
  contact?: any;
  isOpen: boolean;
  onClose: () => void;
}

export function Customer360Drawer({ contact, isOpen, onClose }: Customer360DrawerProps) {
  const [activeTab, setActiveTab] = useState<'PROFILE' | 'VEHICLES' | 'POLICIES' | 'CLAIMS' | 'TIMELINE'>('PROFILE');

  const { workspace, isLoading } = useCustomerWorkspace(isOpen && contact?.id ? contact.id : '');

  if (!isOpen || !contact) return null;

  const data = workspace || {};
  const profile = data.profile || contact;
  const analytics = data.analytics || {};
  const vehicles = data.vehicles || [];
  const policies = data.policies || [];
  const claims = data.claims || [];
  const timeline = data.timeline || [];

  return (
    <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-xs flex justify-end">
      <div className="w-full max-w-xl bg-card border-l h-full shadow-2xl flex flex-col text-xs">
        {/* Header */}
        <div className="p-5 border-b flex items-center justify-between bg-muted/20">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-xl bg-primary text-primary-foreground font-black flex items-center justify-center text-sm">
              {profile.firstName?.[0] || 'C'}
            </div>
            <div>
              <h2 className="text-sm font-extrabold text-foreground">
                {profile.firstName} {profile.lastName}
              </h2>
              <div className="flex items-center space-x-2 text-[11px] text-muted-foreground mt-0.5">
                <span className="flex items-center space-x-1">
                  <Phone className="h-3 w-3" />
                  <span>{profile.phone || 'N/A'}</span>
                </span>
                <span className="flex items-center space-x-1">
                  <Mail className="h-3 w-3" />
                  <span>{profile.email || 'N/A'}</span>
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

        {/* Lifetime Value / Summary Ribbon */}
        <div className="grid grid-cols-3 gap-2 px-5 py-3 border-b bg-muted/10">
          <div className="p-2 rounded-lg bg-card border">
            <span className="text-[10px] text-muted-foreground block font-medium">Active Policies</span>
            <span className="text-sm font-black text-foreground">{analytics.activePoliciesCount ?? policies.filter((p: any) => p.status === 'ACTIVE').length}</span>
          </div>
          <div className="p-2 rounded-lg bg-card border">
            <span className="text-[10px] text-muted-foreground block font-medium">Total Premium</span>
            <span className="text-sm font-black text-emerald-600">
              ₹{(analytics.totalPremiumPaid || 0).toLocaleString('en-IN')}
            </span>
          </div>
          <div className="p-2 rounded-lg bg-card border">
            <span className="text-[10px] text-muted-foreground block font-medium">Open Claims</span>
            <span className="text-sm font-black text-amber-600">{analytics.openClaimsCount ?? claims.filter((c: any) => c.status !== 'SETTLED').length}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b font-semibold overflow-x-auto px-5">
          {[
            { id: 'PROFILE', label: 'Profile' },
            { id: 'VEHICLES', label: `Vehicles (${vehicles.length})` },
            { id: 'POLICIES', label: `Policies (${policies.length})` },
            { id: 'CLAIMS', label: `Claims (${claims.length})` },
            { id: 'TIMELINE', label: `Timeline (${timeline.length})` },
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
          {isLoading && (
            <div className="flex items-center justify-center py-12 text-muted-foreground space-x-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span>Loading Customer 360 profile...</span>
            </div>
          )}

          {!isLoading && activeTab === 'PROFILE' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border bg-muted/10 space-y-2">
                <span className="text-[10px] font-bold uppercase text-primary tracking-wider">
                  KYC & Identification
                </span>
                <div className="grid grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-muted-foreground block text-[10px]">PAN Number</span>
                    <span className="font-mono font-bold text-foreground">{profile.panNumber || 'Not Provided'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Aadhaar Number</span>
                    <span className="font-mono font-bold text-foreground">{profile.aadhaarNumber || 'Not Provided'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">Customer Type</span>
                    <span className="font-bold text-foreground">{profile.type || 'INDIVIDUAL'}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[10px]">City / State</span>
                    <span className="font-bold text-foreground">{profile.city || 'Mumbai'}, {profile.state || 'MH'}</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {!isLoading && activeTab === 'VEHICLES' && (
            <div className="space-y-3">
              {vehicles.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No vehicles registered for this customer.</div>
              ) : (
                vehicles.map((v: any, idx: number) => (
                  <div key={idx} className="p-3.5 rounded-xl border bg-card flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Car className="h-5 w-5 text-primary" />
                      <div>
                        <span className="font-mono font-bold text-primary block">{v.registrationNumber}</span>
                        <span className="font-bold text-foreground">{v.make} {v.model}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600">
                      {v.status || 'INSURED'}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {!isLoading && activeTab === 'POLICIES' && (
            <div className="space-y-3">
              {policies.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No policies issued yet.</div>
              ) : (
                policies.map((p: any) => (
                  <div key={p.id} className="p-3.5 rounded-xl border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-primary">{p.policyNumber}</span>
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.status === 'ACTIVE'
                            ? 'bg-emerald-500/10 text-emerald-600'
                            : 'bg-muted text-muted-foreground'
                        }`}
                      >
                        {p.status}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-foreground">{p.policyType || 'Comprehensive Policy'}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Expires: {p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('en-IN') : 'N/A'} • Premium: ₹{Number(p.premiumAmount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!isLoading && activeTab === 'CLAIMS' && (
            <div className="space-y-3">
              {claims.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">No claims filed.</div>
              ) : (
                claims.map((c: any) => (
                  <div key={c.id} className="p-3.5 rounded-xl border bg-card space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-mono font-bold text-primary">{c.claimNumber}</span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600">
                        {c.status}
                      </span>
                    </div>
                    <div className="text-xs font-bold text-foreground">Incident: {c.incidentDescription || 'Motor Claim'}</div>
                    <div className="text-[10px] text-muted-foreground">
                      Claimed: ₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}

          {!isLoading && activeTab === 'TIMELINE' && (
            <div className="space-y-3 border-l-2 border-primary/20 pl-4">
              {timeline.length === 0 ? (
                <div className="text-muted-foreground py-4">No recent activity.</div>
              ) : (
                timeline.map((item: any, idx: number) => (
                  <div key={idx} className="relative pb-2">
                    <div className="text-[10px] text-muted-foreground font-mono">
                      {new Date(item.date).toLocaleDateString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                    </div>
                    <div className="font-bold text-foreground">{item.title}</div>
                    {item.description && (
                      <div className="text-[11px] text-muted-foreground mt-0.5">{item.description}</div>
                    )}
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
