'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

const CANONICAL_BREADCRUMB_ROUTES: Record<string, string> = {
  '/workspace/sales/leads': '/crm/leads',
  '/sales/leads': '/crm/leads',
  '/workspace/leads': '/crm/leads',
  '/workspace/proposals': '/sales/proposals',
  '/workspace/quotations': '/sales/quotations',
};

export function WorkspaceBreadcrumb() {
  const pathname = usePathname();
  const segments = (pathname || '/').split('/').filter(Boolean);

  return (
    <nav className="flex items-center space-x-1.5 text-xs text-muted-foreground mb-4">
      <Link href="/workspace" className="flex items-center hover:text-foreground">
        <Home className="h-3.5 w-3.5" />
      </Link>

      {segments.map((segment, idx) => {
        const rawUrl = `/${segments.slice(0, idx + 1).join('/')}`;
        const url = CANONICAL_BREADCRUMB_ROUTES[rawUrl] || rawUrl;
        const isLast = idx === segments.length - 1;
        const formattedName = segment
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (char) => char.toUpperCase());

        return (
          <React.Fragment key={rawUrl}>
            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            {isLast ? (
              <span className="font-bold text-foreground">{formattedName}</span>
            ) : (
              <Link href={url} className="hover:text-foreground">
                {formattedName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
