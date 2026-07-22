'use client';

import React, { useEffect } from 'react';
import { useAuthStore } from '../../store/auth-store';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
  const { touchLastActive, lastActiveTimestamp, setIdleWarningVisible, isAuthenticated, logout } =
    useAuthStore();

  useEffect(() => {
    if (!isAuthenticated) return;

    const handleUserActivity = () => {
      touchLastActive();
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActiveTimestamp;
      if (elapsed >= IDLE_TIMEOUT_MS) {
        setIdleWarningVisible(true);
      }
    }, 10000); // Check every 10 seconds

    return () => {
      window.removeEventListener('mousemove', handleUserActivity);
      window.removeEventListener('keydown', handleUserActivity);
      window.removeEventListener('click', handleUserActivity);
      window.removeEventListener('scroll', handleUserActivity);
      clearInterval(interval);
    };
  }, [isAuthenticated, lastActiveTimestamp, touchLastActive, setIdleWarningVisible]);

  return <>{children}</>;
}
