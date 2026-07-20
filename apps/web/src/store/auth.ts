import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Role =
  | 'SUPER_ADMIN'
  | 'ADMIN'
  | 'BRANCH_MANAGER'
  | 'TEAM_LEADER'
  | 'SALES_AGENT'
  | 'OPERATIONS'
  | 'UNDERWRITER'
  | 'CLAIMS_OFFICER'
  | 'FINANCE'
  | 'SUPPORT'
  | 'CUSTOMER';

export interface UserProfile {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: Role;
}

interface AuthState {
  user: UserProfile | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setAuth: (user: UserProfile) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setAuth: (user) => set({ user, isAuthenticated: true }),
      logout: () => set({ user: null, isAuthenticated: false }),
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
