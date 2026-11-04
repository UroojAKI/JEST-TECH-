'use client';

import React, { useState } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

export default function QueryProvider({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 60 * 1000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error: any) => {
              const status = error?.response?.status;
              // Never retry 401 (Unauthorized), 403 (Forbidden), or 404 (Not Found)
              if (status === 401 || status === 403 || status === 404) return false;
              // For 429 (Too Many Requests), retry at most 1 time after backoff
              if (status === 429) return failureCount < 1;
              return failureCount < 2;
            },
            retryDelay: (attemptIndex, error: any) => {
              const retryAfter = error?.response?.headers?.['retry-after'];
              if (retryAfter) {
                const seconds = parseInt(retryAfter, 10);
                if (!isNaN(seconds) && seconds > 0) return seconds * 1000;
              }
              return Math.min(1000 * 2 ** attemptIndex, 10000);
            },
          },
        },
      }),
  );

  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
