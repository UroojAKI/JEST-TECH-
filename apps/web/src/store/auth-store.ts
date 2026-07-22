import { create } from 'zustand';
import { UserSession } from '../types';

interface AuthStore {
  user: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  idleWarningVisible: boolean;
  lastActiveTimestamp: number;

  setUser: (user: UserSession | null) => void;
  setIdleWarningVisible: (visible: boolean) => void;
  touchLastActive: () => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  user: null,
  isAuthenticated: false,
  isLoading: true,
  idleWarningVisible: false,
  lastActiveTimestamp: Date.now(),

  setUser: (user) =>
    set({
      user,
      isAuthenticated: !!user,
      isLoading: false,
    }),

  setIdleWarningVisible: (visible) => set({ idleWarningVisible: visible }),

  touchLastActive: () => set({ lastActiveTimestamp: Date.now() }),

  logout: () =>
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      idleWarningVisible: false,
    }),
}));
