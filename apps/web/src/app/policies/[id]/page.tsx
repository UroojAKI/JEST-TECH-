'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { AppShell } from '../../../components/layout/app-shell';
import { StatusBadge } from '../../../components/ui/status-badge';
import {
  ShieldCheck,
  RefreshCw,
  FileText,
  Clock,
  DollarSign,
  AlertTriangle,
  ChevronRight,
  Plus,
  Folder,
  Car,
  CheckCircle2,
  Calendar,
  User,
  CreditCard,
  FileCheck,
  ExternalLink,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { policiesRepository } from '../../../repositories/policies.repository';
import { RenewalWizardDrawer } from '../../../components/policies/drawers/RenewalWizardDrawer';
import { EndorsementRequestDrawer } from '../../../components/policies/drawers/EndorsementRequestDrawer';

export default function PolicyWorkspacePage() {
  const params = useParams();
  const router = useRouter();
  const policyId = (params?.id as string) || '';

  const [isRenewalOpen, setIsRenewalOpen] = useState(false);
  const [isEndorsementOpen, setIsEndorsementOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('OVERVIEW');

  const { data: policyData, isLoading, isError } = useQuery({
    queryKey: ['policy-workspace', policyId],
    queryFn: () => policiesRepository.getPolicyWorkspace(policyId),
    enabled: !!policyId,
  });

  const displayPolicyNumber = policyData?.policyNumber || (isLoading ? 'Loading...' : policyId || 'Not Recorded');
  const displayStatus = policyData?.status || 'ACTIVE';
  const displayCustomer = policyData?.customerName || policyData?.contactName || 'Not Recorded';
  const displayCustomerPhone = policyData?.contactPhone || '—';
  const displayCustomerEmail = policyData?.contactEmail || '—';
  const displayInsurer = policyData?.insurerName || 'Not Recorded';
  const displayExecutive = policyData?.renewalExecutive || 'Assigned Officer';
  const displayProductLine = policyData?.productLine || 'MOTOR COMPREHENSIVE';

  const totalPrem = Number(policyData?.totalPremium ?? policyData?.premiumAmount ?? 0);
  const paidAmount = Number(policyData?.paidAmount ?? (policyData?.paymentStatus === 'PAID' ? totalPrem : 0));
  const outstandingBal = Number(policyData?.outstandingBalance ?? Math.max(0, totalPrem - paidAmount));
  const paymentStatus = policyData?.paymentStatus || (outstandingBal <= 0 && totalPrem > 0 ? 'PAID' : 'PENDING');

  const expiryDate = policyData?.expiryDate ? new Date(policyData.expiryDate) : null;
  const daysRemaining = expiryDate
    ? Math.ceil((expiryDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null;

  const claimsList = policyData?.claims || [];
  const claimsCount = policyData?.claimsCount ?? claimsList.length;
  const endorsementsList = policyData?.endorsements || [];
  const paymentsList = policyData?.payments || [];
  const documentsList = policyData?.documents || [];
  const historiesList = policyData?.histories || [];

  return (
    <AppShell>
      {/* 1. Header & Policy Stepper */}
      <div className="rounded-2xl border bg-card p-6 shadow-sm space-y-4">
        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
          <div className="space-y-1">
            <div className="flex items-center space-x-3 flex-wrap gap-y-1">
              <h1 className="text-xl font-extrabold tracking-tight font-mono">
                {displayPolicyNumber}
              </h1>
              <StatusBadge status={displayStatus} />
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-primary/10 text-primary border border-primary/20 uppercase">
                {displayProductLine}
              </span>
            </div>
            <div className="flex items-center space-x-4 text-xs text-muted-foreground flex-wrap gap-y-1 pt-1">
              <span>Customer: <strong className="text-foreground">{displayCustomer}</strong></span>
              <span>Insurer: <strong className="text-foreground">{displayInsurer}</strong></span>
              <span>Renewal Officer: <strong className="text-foreground">{displayExecutive}</strong></span>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => setIsEndorsementOpen(true)}
              className="flex items-center space-x-1 px-3 py-2 text-xs font-semibold rounded-lg border bg-background hover:bg-accent text-foreground transition-colors"
            >
              <FileText className="h-4 w-4" />
              <span>+ Endorsement</span>
            </button>
            <button
              onClick={() => setIsRenewalOpen(true)}
              className="flex items-center space-x-1 px-4 py-2 text-xs font-bold rounded-lg bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm"
            >
              <RefreshCw className="h-4 w-4" />
              <span>Launch Renewal Wizard →</span>
            </button>
          </div>
        </div>

        {/* Lifecycle Stepper */}
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2 text-center pt-2 text-xs border-t">
          {[
            { label: 'Issued', done: true },
            { label: 'Active', done: displayStatus === 'ACTIVE' || displayStatus === 'RENEWAL_DUE', current: displayStatus === 'ACTIVE' },
            { label: 'Endorsements', done: endorsementsList.length > 0 },
            { label: 'Renewal Window', done: daysRemaining !== null && daysRemaining <= 60, current: displayStatus === 'RENEWAL_DUE' || (daysRemaining !== null && daysRemaining <= 30 && daysRemaining > 0) },
            { label: 'Grace Period', done: displayStatus === 'GRACE_PERIOD', current: displayStatus === 'GRACE_PERIOD' },
            { label: 'Expired', done: displayStatus === 'EXPIRED' || (daysRemaining !== null && daysRemaining < 0), current: displayStatus === 'EXPIRED' },
            { label: 'Archived', done: displayStatus === 'CANCELLED' },
          ].map((stage) => (
            <div
              key={stage.label}
              className={`p-2 rounded-lg border flex flex-col items-center space-y-0.5 ${
                stage.current
                  ? 'border-primary/40 bg-primary/10 text-primary font-bold'
                  : stage.done
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-600 font-semibold'
                  : 'bg-muted/20 text-muted-foreground'
              }`}
            >
              <span className="text-[10px]">{stage.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Real Financial & Vehicle Snapshot */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Coverage & Premium Financial Snapshot */}
        <div className="lg:col-span-6 rounded-2xl border bg-card p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-4 w-4 text-emerald-600" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Premium & Settlement Snapshot</h3>
            </div>
            <span className={`text-xs font-black px-2 py-0.5 rounded-full border ${
              paymentStatus === 'PAID'
                ? 'text-emerald-600 bg-emerald-500/10 border-emerald-500/20'
                : 'text-amber-600 bg-amber-500/10 border-amber-500/20'
            }`}>
              {paymentStatus}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs pt-1">
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground block">Total Premium</span>
              <div className="font-bold text-foreground text-sm">
                ₹{totalPrem.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground block">Paid Amount</span>
              <div className="font-bold text-emerald-600 text-sm">
                ₹{paidAmount.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground block">Balance Due</span>
              <div className="font-bold text-foreground text-sm">
                ₹{outstandingBal.toLocaleString('en-IN')}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground block">Insured Value (IDV)</span>
              <div className="font-bold text-foreground text-sm">
                {policyData?.idvValue ? `₹${policyData.idvValue.toLocaleString('en-IN')}` : '—'}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="p-2 rounded-lg border bg-card">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Own Damage (OD) Cover</span>
              <span className="font-medium text-foreground">
                {policyData?.odStartDate
                  ? `${new Date(policyData.odStartDate).toLocaleDateString('en-IN')} to ${new Date(policyData.odExpiryDate || policyData.endDate || policyData.expiryDate || '').toLocaleDateString('en-IN')}`
                  : policyData?.startDate
                  ? `${new Date(policyData.startDate).toLocaleDateString('en-IN')} to ${new Date(policyData.expiryDate || policyData.endDate || '').toLocaleDateString('en-IN')}`
                  : 'Not Recorded'}
              </span>
            </div>
            <div className="p-2 rounded-lg border bg-card">
              <span className="text-[10px] text-muted-foreground uppercase font-bold block">Third Party (TP) Cover</span>
              <span className="font-medium text-foreground">
                {policyData?.tpStartDate
                  ? `${new Date(policyData.tpStartDate).toLocaleDateString('en-IN')} to ${new Date(policyData.tpExpiryDate || policyData.endDate || policyData.expiryDate || '').toLocaleDateString('en-IN')}`
                  : 'Not Recorded'}
              </span>
            </div>
          </div>
        </div>

        {/* Vehicle & Risk Profile Card */}
        <div className="lg:col-span-6 rounded-2xl border bg-card p-4 shadow-sm space-y-3">
          <div className="flex justify-between items-center border-b pb-2">
            <div className="flex items-center space-x-2">
              <Car className="h-4 w-4 text-primary" />
              <h3 className="text-xs font-bold uppercase tracking-wider">Vehicle & Policy Risk Profile</h3>
            </div>
            <span className="text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full border border-primary/20 font-mono">
              {policyData?.vehicle?.registrationNumber || 'NO PLATE RECORDED'}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs pt-1">
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground block">Make / Model</span>
              <div className="font-bold text-foreground truncate">
                {policyData?.vehicle?.makeModel || 'Motor Vehicle'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground block">Fuel / Category</span>
              <div className="font-semibold text-foreground">
                {[policyData?.vehicle?.fuelType, policyData?.vehicle?.category].filter(Boolean).join(' • ') || '—'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground block">Engine / Chassis</span>
              <div className="font-mono text-[11px] text-foreground truncate">
                {[policyData?.vehicle?.engineNumber, policyData?.vehicle?.chassisNumber].filter(Boolean).join(' / ') || '—'}
              </div>
            </div>
            <div className="p-2.5 rounded-lg bg-muted/20 border">
              <span className="text-[10px] text-muted-foreground block">RTO Jurisdiction</span>
              <div className="font-semibold text-foreground">
                {policyData?.vehicle?.rtoLocation || '—'}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between text-xs text-muted-foreground pt-1 border-t">
            <span>Historical Claims: <strong className="text-foreground">{claimsCount} Claim(s)</strong></span>
            <span>
              Renewal Window: <strong className="text-foreground">
                {daysRemaining !== null
                  ? daysRemaining > 0
                    ? `${daysRemaining} Days Remaining`
                    : 'Expired'
                  : '—'}
              </strong>
            </span>
          </div>
        </div>
      </div>

      {/* 3. Authoritative Workspace Tabs Container */}
      <div className="rounded-2xl border bg-card shadow-sm overflow-hidden">
        <div className="flex border-b text-xs overflow-x-auto p-1.5 bg-muted/20 space-x-1">
          {[
            { id: 'OVERVIEW', label: 'Overview' },
            { id: 'ENDORSEMENTS', label: 'Endorsements', badge: endorsementsList.length },
            { id: 'CLAIMS', label: 'Claims History', badge: claimsCount },
            { id: 'DOCUMENTS', label: 'Foldered Documents', badge: documentsList.length },
            { id: 'PAYMENTS', label: 'Payments Ledger', badge: paymentsList.length },
            { id: 'TIMELINE', label: 'Operational Timeline', badge: historiesList.length },
          ].map((t) => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex items-center space-x-1.5 px-3 py-2 rounded-lg font-semibold whitespace-nowrap transition-colors ${
                activeTab === t.id
                  ? 'bg-background shadow text-primary font-bold'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              <span>{t.label}</span>
              {t.badge !== undefined && t.badge > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-primary/10 text-primary font-bold">
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="p-6 text-xs space-y-4">
          {/* TAB 1: OVERVIEW */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <h4 className="font-bold text-sm flex items-center gap-1.5 text-foreground">
                    <User className="h-4 w-4 text-primary" />
                    Customer & Insured Party
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div><span className="text-muted-foreground">Full Name:</span> <strong>{displayCustomer}</strong></div>
                    <div><span className="text-muted-foreground">Phone:</span> <strong>{displayCustomerPhone}</strong></div>
                    <div><span className="text-muted-foreground">Email:</span> <strong>{displayCustomerEmail}</strong></div>
                    {policyData?.customerId && (
                      <button
                        onClick={() => router.push(`/crm/customers/${policyData.customerId}`)}
                        className="mt-2 text-primary font-bold inline-flex items-center gap-1 hover:underline text-[11px]"
                      >
                        <span>View Customer 360 Record</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    )}
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <h4 className="font-bold text-sm flex items-center gap-1.5 text-foreground">
                    <ShieldCheck className="h-4 w-4 text-emerald-600" />
                    Carrier & Policy Contract
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div><span className="text-muted-foreground">Underwriting Carrier:</span> <strong>{displayInsurer}</strong></div>
                    <div><span className="text-muted-foreground">Product Type:</span> <strong>{displayProductLine}</strong></div>
                    <div><span className="text-muted-foreground">Policy Status:</span> <strong>{displayStatus}</strong></div>
                    <div><span className="text-muted-foreground">Contract Number:</span> <strong className="font-mono">{displayPolicyNumber}</strong></div>
                  </div>
                </div>

                <div className="p-4 rounded-xl border bg-card space-y-3">
                  <h4 className="font-bold text-sm flex items-center gap-1.5 text-foreground">
                    <Calendar className="h-4 w-4 text-primary" />
                    Effective Coverage Dates
                  </h4>
                  <div className="space-y-1.5 text-xs">
                    <div>
                      <span className="text-muted-foreground">Policy Inception:</span>{' '}
                      <strong>{policyData?.startDate ? new Date(policyData.startDate).toLocaleDateString('en-IN') : '—'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Policy Expiry:</span>{' '}
                      <strong>{policyData?.expiryDate ? new Date(policyData.expiryDate).toLocaleDateString('en-IN') : '—'}</strong>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Days Remaining:</span>{' '}
                      <strong>{daysRemaining !== null ? (daysRemaining > 0 ? `${daysRemaining} days` : 'Expired') : '—'}</strong>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: ENDORSEMENTS */}
          {activeTab === 'ENDORSEMENTS' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm">Active Servicing & Endorsement Requests</h4>
                <button
                  onClick={() => setIsEndorsementOpen(true)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs"
                >
                  + Request Endorsement
                </button>
              </div>

              {endorsementsList.length > 0 ? (
                endorsementsList.map((endorsement: any) => (
                  <div key={endorsement.id} className="p-4 rounded-xl border bg-card space-y-2">
                    <div className="flex justify-between items-center">
                      <div className="font-bold text-sm">
                        {endorsement.endorsementNumber || endorsement.type || 'POLICY_MODIFICATION'}
                      </div>
                      <StatusBadge status={endorsement.status || 'PENDING'} />
                    </div>
                    <p className="text-muted-foreground text-xs">
                      {endorsement.description || endorsement.reason || 'Endorsement in progress.'}
                    </p>
                    <span className="text-[10px] text-muted-foreground block">
                      Requested: {new Date(endorsement.createdAt).toLocaleDateString('en-IN')}
                    </span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground rounded-xl border border-dashed">
                  No active endorsement requests filed for this policy.
                </div>
              )}
            </div>
          )}

          {/* TAB 3: CLAIMS */}
          {activeTab === 'CLAIMS' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm">Policy Claims History</h4>
                <button
                  onClick={() => router.push(`/claims/new?policyId=${policyId}`)}
                  className="px-3 py-1.5 rounded-lg bg-primary text-primary-foreground font-bold text-xs"
                >
                  + Register Claim
                </button>
              </div>

              {claimsList.length > 0 ? (
                claimsList.map((c: any) => (
                  <div key={c.id} className="p-4 rounded-xl border bg-card flex items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-sm">{c.claimNumber}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {c.description || 'Motor Claim'} • Incident Date:{' '}
                        {c.incidentDate ? new Date(c.incidentDate).toLocaleDateString('en-IN') : '—'}
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="text-[10px] text-muted-foreground block uppercase">Claim Amount</span>
                      <span className="font-bold text-sm">
                        ₹{Number(c.claimAmount || 0).toLocaleString('en-IN')}
                      </span>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground rounded-xl border border-dashed">
                  Zero claims filed under this policy contract.
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DOCUMENTS */}
          {activeTab === 'DOCUMENTS' && (
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <h4 className="font-bold text-sm">Foldered Policy Documents</h4>
              </div>

              {documentsList.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {documentsList.map((doc: any) => (
                    <div key={doc.id} className="p-4 rounded-xl border bg-card flex items-center space-x-3">
                      <FileCheck className="h-6 w-6 text-emerald-600 shrink-0" />
                      <div className="truncate flex-1">
                        <div className="font-bold text-xs truncate">{doc.fileName || doc.documentType || 'Document'}</div>
                        <span className="text-[10px] text-muted-foreground block">
                          {doc.documentType} • {new Date(doc.createdAt).toLocaleDateString('en-IN')}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground rounded-xl border border-dashed">
                  No documents currently stored in this policy vault.
                </div>
              )}
            </div>
          )}

          {/* TAB 5: PAYMENTS */}
          {activeTab === 'PAYMENTS' && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Authoritative Payments Ledger</h4>

              {paymentsList.length > 0 ? (
                <div className="rounded-xl border overflow-hidden">
                  <table className="w-full text-xs text-left">
                    <thead className="bg-muted/50 border-b font-semibold text-muted-foreground">
                      <tr>
                        <th className="p-3">Reference / Txn ID</th>
                        <th className="p-3">Amount</th>
                        <th className="p-3">Payment Method</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Date</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {paymentsList.map((pay: any) => (
                        <tr key={pay.id} className="hover:bg-muted/20">
                          <td className="p-3 font-mono font-bold">{pay.transactionId || pay.id.substring(0, 8)}</td>
                          <td className="p-3 font-bold text-emerald-600">₹{Number(pay.amount).toLocaleString('en-IN')}</td>
                          <td className="p-3">{pay.paymentMethod || 'ONLINE'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded text-[10px] font-bold uppercase bg-emerald-500/10 text-emerald-600">
                              {pay.status || 'PAID'}
                            </span>
                          </td>
                          <td className="p-3 text-muted-foreground">
                            {pay.paymentDate ? new Date(pay.paymentDate).toLocaleDateString('en-IN') : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground rounded-xl border border-dashed">
                  {totalPrem > 0 && paymentStatus === 'PAID'
                    ? `Payment of ₹${totalPrem.toLocaleString('en-IN')} reconciled with authoritative invoice record.`
                    : 'No direct payment allocations recorded yet.'}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: TIMELINE */}
          {activeTab === 'TIMELINE' && (
            <div className="space-y-3">
              <h4 className="font-bold text-sm">Operational Lifecycle Timeline</h4>

              {historiesList.length > 0 ? (
                <div className="space-y-3 relative before:absolute before:inset-0 before:left-3.5 before:w-0.5 before:bg-border">
                  {historiesList.map((h: any) => (
                    <div key={h.id} className="relative flex items-start space-x-3 pl-8">
                      <div className="absolute left-2 top-1 h-3 w-3 rounded-full bg-primary ring-4 ring-background" />
                      <div className="p-3 rounded-xl border bg-card flex-1 space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-xs uppercase text-primary">{h.status}</span>
                          <span className="text-[10px] text-muted-foreground">
                            {new Date(h.createdAt).toLocaleString('en-IN')}
                          </span>
                        </div>
                        {h.comments && <p className="text-xs text-muted-foreground">{h.comments}</p>}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-muted-foreground rounded-xl border border-dashed">
                  Policy created on {policyData?.createdAt ? new Date(policyData.createdAt).toLocaleDateString('en-IN') : '—'}.
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Drawers */}
      <RenewalWizardDrawer
        isOpen={isRenewalOpen}
        policyId={policyId}
        onClose={() => setIsRenewalOpen(false)}
      />

      <EndorsementRequestDrawer
        isOpen={isEndorsementOpen}
        policyId={policyId}
        onClose={() => setIsEndorsementOpen(false)}
      />
    </AppShell>
  );
}
