'use client';
import React from 'react';
import { TrendingUp, Users, FileText, Wallet, AlertCircle } from 'lucide-react';

export default function ManagingDirectorDashboard() {
  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {/* Total Premium Written */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs flex flex-col space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Total Premium Written (MTD)</span>
            <Wallet className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black">₹12,45,00,000</div>
          <div className="text-xs text-emerald-500 flex items-center font-bold">
            <TrendingUp className="h-3 w-3 mr-1" /> +15.2% vs last month
          </div>
        </div>

        {/* Policies Issued */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs flex flex-col space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Policies Issued</span>
            <FileText className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black">4,285</div>
          <div className="text-xs text-emerald-500 flex items-center font-bold">
            <TrendingUp className="h-3 w-3 mr-1" /> +8.4% vs last month
          </div>
        </div>

        {/* Renewal Retention Rate */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs flex flex-col space-y-2">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold">Renewal Retention Rate</span>
            <Users className="h-4 w-4" />
          </div>
          <div className="text-2xl font-black">88.5%</div>
          <div className="text-xs text-amber-500 flex items-center font-bold">
            Target: 90%
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Branch-wise Performance Table */}
        <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
          <h3 className="text-sm font-bold mb-4">Branch Performance</h3>
          <div className="space-y-3">
            {[
              { branch: 'Mumbai Central', premium: '₹4.2 Cr', growth: '+12%' },
              { branch: 'Delhi NCR', premium: '₹3.8 Cr', growth: '+8%' },
              { branch: 'Bangalore', premium: '₹2.9 Cr', growth: '+15%' },
            ].map((row, i) => (
              <div key={i} className="flex justify-between items-center py-2 border-b last:border-0 border-muted/30">
                <span className="text-sm font-semibold">{row.branch}</span>
                <div className="text-right">
                  <div className="text-sm font-bold">{row.premium}</div>
                  <div className="text-xs text-emerald-500">{row.growth}</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-4">
          {/* Claims Ratio */}
          <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold">Claims Ratio (YTD)</span>
              <AlertCircle className="h-4 w-4" />
            </div>
            <div className="text-2xl font-black text-rose-500">62.4%</div>
            <div className="text-xs text-muted-foreground mt-1">Industry average: 65%</div>
          </div>

          {/* Commission Earned */}
          <div className="p-5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground mb-2">
              <span className="text-xs font-semibold">Commission Earned (MTD)</span>
              <Wallet className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-2xl font-black text-emerald-600">₹1,85,40,000</div>
          </div>
        </div>
      </div>
    </div>
  );
}
