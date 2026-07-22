'use client';

import { useQuery } from '@tanstack/react-query';
import { searchRepository } from '../repositories/search.repository';

export function useSearch(queryText: string) {
  const searchQuery = useQuery({
    queryKey: ['search', queryText],
    queryFn: () => searchRepository.globalSearch(queryText),
    enabled: queryText.trim().length >= 2,
    staleTime: 60000,
  });

  return {
    results: searchQuery.data || [],
    isLoading: searchQuery.isLoading,
    isError: searchQuery.isError,
  };
}
