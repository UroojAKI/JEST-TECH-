'use client';

import React, { useEffect, useRef } from 'react';
import { useAuthStore } from '../../store/auth-store';

const IDLE_TIMEOUT_MS = 15 * 60 * 1000; // 15 minutes

export function IdleTimeoutProvider({ children }: { children: React.ReactNode }) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const setIdleWarningVisible = useAuthStore((s) => s.setIdleWarningVisible);
  const lastActiveRef = useRef<number>(0);

  useEffect(() => {
    if (!isAuthenticated) return;
    lastActiveRef.current = Date.now();

    const handleUserActivity = () => {
      lastActiveRef.current = Date.now();
    };

    window.addEventListener('mousemove', handleUserActivity);
    window.addEventListener('keydown', handleUserActivity);
    window.addEventListener('click', handleUserActivity);
    window.addEventListener('scroll', handleUserActivity);

    const interval = setInterval(() => {
      const elapsed = Date.now() - lastActiveRef.current;
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
  }, [isAuthenticated, setIdleWarningVisible]);

  return <>{children}</>;
}

