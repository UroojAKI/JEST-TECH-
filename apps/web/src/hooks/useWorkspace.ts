'use client';

import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { workspaceRepository } from '../repositories/workspace.repository';
import { useWorkspaceStore } from '../store/workspace-store';
import { useAuthStore } from '../store/auth-store';

export function useWorkspace() {
  const { isAuthenticated } = useAuthStore();
  const setWorkspace = useWorkspaceStore((state) => state.setWorkspace);
  const currentWorkspace = useWorkspaceStore((state) => state.workspace);

  const query = useQuery({
    queryKey: ['active-workspace'],
    queryFn: () => workspaceRepository.getWorkspace(),
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  useEffect(() => {
    if (query.data) {
      setWorkspace(query.data);
    }
  }, [query.data, setWorkspace]);

  return {
    workspace: query.data || currentWorkspace,
    navigation: query.data?.navigation || currentWorkspace?.navigation || [],
    widgets: query.data?.widgets || currentWorkspace?.widgets || [],
    quickActions: query.data?.quickActions || currentWorkspace?.quickActions || [],
    jobRole: query.data?.jobRole || currentWorkspace?.jobRole || null,
    department: query.data?.department || currentWorkspace?.department || null,
    isLoading: query.isLoading,
    isError: query.isError,
    refetch: query.refetch,
  };
}
