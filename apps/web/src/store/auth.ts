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
  token: string | null;
  user: UserProfile | null;
  isAuthenticated: boolean;
  _hasHydrated: boolean;
  setAuth: (token: string, user: UserProfile) => void;
  logout: () => void;
  setHasHydrated: (state: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      user: null,
      isAuthenticated: false,
      _hasHydrated: false,
      setAuth: (token, user) => set({ token, user, isAuthenticated: true }),
      logout: () => set({ token: null, user: null, isAuthenticated: false }),
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
