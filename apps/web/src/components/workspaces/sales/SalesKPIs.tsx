'use client';

import React from 'react';
import {
  Users,
  PhoneCall,
  Calendar,
  FileSpreadsheet,
  FileText,
  ShieldCheck,
  TrendingUp,
  Percent,
  Clock,
  Target,
  Award,
  Star,
  Share2,
} from 'lucide-react';

interface SalesKPIsProps {
  data?: any;
}

export function SalesKPIs({ data }: SalesKPIsProps) {
  const top = data?.topRow || {
    assignedLeads: 42,
    interestedLeads: 18,
    todayCalls: 12,
    todayMeetings: 4,
    quotePending: 6,
    proposalPending: 3,
    policiesSold: 14,
    todayRevenue: 343000,
  };

  const bottom = data?.bottomRow || {
    referralCount: 8,
    crossSellRatio: '18.5%',
    conversionPercentage: '33.3%',
    averageTatHours: '4.2 hrs',
    averagePolicyValue: '₹24,500',
    targetAchievementPercent: '84.5%',
    achievedGwp: '₹12,675,000',
    customerRating: '4.8 / 5.0',
  };

  return (
    <div className="space-y-4">
      {/* Top Row: Operational Telemetry */}
      <div>
        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">
          Top Row • Daily Sales Telemetry
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Assigned</span>
              <Users className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-lg font-black text-foreground">{top.assignedLeads}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Active Leads</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Interested</span>
              <Target className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-black text-amber-600">{top.interestedLeads}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Hot Pipeline</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Calls</span>
              <PhoneCall className="h-3.5 w-3.5 text-sky-500" />
            </div>
            <div className="text-lg font-black text-sky-600">{top.todayCalls}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Today Outbound</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Meetings</span>
              <Calendar className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <div className="text-lg font-black text-indigo-600">{top.todayMeetings}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Scheduled</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Quotes</span>
              <FileSpreadsheet className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-lg font-black text-amber-600">{top.quotePending}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Pending Prep</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Proposals</span>
              <FileText className="h-3.5 w-3.5 text-violet-500" />
            </div>
            <div className="text-lg font-black text-violet-600">{top.proposalPending}</div>
            <div className="text-[10px] text-muted-foreground mt-0.5">Underwriting</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Policies Sold</span>
              <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-lg font-black text-emerald-600">{top.policiesSold}</div>
            <div className="text-[10px] text-emerald-600 font-bold mt-0.5">Issued</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="flex items-center justify-between text-muted-foreground text-xs mb-1">
              <span>Revenue</span>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="text-sm font-black text-emerald-600 truncate">
              ₹{(top.todayRevenue / 1000).toFixed(0)}k
            </div>
            <div className="text-[10px] text-muted-foreground mt-0.5">GWP Today</div>
          </div>
        </div>
      </div>

      {/* Bottom Row: Executive Targets & Quality */}
      <div>
        <div className="text-[10px] uppercase font-bold text-muted-foreground tracking-wider mb-2">
          Bottom Row • Performance & Conversion Quality
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-semibold text-muted-foreground flex items-center justify-between">
              <span>Referrals</span>
              <Share2 className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-base font-extrabold text-foreground mt-1">{bottom.referralCount}</div>
            <div className="text-[10px] text-muted-foreground">Captured</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-semibold text-muted-foreground flex items-center justify-between">
              <span>Cross Sell</span>
              <Percent className="h-3.5 w-3.5 text-sky-500" />
            </div>
            <div className="text-base font-extrabold text-sky-600 mt-1">{bottom.crossSellRatio}</div>
            <div className="text-[10px] text-muted-foreground">Health + Motor</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-semibold text-muted-foreground flex items-center justify-between">
              <span>Conversion</span>
              <TrendingUp className="h-3.5 w-3.5 text-emerald-500" />
            </div>
            <div className="text-base font-extrabold text-emerald-600 mt-1">{bottom.conversionPercentage}</div>
            <div className="text-[10px] text-muted-foreground">Lead to Policy</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-semibold text-muted-foreground flex items-center justify-between">
              <span>Avg TAT</span>
              <Clock className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-base font-extrabold text-amber-600 mt-1">{bottom.averageTatHours}</div>
            <div className="text-[10px] text-muted-foreground">Speed to Issue</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-semibold text-muted-foreground flex items-center justify-between">
              <span>Avg Ticket</span>
              <Award className="h-3.5 w-3.5 text-indigo-500" />
            </div>
            <div className="text-xs font-extrabold text-indigo-600 mt-1 truncate">{bottom.averagePolicyValue}</div>
            <div className="text-[10px] text-muted-foreground">Per Policy</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-semibold text-muted-foreground flex items-center justify-between">
              <span>Achievement</span>
              <Target className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            <div className="text-base font-extrabold text-emerald-600 mt-1">{bottom.targetAchievementPercent}</div>
            <div className="text-[10px] text-muted-foreground">Monthly Target</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-semibold text-muted-foreground flex items-center justify-between">
              <span>Achieved GWP</span>
              <TrendingUp className="h-3.5 w-3.5 text-primary" />
            </div>
            <div className="text-xs font-extrabold text-primary mt-1 truncate">
              {bottom.achievedGwp}
            </div>
            <div className="text-[10px] text-muted-foreground">YTD Premium</div>
          </div>

          <div className="p-3.5 rounded-2xl border bg-card text-card-foreground shadow-xs">
            <div className="text-[10px] font-semibold text-muted-foreground flex items-center justify-between">
              <span>CSAT Rating</span>
              <Star className="h-3.5 w-3.5 text-amber-500" />
            </div>
            <div className="text-base font-extrabold text-amber-500 mt-1">{bottom.customerRating}</div>
            <div className="text-[10px] text-muted-foreground">Customer Score</div>
          </div>
        </div>
      </div>
    </div>
  );
}
