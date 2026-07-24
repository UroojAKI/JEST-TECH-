'use client';

import React, { createContext, useContext, useCallback, useMemo } from 'react';
import { useAuthStore } from '../../store/auth-store';
import { RoleType, Permission } from '../../types';

interface AuthorizationCheck {
  roles?: RoleType[];
  permissions?: Permission[];
  featureFlag?: string;
  branchId?: string;
  departmentId?: string;
  teamId?: string;
}

interface PermissionContextType {
  canAccess: (check: AuthorizationCheck) => boolean;
  hasRole: (roles: RoleType | RoleType[]) => boolean;
  hasPermission: (permissions: Permission | Permission[]) => boolean;
}

const PermissionContext = createContext<PermissionContextType | null>(null);

export function PermissionProvider({ children }: { children: React.ReactNode }) {
  const user = useAuthStore((s) => s.user);

  const hasRole = useCallback(
    (roles: RoleType | RoleType[]): boolean => {
      if (!user) return false;
      const userRoles: string[] = user.roles ?? [];
      const requiredRoles = Array.isArray(roles) ? roles : [roles];
      return requiredRoles.some((r) => userRoles.includes(r));
    },
    [user]
  );

  const hasPermission = useCallback(
    (permissions: Permission | Permission[]): boolean => {
      if (!user) return false;
      const userRoles: string[] = user.roles ?? [];
      const userPermissions: string[] = user.permissions ?? [];
      if (userRoles.includes('SUPER_ADMIN')) return true;
      const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
      return requiredPermissions.some((p) => userPermissions.includes(p));
    },
    [user]
  );

  const canAccess = useCallback(
    (check: AuthorizationCheck): boolean => {
      if (!user) return false;
      const userRoles: string[] = user.roles ?? [];

      if (check.roles && check.roles.length > 0 && !hasRole(check.roles)) {
        return false;
      }

      if (check.permissions && check.permissions.length > 0 && !hasPermission(check.permissions)) {
        return false;
      }

      if (check.branchId && user.branchId && check.branchId !== user.branchId) {
        if (!userRoles.includes('SUPER_ADMIN') && !userRoles.includes('ADMIN')) {
          return false;
        }
      }

      if (check.departmentId && user.departmentId && check.departmentId !== user.departmentId) {
        if (!userRoles.includes('SUPER_ADMIN') && !userRoles.includes('ADMIN')) {
          return false;
        }
      }

      if (check.teamId && user.teamId && check.teamId !== user.teamId) {
        if (!userRoles.includes('SUPER_ADMIN') && !userRoles.includes('ADMIN')) {
          return false;
        }
      }

      return true;
    },
    [user, hasRole, hasPermission]
  );

  const value = useMemo(
    () => ({ canAccess, hasRole, hasPermission }),
    [canAccess, hasRole, hasPermission]
  );

  return (
    <PermissionContext.Provider value={value}>
      {children}
    </PermissionContext.Provider>
  );
}


export function usePermissions() {
  const context = useContext(PermissionContext);
  if (!context) {
    throw new Error('usePermissions must be used within a PermissionProvider');
  }
  return context;
}

export function Can({
  roles,
  permissions,
  featureFlag,
  branchId,
  departmentId,
  teamId,
  children,
  fallback = null,
}: AuthorizationCheck & { children: React.ReactNode; fallback?: React.ReactNode }) {
  const { canAccess } = usePermissions();

  if (canAccess({ roles, permissions, featureFlag, branchId, departmentId, teamId })) {
    return <>{children}</>;
  }

  return <>{fallback}</>;
}
