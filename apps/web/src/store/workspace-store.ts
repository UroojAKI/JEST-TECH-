import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { WorkspaceData, NavigationItem } from '../types';

interface WorkspaceStore {
  workspace: WorkspaceData | null;
  navigation: NavigationItem[];
  widgets: any[];
  quickActions: any[];
  isLoading: boolean;

  setWorkspace: (data: WorkspaceData | null) => void;
  setNavigation: (nav: NavigationItem[]) => void;
  setWidgets: (widgets: any[]) => void;
  clearWorkspace: () => void;
}

export const useWorkspaceStore = create<WorkspaceStore>()(
  persist(
    (set) => ({
      workspace: null,
      navigation: [],
      widgets: [],
      quickActions: [],
      isLoading: false,

      setWorkspace: (data) =>
        set({
          workspace: data,
          navigation: data?.navigation || [],
          widgets: data?.widgets || [],
          quickActions: data?.quickActions || [],
          isLoading: false,
        }),

      setNavigation: (navigation) => set({ navigation }),

      setWidgets: (widgets) => set({ widgets }),

      clearWorkspace: () =>
        set({
          workspace: null,
          navigation: [],
          widgets: [],
          quickActions: [],
          isLoading: false,
        }),
    }),
    {
      name: 'jest-workspace-storage',
    }
  )
);
