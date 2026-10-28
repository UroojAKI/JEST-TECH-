import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';
import { createElement, type ComponentType, type ReactNode } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Give every Testing Library render an isolated QueryClient. Tests can still
// supply their own wrapper; it is composed inside the query provider.
vi.mock('@testing-library/react', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@testing-library/react')>();

  const withQueryClient = (wrapper?: ComponentType<{ children: ReactNode }>) =>
    function QueryTestWrapper({ children }: { children: ReactNode }) {
      const content = wrapper ? createElement(wrapper, null, children) : children;
      return createElement(
        QueryClientProvider,
        {
          client: new QueryClient({
            defaultOptions: {
              queries: { retry: false, gcTime: 0 },
              mutations: { retry: false },
            },
          }),
        },
        content,
      );
    };

  return {
    ...actual,
    render: (ui: any, options: any = {}) =>
      actual.render(ui, { ...options, wrapper: withQueryClient(options.wrapper) }),
    renderHook: (callback: any, options: any = {}) =>
      actual.renderHook(callback, { ...options, wrapper: withQueryClient(options.wrapper) }),
  };
});

// Mock Next.js router
vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
    };
  },
  usePathname() {
    return '';
  },
}));
