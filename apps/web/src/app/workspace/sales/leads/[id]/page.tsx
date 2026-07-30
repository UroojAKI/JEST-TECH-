'use client';

import React from 'react';
import { useParams } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { leadsRepository } from '../../../../../repositories/leads.repository';
import { LeadCommandCenter } from '../../../../../components/workspaces/sales/LeadCommandCenter';

export default function LeadCommandCenterPage() {
  const params = useParams();
  const leadId = params.id as string;

  const { data: lead, isLoading, isError, refetch } = useQuery({
    queryKey: ['lead-detail', leadId],
    queryFn: () => leadsRepository.getLeadById(leadId),
    enabled: !!leadId,
  });

  if (isLoading) {
    return (
      <div className="p-8 text-center text-xs font-semibold text-muted-foreground animate-pulse">
        Loading Lead Command Center & StepTracker...
      </div>
    );
  }

  if (isError || !lead) {
    return (
      <div className="p-8 text-center text-xs font-semibold text-rose-500">
        Failed to load lead details. Please try again.
      </div>
    );
  }

  return <LeadCommandCenter lead={lead} onRefresh={() => refetch()} />;
}
