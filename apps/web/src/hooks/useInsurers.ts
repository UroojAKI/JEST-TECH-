'use client';

import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { apiClient } from '../lib/api-client';
import { INSURER_OPTIONS as DEFAULT_INSURER_OPTIONS } from '../components/leads/motor-quote/motorFormConfig';

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

export function useInsurers() {
  const query = useQuery<InsurerMasterItem[]>({
    queryKey: ['partner-insurers'],
    queryFn: async () => {
      try {
        let res;
        try {
          res = await apiClient.get('/motor/rating/insurers');
        } catch {
          res = await apiClient.get('/quotations/insurers');
        }
        const data = Array.isArray(res.data) ? res.data : res.data?.data || [];
        return data;
      } catch (err) {
        console.warn('Failed to fetch dynamic partner insurers from API, falling back to defaults:', err);
        return [];
      }
    },
    staleTime: 60 * 1000, // 1 minute cache, invalidated dynamically on admin update
  });

  const activeInsurers = useMemo(() => {
    return (query.data || []).filter((ins) => ins.isActive !== false);
  }, [query.data]);

  const insurerOptions = useMemo(() => {
    // Dynamic database partner insurers first
    const dbNames = activeInsurers.map((ins) => ins.name).filter(Boolean);
    const set = new Set<string>(dbNames);
    // Combine with default statutory insurers so existing records never break
    DEFAULT_INSURER_OPTIONS.forEach((opt) => set.add(opt));
    return Array.from(set);
  }, [activeInsurers]);

  return {
    insurers: query.data || [],
    activeInsurers,
    insurerOptions,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
