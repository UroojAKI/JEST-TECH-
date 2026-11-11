'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/api-client';

export interface InsurerMasterItem {
  id: string;
  name: string;
  code: string;
  logoUrl?: string | null;
  isActive: boolean;
  rating?: number | null;
  supportsZeroDep?: boolean;
  supportsRTI?: boolean;
  supportsEngineProtect?: boolean;
  supportsRSA?: boolean;
  contactEmail?: string | null;
  contactPhone?: string | null;
}

/**
 * The insurer master is authoritative. Never merge static/demo insurer names
 * into this list and never turn a failed API request into an empty success.
 */
export function useInsurers() {
  const query = useQuery<InsurerMasterItem[]>({
    queryKey: ['partner-insurers'],
    queryFn: async () => {
      const response = await apiClient.get('/quotations/insurers');
      const data = Array.isArray(response.data)
        ? response.data
        : response.data?.data || [];
      return data.filter(
        (insurer: InsurerMasterItem) => insurer?.isActive === true,
      );
    },
    staleTime: 60 * 1000,
  });

  const activeInsurers = query.data || [];
  const insurerOptions = activeInsurers.map((insurer) => insurer.name);

  return {
    insurers: query.data || [],
    activeInsurers,
    insurerOptions,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
