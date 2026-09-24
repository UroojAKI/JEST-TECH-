'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';

export function BreadcrumbNav() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  if (segments.length === 0) {
    return (
      <div className="flex items-center text-xs text-muted-foreground">
        <Home className="h-3.5 w-3.5 mr-1" />
        <span>Home</span>
      </div>
    );
  }

  const getHomeHref = () => {
    if (pathname.startsWith('/workspace/admin')) return '/workspace/admin';
    if (pathname.startsWith('/workspace/operations')) return '/workspace/operations';
    if (pathname.startsWith('/workspace/sales')) return '/workspace/sales';
    if (pathname.startsWith('/crm')) return '/crm/dashboard';
    return '/';
  };

  return (
    <nav className="flex items-center space-x-1 text-xs text-muted-foreground">
      <Link href={getHomeHref()} className="hover:text-foreground flex items-center transition-colors">
        <Home className="h-3.5 w-3.5" />
      </Link>
      {segments.map((segment, index) => {
        const href = `/${segments.slice(0, index + 1).join('/')}`;
        const isLast = index === segments.length - 1;
        const formattedName = segment
          .replace(/-/g, ' ')
          .replace(/\b\w/g, (l) => l.toUpperCase());

        return (
          <React.Fragment key={href}>
            <ChevronRight className="h-3 w-3 text-muted-foreground/60" />
            {isLast ? (
              <span className="font-semibold text-foreground">{formattedName}</span>
            ) : (
              <Link href={href} className="hover:text-foreground transition-colors">
                {formattedName}
              </Link>
            )}
          </React.Fragment>
        );
      })}
    </nav>
  );
}
