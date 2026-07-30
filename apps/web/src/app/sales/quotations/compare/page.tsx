'use client';

import React from 'react';
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
} from 'lucide-react';
import Link from 'next/link';

export default function QuoteComparisonPage() {
  const { data: matrixData, isLoading } = useQuery({
    queryKey: ['quote-comparison-matrix'],
    queryFn: async () => {
      const res = await apiClient.post('/quotations/calculate', {
        coverType: 'COMPREHENSIVE',
        exShowroomPrice: 1000000,
        registrationYear: 2024,
        engineCc: 1197,
        ncbPercentage: 35,
        selectedAddons: { zeroDepreciation: true, roadsideAssistance: true },
      });
      return res.data;
    },
  });

  const quotes = matrixData?.comparativeQuotes || [
    { insurerId: 'hdfc', insurerName: 'HDFC ERGO', logo: 'HDFC', totalPremium: 18500, idv: 850000, ncbDiscount: 2450, zeroDep: true, engineProtect: true, rsa: true, claimRatio: '98.5%' },
    { insurerId: 'icici', insurerName: 'ICICI Lombard', logo: 'ICICI', totalPremium: 18900, idv: 850000, ncbDiscount: 2450, zeroDep: true, engineProtect: false, rsa: true, claimRatio: '97.8%' },
    { insurerId: 'bajaj', insurerName: 'Bajaj Allianz', logo: 'BAJAJ', totalPremium: 17800, idv: 820000, ncbDiscount: 2450, zeroDep: false, engineProtect: true, rsa: true, claimRatio: '96.5%' },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        {/* Header */}
        <div className="p-6 rounded-3xl bg-gradient-to-r from-primary/10 via-primary/5 to-transparent border flex flex-wrap items-center justify-between gap-4">
          <div>
            <Link
              href="/sales/quotations"
              className="text-xs font-bold text-primary hover:underline flex items-center space-x-1 mb-1"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Back to Proposal Wizard</span>
            </Link>
            <h1 className="text-xl sm:text-2xl font-black text-foreground tracking-tight">
              Side-by-Side Quotation Comparison Matrix
            </h1>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl">
              Compare premiums, IDV boundaries, add-on coverage benefits, and claim settlement ratios across partner insurers.
            </p>
          </div>
        </div>

        {/* Comparison Matrix Table */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs overflow-hidden">
          {isLoading ? (
            <div className="p-8 text-center text-xs text-muted-foreground animate-pulse">
              Evaluating side-by-side comparison matrix...
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="border-b bg-muted/20">
                    <th className="py-4 px-4 font-extrabold text-foreground w-1/4">Feature / Benefit</th>
                    {quotes.map((q: any) => (
                      <th key={q.insurerId} className="py-4 px-4 font-black text-center text-foreground">
                        <div className="text-base font-black text-primary">{q.logo}</div>
                        <div className="text-xs font-bold mt-0.5">{q.insurerName}</div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y text-xs font-semibold">
                  <tr>
                    <td className="py-3 px-4 font-bold text-foreground">Insured Declared Value (IDV)</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center font-mono font-bold text-foreground">
                        ₹{(q.idv || 850000).toLocaleString('en-IN')}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-bold text-foreground">NCB Discount (35%)</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center font-mono text-emerald-600 font-bold">
                        -₹{(q.ncbDiscount || 2450).toLocaleString('en-IN')}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-bold text-foreground">Zero Depreciation Cover</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center">
                        {q.zeroDep !== false ? (
                          <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-rose-500 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-bold text-foreground">Engine Protector</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center">
                        {q.engineProtect !== false ? (
                          <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                        ) : (
                          <X className="h-4 w-4 text-rose-500 mx-auto" />
                        )}
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-bold text-foreground">Roadside Assistance (RSA)</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center">
                        <Check className="h-4 w-4 text-emerald-500 mx-auto" />
                      </td>
                    ))}
                  </tr>

                  <tr>
                    <td className="py-3 px-4 font-bold text-foreground">Claim Settlement Ratio</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-3 px-4 text-center font-extrabold text-sky-600">
                        {q.claimRatio || '98.5%'}
                      </td>
                    ))}
                  </tr>

                  <tr className="bg-primary/5">
                    <td className="py-4 px-4 font-black text-sm text-foreground">Final Payable Premium</td>
                    {quotes.map((q: any) => (
                      <td key={q.insurerId} className="py-4 px-4 text-center">
                        <div className="text-lg font-black text-emerald-600">
                          ₹{(q.totalPremium || 18500).toLocaleString('en-IN')}
                        </div>
                        <Link
                          href="/sales/quotations"
                          className="mt-2 inline-block px-4 py-1.5 rounded-xl bg-primary text-primary-foreground text-[11px] font-extrabold shadow-xs hover:bg-primary/90"
                        >
                          Select Quote
                        </Link>
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
