import { create } from 'zustand';

interface UIStore {
  isSidebarOpen: boolean;
  isCommandPaletteOpen: boolean;
  isNotificationDrawerOpen: boolean;
  isProfileDrawerOpen: boolean;

  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
  setCommandPaletteOpen: (open: boolean) => void;
  setNotificationDrawerOpen: (open: boolean) => void;
  setProfileDrawerOpen: (open: boolean) => void;
}

export const useUIStore = create<UIStore>((set) => ({
  isSidebarOpen: true,
  isCommandPaletteOpen: false,
  isNotificationDrawerOpen: false,
  isProfileDrawerOpen: false,

  toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
  setSidebarOpen: (open) => set({ isSidebarOpen: open }),
  setCommandPaletteOpen: (open) => set({ isCommandPaletteOpen: open }),
  setNotificationDrawerOpen: (open) => set({ isNotificationDrawerOpen: open }),
  setProfileDrawerOpen: (open) => set({ isProfileDrawerOpen: open }),
}));
