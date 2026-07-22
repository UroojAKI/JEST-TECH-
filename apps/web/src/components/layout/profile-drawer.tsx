'use client';

import React from 'react';
import { X, User, Shield, Laptop, LogOut, KeyRound } from 'lucide-react';
import { useUIStore } from '../../store/ui-store';
import { useAuthStore } from '../../store/auth-store';
import { useAuth } from '../../hooks/useAuth';

export function ProfileDrawer() {
  const { isProfileDrawerOpen, setProfileDrawerOpen } = useUIStore();
  const { user } = useAuthStore();
  const { logout, isLoggingOut } = useAuth();

  if (!isProfileDrawerOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-card border-l h-full shadow-2xl flex flex-col justify-between animate-in slide-in-from-right duration-200">
        {/* Header */}
        <div className="p-4 border-b flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="h-5 w-5 text-primary" />
            <h2 className="font-bold text-base">User Profile</h2>
          </div>
          <button
            onClick={() => setProfileDrawerOpen(false)}
            className="rounded-md p-1 hover:bg-accent text-muted-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User Card */}
        <div className="p-4 space-y-4 flex-1">
          <div className="flex items-center space-x-3 p-3 rounded-lg bg-primary/10 border border-primary/20">
            <div className="h-12 w-12 rounded-full bg-primary text-primary-foreground font-black text-lg flex items-center justify-center">
              {user?.firstName?.[0] || 'U'}
            </div>
            <div>
              <h3 className="font-bold text-sm">{user?.firstName} {user?.lastName}</h3>
              <p className="text-xs text-muted-foreground">{user?.email}</p>
              <div className="flex items-center space-x-1 mt-1">
                <Shield className="h-3 w-3 text-primary" />
                <span className="text-[10px] font-semibold text-primary">{user?.roles?.[0] || 'User'}</span>
              </div>
            </div>
          </div>

          {/* Device Sessions Manager */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground flex items-center">
              <Laptop className="h-3.5 w-3.5 mr-1" />
              Active Sessions
            </h4>
            <div className="p-2.5 rounded-md border text-xs bg-muted/30 space-y-1">
              <div className="flex justify-between items-center font-medium">
                <span>Chrome on macOS (Current)</span>
                <span className="text-[10px] text-emerald-500 font-bold">Active</span>
              </div>
              <p className="text-[10px] text-muted-foreground">IP: 192.168.1.45 • Mumbai, IN</p>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="space-y-1 pt-2">
            <button className="w-full flex items-center space-x-2 px-3 py-2 text-xs font-medium rounded-md hover:bg-accent transition-colors">
              <KeyRound className="h-4 w-4 text-muted-foreground" />
              <span>Change Password</span>
            </button>
          </div>
        </div>

        {/* Footer Logout Trigger */}
        <div className="p-4 border-t">
          <button
            onClick={() => logout()}
            disabled={isLoggingOut}
            className="w-full flex items-center justify-center space-x-2 px-4 py-2 text-xs font-semibold rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90 transition-colors shadow-sm"
          >
            <LogOut className="h-4 w-4" />
            <span>{isLoggingOut ? 'Logging out...' : 'Logout Session'}</span>
          </button>
        </div>
      </div>
    </div>
  );
}
