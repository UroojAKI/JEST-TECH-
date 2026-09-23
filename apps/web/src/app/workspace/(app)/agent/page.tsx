'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { portalRepository } from '@/repositories/portal.repository';
import { agentRepository } from '@/repositories/agent.repository';
import { Loader2 } from 'lucide-react';

export default function AgentWorkspacePage() {
  const { user } = useAuth();

  const { data: metrics, isLoading: isMetricsLoading } = useQuery({
    queryKey: ['portal-agent-metrics'],
    queryFn: () => portalRepository.getDashboardMetrics(),
    refetchInterval: 30000,
  });

  const { data: activeAgentsData, isLoading: isActiveAgentsLoading } = useQuery({
    queryKey: ['portal-active-agents-count'],
    queryFn: () => agentRepository.getAgents({ page: 1, limit: 1, isActive: true }),
    refetchInterval: 60000,
  });

  const { data: pendingAgentsData, isLoading: isPendingAgentsLoading } = useQuery({
    queryKey: ['portal-pending-agents-count'],
    queryFn: () => agentRepository.getAgents({ page: 1, limit: 1, isActive: false }),
    refetchInterval: 60000,
  });

  const activeAgentsCount =
    activeAgentsData?.total ??
    (metrics as any)?.activePolicies ??
    0;

  const pendingOnboardingCount =
    pendingAgentsData?.total ?? 0;

  const monthlyPremiumAmount = (metrics as any)?.monthlyGwp
    ? new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: 0,
      }).format((metrics as any).monthlyGwp)
    : '₹0';

  const isLoading = isMetricsLoading || isActiveAgentsLoading;

  return (
    <div className="p-6 space-y-6 max-w-7xl mx-auto">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Agent & POSP Management
          </h1>
          <p className="text-gray-500 mt-1">
            POSP onboarding, licensing compliance, and production leaderboards
          </p>
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center h-32">
          <h3 className="text-lg font-semibold text-gray-700">Active Agents</h3>
          {isLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-blue-600 mt-2" />
          ) : (
            <p className="text-4xl font-bold text-blue-600 mt-2">
              {activeAgentsCount}
            </p>
          )}
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center h-32">
          <h3 className="text-lg font-semibold text-gray-700">
            Pending Onboarding
          </h3>
          {isPendingAgentsLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-amber-500 mt-2" />
          ) : (
            <p className="text-4xl font-bold text-amber-500 mt-2">
              {pendingOnboardingCount}
            </p>
          )}
        </div>
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 flex flex-col justify-center items-center h-32">
          <h3 className="text-lg font-semibold text-gray-700">
            Monthly Premium
          </h3>
          {isMetricsLoading ? (
            <Loader2 className="h-6 w-6 animate-spin text-emerald-600 mt-2" />
          ) : (
            <p className="text-4xl font-bold text-emerald-600 mt-2">
              {monthlyPremiumAmount}
            </p>
          )}
        </div>
      </div>
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center text-gray-500 mt-6">
        <p>Dashboard registry metrics and SOP pipelines are active.</p>
      </div>
    </div>
  );
}
