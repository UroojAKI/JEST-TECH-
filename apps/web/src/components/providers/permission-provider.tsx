'use client';

import React, { createContext, useContext } from 'react';
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
  const { user } = useAuthStore();

  const hasRole = (roles: RoleType | RoleType[]): boolean => {
    if (!user) return false;
    const requiredRoles = Array.isArray(roles) ? roles : [roles];
    return requiredRoles.some((r) => user.roles.includes(r));
  };

  const hasPermission = (permissions: Permission | Permission[]): boolean => {
    if (!user) return false;
    // SUPER_ADMIN has global permissions
    if (user.roles.includes('SUPER_ADMIN')) return true;
    const requiredPermissions = Array.isArray(permissions) ? permissions : [permissions];
    return requiredPermissions.some((p) => user.permissions.includes(p));
  };

  const canAccess = (check: AuthorizationCheck): boolean => {
    if (!user) return false;

    // 1. Role check
    if (check.roles && check.roles.length > 0 && !hasRole(check.roles)) {
      return false;
    }

    // 2. Permission check
    if (check.permissions && check.permissions.length > 0 && !hasPermission(check.permissions)) {
      return false;
    }

    // 3. Organizational Scoping check (Branch, Department, Team)
    if (check.branchId && user.branchId && check.branchId !== user.branchId) {
      if (!user.roles.includes('SUPER_ADMIN') && !user.roles.includes('ADMIN')) {
        return false;
      }
    }

    if (check.departmentId && user.departmentId && check.departmentId !== user.departmentId) {
      if (!user.roles.includes('SUPER_ADMIN') && !user.roles.includes('ADMIN')) {
        return false;
      }
    }

    if (check.teamId && user.teamId && check.teamId !== user.teamId) {
      if (!user.roles.includes('SUPER_ADMIN') && !user.roles.includes('ADMIN')) {
        return false;
      }
    }

    return true;
  };

  return (
    <PermissionContext.Provider value={{ canAccess, hasRole, hasPermission }}>
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
