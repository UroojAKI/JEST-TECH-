'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useQueryClient } from '@tanstack/react-query';
import {
  X,
  UserPlus,
  FileSpreadsheet,
  ShieldCheck,
  FileText,
  UploadCloud,
  AlertTriangle,
  Loader2,
  CheckCircle,
  ExternalLink,
} from 'lucide-react';
import { ChunkedFileUploader } from '../../upload/chunked-file-uploader';
import { leadsRepository } from '../../../repositories/leads.repository';
import { claimsRepository } from '../../../repositories/claims.repository';
import { useCustomerWorkspace } from '../../../hooks/useCustomer360';
import { toast } from 'sonner';

interface SideWizardDrawerProps {
  type: string | null;
  customerId: string;
  onClose: () => void;
}

export function SideWizardDrawer({ type, customerId, onClose }: SideWizardDrawerProps) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspace } = useCustomerWorkspace(customerId);

  const [isSubmitting, setIsSubmitting] = useState(false);

  // Lead State
  const [leadForm, setLeadForm] = useState({
    title: '',
    productType: 'MOTOR_PRIVATE_CAR',
    source: 'DIRECT',
    estimatedValue: '',
    description: '',
  });

  // Claim State
  const [claimForm, setClaimForm] = useState({
    policyId: '',
    incidentDate: new Date().toISOString().split('T')[0],
    claimAmount: '',
    description: '',
  });

  if (!type) return null;

  const policies = workspace?.policies || [];
  const eligiblePolicies = policies.filter(
    (p: any) => p.status === 'ACTIVE' || p.status === 'RENEWED' || p.status === 'ISSUED'
  );

  const handleCreateLead = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leadForm.title.trim()) {
      return void toast.error('Please enter a title for the lead');
    }
    setIsSubmitting(true);
    try {
      await leadsRepository.createLead({
        contactId: customerId,
        title: leadForm.title.trim(),
        productType: leadForm.productType as any,
        source: leadForm.source as any,
        estimatedValue: leadForm.estimatedValue ? Number(leadForm.estimatedValue) : undefined,
        description: leadForm.description.trim() || undefined,
      });
      await queryClient.invalidateQueries({ queryKey: ['customer-360', customerId] });
      await queryClient.invalidateQueries({ queryKey: ['leads'] });
      await queryClient.invalidateQueries({ queryKey: ['workspace-recent-leads'] });
      await queryClient.invalidateQueries({ queryKey: ['dashboard-dynamic'] });
      toast.success('Lead created and linked to customer successfully!');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to create lead');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleLodgeClaim = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!claimForm.policyId) {
      return void toast.error('Please select an active policy for this claim');
    }
    if (!claimForm.claimAmount || Number(claimForm.claimAmount) <= 0) {
      return void toast.error('Please enter a valid claim amount');
    }
    if (!claimForm.description.trim()) {
      return void toast.error('Please enter an incident description');
    }

    const selectedPolicy = eligiblePolicies.find((p: any) => p.id === claimForm.policyId);
    if (selectedPolicy) {
      const incDate = new Date(claimForm.incidentDate);
      const effDate = new Date(selectedPolicy.effectiveDate || selectedPolicy.startDate || selectedPolicy.createdAt);
      const expDate = new Date(selectedPolicy.expiryDate || selectedPolicy.endDate || '2099-01-01');
      if (incDate < effDate || incDate > expDate) {
        return void toast.error(
          `Incident date must fall within policy coverage tenure (${effDate.toLocaleDateString('en-IN')} to ${expDate.toLocaleDateString('en-IN')})`
        );
      }
    }

    setIsSubmitting(true);
    try {
      await claimsRepository.createClaim({
        policyId: claimForm.policyId,
        contactId: customerId,
        incidentDate: claimForm.incidentDate,
        claimAmount: Number(claimForm.claimAmount),
        description: claimForm.description.trim(),
      });
      await queryClient.invalidateQueries({ queryKey: ['customer-360', customerId] });
      await queryClient.invalidateQueries({ queryKey: ['claims'] });
      toast.success('Claim reported successfully and registered in Back-Office queue');
      onClose();
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to lodge claim');
    } finally {
      setIsSubmitting(false);
    }
  };

  const titles: Record<string, { title: string; icon: React.ReactNode }> = {
    LEAD: { title: 'Create New Lead', icon: <UserPlus className="h-5 w-5 text-primary" /> },
    QUOTE: { title: 'Generate Insurance Quotation', icon: <FileSpreadsheet className="h-5 w-5 text-primary" /> },
    POLICY: { title: 'Issue Policy Workflow', icon: <ShieldCheck className="h-5 w-5 text-primary" /> },
    CLAIM: { title: 'Lodge Insurance Claim', icon: <FileText className="h-5 w-5 text-primary" /> },
    DOCUMENT: { title: 'Upload Customer Document', icon: <UploadCloud className="h-5 w-5 text-primary" /> },
  };

  const config = titles[type] || { title: 'Action Wizard', icon: null };

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-card border-l h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            {config.icon}
            <h2 className="font-bold text-base">{config.title}</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1 hover:bg-accent text-muted-foreground">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Wizard Form Body */}
        <div className="p-6 flex-1 overflow-y-auto space-y-4 text-xs">
          {type === 'DOCUMENT' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
                <span className="font-bold text-primary block">Document Upload</span>
                <p className="text-muted-foreground mt-0.5">
                  Upload customer identity proofs (Aadhaar, PAN, GST) or vehicle documents.
                </p>
              </div>
              <ChunkedFileUploader
                entityType="CONTACT"
                entityId={customerId}
                onSuccess={() => {
                  queryClient.invalidateQueries({ queryKey: ['customer-360', customerId] });
                  toast.success('Document uploaded and linked to customer profile');
                  onClose();
                }}
              />
            </div>
          )}

          {type === 'LEAD' && (
            <form onSubmit={handleCreateLead} className="space-y-4">
              <div>
                <label className="font-bold text-foreground block mb-1">
                  Lead Title <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={leadForm.title}
                  onChange={(e) => setLeadForm({ ...leadForm, title: e.target.value })}
                  placeholder="e.g. Maruti Swift Comprehensive Renewal"
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="font-bold text-foreground block mb-1">Product Line</label>
                  <select
                    value={leadForm.productType}
                    onChange={(e) => setLeadForm({ ...leadForm, productType: e.target.value })}
                    className="w-full p-2.5 rounded-lg border bg-background text-xs"
                  >
                    <option value="MOTOR_PRIVATE_CAR">Private Car</option>
                    <option value="MOTOR_TWO_WHEELER">Two Wheeler</option>
                    <option value="MOTOR_COMMERCIAL">Commercial Vehicle</option>
                    <option value="HEALTH">Health Insurance</option>
                    <option value="LIFE">Term Life</option>
                  </select>
                </div>
                <div>
                  <label className="font-bold text-foreground block mb-1">Lead Source</label>
                  <select
                    value={leadForm.source}
                    onChange={(e) => setLeadForm({ ...leadForm, source: e.target.value })}
                    className="w-full p-2.5 rounded-lg border bg-background text-xs"
                  >
                    <option value="DIRECT">Direct Customer</option>
                    <option value="REFERRAL">Referral</option>
                    <option value="INBOUND_WEB">Inbound Web</option>
                    <option value="COLD_CALL">Outbound Call</option>
                    <option value="PARTNER">Dealer / POSP</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Estimated Value (₹)</label>
                <input
                  type="number"
                  value={leadForm.estimatedValue}
                  onChange={(e) => setLeadForm({ ...leadForm, estimatedValue: e.target.value })}
                  placeholder="e.g. 25000"
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div>
                <label className="font-bold text-foreground block mb-1">Notes / Description</label>
                <textarea
                  rows={3}
                  value={leadForm.description}
                  onChange={(e) => setLeadForm({ ...leadForm, description: e.target.value })}
                  placeholder="Customer requirements, vehicle registration number, expiring insurer..."
                  className="w-full p-2.5 rounded-lg border bg-background text-xs focus:ring-1 focus:ring-primary outline-none"
                />
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {isSubmitting ? 'Creating Lead...' : 'Create Lead'}
                </button>
              </div>
            </form>
          )}

          {type === 'CLAIM' && (
            <div className="space-y-4">
              {eligiblePolicies.length === 0 ? (
                <div className="p-4 rounded-xl border border-rose-500/20 bg-rose-500/5 text-rose-600 space-y-2">
                  <div className="flex items-center gap-2 font-bold text-sm">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    No Eligible Active Policy
                  </div>
                  <p className="text-xs text-muted-foreground">
                    This customer has no eligible active or renewed insurance policy. Under IRDAI regulations, an active policy is a non-negotiable prerequisite to register a claim.
                  </p>
                </div>
              ) : (
                <form onSubmit={handleLodgeClaim} className="space-y-4">
                  <div>
                    <label className="font-bold text-foreground block mb-1">
                      Active Policy <span className="text-rose-500">*</span>
                    </label>
                    <select
                      required
                      value={claimForm.policyId}
                      onChange={(e) => setClaimForm({ ...claimForm, policyId: e.target.value })}
                      className="w-full p-2.5 rounded-lg border bg-background text-xs"
                    >
                      <option value="">Select an active policy...</option>
                      {eligiblePolicies.map((p: any) => (
                        <option key={p.id} value={p.id}>
                          {p.policyNumber} ({p.policyType || 'Policy'}) — Expires: {p.expiryDate ? new Date(p.expiryDate).toLocaleDateString('en-IN') : 'Active'}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="font-bold text-foreground block mb-1">
                        Incident Date <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="date"
                        required
                        max={new Date().toISOString().split('T')[0]}
                        value={claimForm.incidentDate}
                        onChange={(e) => setClaimForm({ ...claimForm, incidentDate: e.target.value })}
                        className="w-full p-2.5 rounded-lg border bg-background text-xs"
                      />
                    </div>
                    <div>
                      <label className="font-bold text-foreground block mb-1">
                        Estimated Loss (₹) <span className="text-rose-500">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={claimForm.claimAmount}
                        onChange={(e) => setClaimForm({ ...claimForm, claimAmount: e.target.value })}
                        placeholder="e.g. 15000"
                        className="w-full p-2.5 rounded-lg border bg-background text-xs"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="font-bold text-foreground block mb-1">
                      Incident Description <span className="text-rose-500">*</span>
                    </label>
                    <textarea
                      required
                      rows={3}
                      value={claimForm.description}
                      onChange={(e) => setClaimForm({ ...claimForm, description: e.target.value })}
                      placeholder="Describe circumstances of the accident, location, damage incurred..."
                      className="w-full p-2.5 rounded-lg border bg-background text-xs"
                    />
                  </div>

                  <div className="pt-2">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="w-full py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs shadow hover:bg-rose-700 flex items-center justify-center gap-2 disabled:opacity-50"
                    >
                      {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                      {isSubmitting ? 'Registering Claim...' : 'Lodge Claim'}
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {type === 'QUOTE' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border bg-primary/5 space-y-2">
                <h3 className="font-bold text-sm text-foreground">Launch Quotation Engine</h3>
                <p className="text-xs text-muted-foreground">
                  Generate a new motor or general quotation with pre-populated customer details.
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/sales/quotations?contactId=${customerId}&openQuote=1&type=private_car`);
                  }}
                  className="p-3 rounded-xl border bg-card hover:bg-accent text-left transition-colors"
                >
                  <div className="font-bold text-foreground">Private Car</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Comprehensive / OD / TP</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/sales/quotations?contactId=${customerId}&openQuote=1&type=bike`);
                  }}
                  className="p-3 rounded-xl border bg-card hover:bg-accent text-left transition-colors"
                >
                  <div className="font-bold text-foreground">Two Wheeler</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Scooters & Motorcycles</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/sales/quotations?contactId=${customerId}&openQuote=1&type=gcv`);
                  }}
                  className="p-3 rounded-xl border bg-card hover:bg-accent text-left transition-colors"
                >
                  <div className="font-bold text-foreground">Commercial (GCV)</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Goods Carrying Vehicles</div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    router.push(`/sales/quotations?contactId=${customerId}&openQuote=1`);
                  }}
                  className="p-3 rounded-xl border bg-card hover:bg-accent text-left transition-colors"
                >
                  <div className="font-bold text-foreground">Other Products</div>
                  <div className="text-[10px] text-muted-foreground mt-0.5">Auto, Taxi, Bus, Tractor</div>
                </button>
              </div>
            </div>
          )}

          {type === 'POLICY' && (
            <div className="space-y-4">
              <div className="p-4 rounded-xl border bg-muted/20 space-y-2 text-xs">
                <h3 className="font-bold text-sm text-foreground">Authoritative Policy Issuance</h3>
                <p className="text-muted-foreground">
                  In accordance with IRDAI compliance rules, policies cannot be fabricated directly without passing all 9 issuance gates:
                </p>
                <ul className="list-disc pl-4 space-y-1 text-muted-foreground text-[11px]">
                  <li>Approved & Accepted Quotation</li>
                  <li>Completed KYC & Mandatory Customer Details</li>
                  <li>Inspection Cleared (if break-in {'>'} 90 days)</li>
                  <li>Reconciled 100% Payment Receipt</li>
                  <li>Verified Engine & Chassis Numbers</li>
                </ul>
              </div>

              <button
                type="button"
                onClick={() => {
                  onClose();
                  router.push(`/workspace/operations`);
                }}
                className="w-full py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-xs shadow hover:bg-primary/90 flex items-center justify-center gap-1.5"
              >
                Go to Back-Office Operations Queue <ExternalLink className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
