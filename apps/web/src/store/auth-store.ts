import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserSession } from '../types';

interface AuthStore {
  user: UserSession | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  _hasHydrated: boolean;
  idleWarningVisible: boolean;
  lastActiveTimestamp: number;

  setUser: (user: UserSession | null) => void;
  setAuth: (user: UserSession) => void;
  setIdleWarningVisible: (visible: boolean) => void;
  touchLastActive: () => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      isLoading: false,
      _hasHydrated: false,
      idleWarningVisible: false,
      lastActiveTimestamp: Date.now(),

      setUser: (user) =>
        set({
          user,
          isAuthenticated: !!user,
          isLoading: false,
        }),

      setAuth: (user) =>
        set({
          user,
          isAuthenticated: true,
          isLoading: false,
        }),

      setIdleWarningVisible: (visible) => set({ idleWarningVisible: visible }),

      touchLastActive: () => set({ lastActiveTimestamp: Date.now() }),

      logout: () => {
        if (typeof window !== 'undefined') {
          document.cookie = 'access_token=; path=/; max-age=0; SameSite=Lax';
          document.cookie = 'refresh_token=; path=/; max-age=0; SameSite=Lax';
          localStorage.removeItem('jest_access_token');
          localStorage.removeItem('jest_refresh_token');
        }
        set({
          user: null,
          isAuthenticated: false,
          isLoading: false,
          idleWarningVisible: false,
        });
      },

      setHasHydrated: (state) => set({ _hasHydrated: state }),
    }),
    {
      name: 'jest-auth-storage',
      onRehydrateStorage: () => (state) => {
        state?.setHasHydrated(true);
      },
    }
  )
);
