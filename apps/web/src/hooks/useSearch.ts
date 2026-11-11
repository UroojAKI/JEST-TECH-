'use client';

import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { searchRepository } from '../repositories/search.repository';

export function useSearch(queryText: string) {
  const [debouncedQuery, setDebouncedQuery] = useState(queryText.trim());

  useEffect(() => {
    const handle = window.setTimeout(() => setDebouncedQuery(queryText.trim()), 250);
    return () => window.clearTimeout(handle);
  }, [queryText]);

  const searchQuery = useQuery({
    queryKey: ['search', debouncedQuery],
    queryFn: () => searchRepository.globalSearch(debouncedQuery),
    enabled: debouncedQuery.length >= 2,
    staleTime: 15_000,
    gcTime: 60_000,
    retry: 1,
  });

  return {
    results: searchQuery.data || [],
    isLoading: searchQuery.isFetching && debouncedQuery.length >= 2,
    isError: searchQuery.isError,
    error: searchQuery.error,
    debouncedQuery,
  };
}
