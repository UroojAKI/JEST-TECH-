'use client';

import React, { useState } from 'react';
import { StepTracker } from './StepTracker';
import { useSalesWorkspace } from '../../../hooks/useSalesWorkspace';
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

  // Call & Meeting Form State
  const [callOutcome, setCallOutcome] = useState('CONNECTED');
  const [callNotes, setCallNotes] = useState('');

  // Referral Modal State
  const [showReferralModal, setShowReferralModal] = useState(false);
  const [refName, setRefName] = useState('');
  const [refPhone, setRefPhone] = useState('');
  const [refProduct, setRefProduct] = useState('MOTOR');

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

  const handleLogCall = (e: React.FormEvent) => {
    e.preventDefault();
    toast.success(`Call outcome '${callOutcome}' logged for ${contact.firstName || 'customer'}`);
    setCallNotes('');
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
        },
      }
    );
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
            </div>
          </div>
        </div>

        {/* Quick Trigger Triggers */}
        <div className="flex flex-wrap items-center gap-2">
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
          { id: 'QUOTATION', label: 'Quotation Engine' },
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
            </div>

            <div className="pt-3 border-t">
              <label className="text-[11px] font-bold text-foreground block mb-1">Lead Notes & Description</label>
              <p className="text-xs text-muted-foreground leading-relaxed bg-muted/20 p-3 rounded-xl border">
                {lead.description || 'Customer requested motor policy quotation with Zero Dep and RSA addons.'}
              </p>
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
                className="w-full py-2 rounded-xl bg-primary text-primary-foreground font-extrabold shadow-xs hover:bg-primary/90"
              >
                Log Call & Update SLA
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'CUSTOMER_360' && (
        <div className="p-5 rounded-2xl border bg-card space-y-4 text-xs">
          <h3 className="text-xs font-extrabold uppercase text-muted-foreground tracking-wider">
            Customer 360 Operational Profile
          </h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 rounded-xl bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Customer Name</span>
              <span className="font-bold text-foreground">{contact.firstName} {contact.lastName}</span>
            </div>
            <div className="p-3 rounded-xl bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Phone</span>
              <span className="font-bold text-foreground">{contact.phone || '-'}</span>
            </div>
            <div className="p-3 rounded-xl bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Email</span>
              <span className="font-bold text-foreground">{contact.email || '-'}</span>
            </div>
            <div className="p-3 rounded-xl bg-muted/20">
              <span className="text-[10px] text-muted-foreground block">Address</span>
              <span className="font-bold text-foreground">Mumbai, Maharashtra</span>
            </div>
          </div>
        </div>
      )}

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
