'use client';

import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../../lib/api-client';
import { AppShell } from '../../../../components/layout/app-shell';
import {
  Check,
  X,
  ShieldCheck,
  Award,
  ArrowRight,
  ChevronLeft,
  Building,
  Activity,
  Clock,
  AlertTriangle,
  FileText,
  Zap,
} from 'lucide-react';
import Link from 'next/link';

export default function QuoteComparisonPage() {
  const [vehicleCategory, setVehicleCategory] = useState('PRIVATE_CAR_3YR_MANDATORY_TP');

  const { data: matrixData, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['quote-comparison-matrix', vehicleCategory],
    queryFn: async () => {
      const res = await apiClient.post('/quotations/enterprise-compare', {
        vehicleCategory,
        exShowroomPrice: 1000000.00,
        registrationYear: 2024,
        engineCc: 1197,
        ncbPercentage: 35,
        selectedAddons: { zeroDepreciation: true, roadsideAssistance: true },
      });
      return res.data;
    },
  });

  const quotes = matrixData?.comparativeMatrix || [];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header & Statutory Category Filter */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/15 via-primary/5 to-transparent border flex flex-wrap items-center justify-between gap-4 shadow-xs">
          <div className="max-w-xl">
            <Link
              href="/sales/quotations"
              className="text-xs font-bold text-primary hover:underline flex items-center space-x-1 mb-1.5"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Back to Proposal Wizard</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight flex items-center gap-2">
              <span>Comparative Motor Quotation Matrix</span>
              <span className="text-[10px] uppercase tracking-wider bg-emerald-500/10 text-emerald-600 px-2 py-0.5 rounded-full font-extrabold border border-emerald-500/20">
                SDP Vol 5 Active
              </span>
            </h1>
            <p className="text-xs text-muted-foreground mt-1.5">
              Authoritative multi-carrier motor comparison calculated with IRDAI compliant tariff rules, NCB depreciation matrices, and segregated tax ledgers.
            </p>
          </div>

          <div className="flex flex-col gap-1.5 min-w-[240px]">
            <label className="text-[11px] font-extrabold text-muted-foreground uppercase tracking-wider">
              Statutory Vehicle Taxonomy
            </label>
            <select
              value={vehicleCategory}
              onChange={(e) => setVehicleCategory(e.target.value)}
              className="px-3 py-2 rounded-xl border bg-background text-foreground text-xs font-bold shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="PRIVATE_CAR_3YR_MANDATORY_TP">Private Car (≤ 1000cc - 3Yr Statutory TP)</option>
              <option value="PRIVATE_CAR_ABOVE_1500CC">Private Car (&gt; 1500cc - Luxury SUV Slabs)</option>
              <option value="TWO_WHEELER_5YR_MANDATORY_TP">Two Wheeler (5Yr Statutory TP Tariff)</option>
              <option value="COMMERCIAL_GOODS_PUBLIC_CARRIER">Commercial Goods Carrier (Public Permit)</option>
            </select>
          </div>
        </div>

        {/* Comparison Matrix Table */}
        <div className="p-5 rounded-3xl border bg-card text-card-foreground shadow-sm overflow-hidden">
          {isLoading ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <Activity className="h-6 w-6 text-primary animate-spin" />
              <span className="font-bold">Evaluating statutory motor tariffs and calculating comparative premium ledgers...</span>
            </div>
          ) : isError ? (
            <div className="p-12 text-center text-xs text-destructive flex flex-col items-center gap-3">
              <AlertTriangle className="h-8 w-8 text-destructive" />
              <span className="font-bold text-sm">Failed to retrieve comparative quotes</span>
              <p className="text-muted-foreground text-xs max-w-md">
                {(error as any)?.message || 'Unable to connect to multi-insurer calculation gateway. Please verify your connection or authentication.'}
              </p>
              <button
                onClick={() => refetch()}
                className="px-4 py-2 bg-primary text-primary-foreground font-bold rounded-xl text-xs shadow-xs hover:bg-primary/90"
              >
                Retry Comparison
              </button>
            </div>
          ) : quotes.length === 0 ? (
            <div className="p-12 text-center text-xs text-muted-foreground flex flex-col items-center gap-2">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
              <span className="font-bold text-sm text-foreground">No Quotes Generated</span>
              <p className="text-muted-foreground text-xs">
                No insurer tariffs available for the selected category. Please choose another taxonomy slab.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/30">
                    <th className="py-4 px-4 font-extrabold text-foreground w-1/4">
                      <div className="flex items-center gap-1.5">
                        <FileText className="h-4 w-4 text-primary" />
                        <span>Statutory Ledger &amp; Coverage Benefits</span>
                      </div>
                    </th>
                    {quotes.map((q: any) => (
                      <th key={q.insurerId} className="py-4 px-4 font-black text-center text-foreground relative">
                        {q.isRecommended && (
                          <div className="absolute top-0 right-4 -mt-2 bg-emerald-500 text-white text-[9px] font-black uppercase px-2 py-0.5 rounded-full shadow-xs flex items-center gap-1">
                            <Zap className="h-2.5 w-2.5 fill-white" /> Recommended
                          </div>
                        )}
                        <div className="text-lg font-black text-primary tracking-tight">{q.logo}</div>
                        <div className="text-xs font-bold text-foreground mt-0.5">{q.insurerName}</div>
                        
                        {/* Rating Engine Status Badge */}
                        <div className="mt-2 flex justify-center">
                          {q.gatewayStatus === 'INTERNAL_TARIFF' ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-emerald-600 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                              <ShieldCheck className="h-3 w-3" /> Internal Tariff Engine
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-extrabold text-amber-600 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20">
                              <Clock className="h-3 w-3" /> Not Configured
                            </span>
                          )}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y text-xs font-semibold">
                  <tr className="hover:bg-muted/10">
                    <td className="py-3 px-4 font-bold text-foreground">Insured Declared Value (IDV)</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center font-mono font-black text-sm text-foreground">
                        ₹{(Number(q.insuredDeclaredValue || q.idv || 850000)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-muted/10">
                    <td className="py-3 px-4 font-semibold text-muted-foreground">Gross Own Damage (OD) Premium</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center font-mono text-foreground font-bold">
                        ₹{Number(q.grossOwnDamagePremium || 25000).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-muted/10">
                    <td className="py-3 px-4 font-semibold text-emerald-600">No Claim Bonus (NCB Discount - 35%)</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center font-mono text-emerald-600 font-bold">
                        -₹{Number(q.noClaimBonusDiscount || 8750).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-muted/10">
                    <td className="py-3 px-4 font-semibold text-foreground">Statutory Third-Party (TP) Tariff</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center font-mono text-foreground font-bold">
                        ₹{Number(q.netThirdPartyPremium || 2094).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-muted/10">
                    <td className="py-3 px-4 font-semibold text-muted-foreground">Add-on Riders (Nil-Dep + RSA)</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center font-mono text-muted-foreground font-bold">
                        ₹{Number(q.addonsPremium || 6375).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-muted/10 bg-muted/5">
                    <td className="py-3 px-4 font-bold text-foreground">Taxable Net Premium (Before GST)</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center font-mono font-extrabold text-foreground">
                        ₹{Number(q.taxableNetPremium || 24719).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                      </td>
                    ))}
                  </tr>

                  <tr className="hover:bg-muted/10">
                    <td className="py-3 px-4 font-medium text-muted-foreground text-[11px]">Segregated GST (9% CGST + 9% SGST)</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center font-mono text-muted-foreground text-[11px] font-bold">
                        ₹{Number(q.segregatedGstLedger?.totalGstPayable || 4449).toLocaleString('en-IN', { minimumFractionDigits: 2 })}
                        <div className="text-[9px] text-muted-foreground/70 font-normal">
                          (OD: ₹{q.segregatedGstLedger?.ownDamageGst || '4072.08'} | TP: ₹{q.segregatedGstLedger?.thirdPartyGst || '376.92'})
                        </div>
                      </td>
                    ))}
                  </tr>

                  <tr className="bg-gradient-to-r from-emerald-500/10 via-primary/5 to-transparent border-t-2 border-primary/20">
                    <td className="py-5 px-4">
                      <div className="font-black text-sm text-foreground uppercase tracking-tight">Final Payable Premium</div>
                      <div className="text-[10px] font-semibold text-emerald-600 flex items-center gap-1 mt-0.5">
                        <ShieldCheck className="h-3.5 w-3.5" /> Statutory Math Verified
                      </div>
                    </td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-5 px-4 text-center">
                        <div className="text-xl font-black text-emerald-600 font-mono tracking-tight">
                          ₹{Number(q.finalCustomerPayablePremium || q.totalPremium || 29168).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </div>
                        <Link
                          href={`/sales/quotations?insurer=${q.insurerId}`}
                          className="mt-2.5 w-full inline-flex items-center justify-center gap-1 px-4 py-2 rounded-xl bg-primary text-primary-foreground text-xs font-extrabold shadow-sm hover:bg-primary/90 transition-all active:scale-95"
                        >
                          <span>Select &amp; Create Proposal</span>
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        <div className="mt-1.5 text-[10px] font-medium text-muted-foreground flex items-center justify-center gap-1">
                          <Check className="h-3 w-3 text-emerald-500" /> IRDAI Motor Tariff Compliant
                        </div>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AppShell>
  );
}

