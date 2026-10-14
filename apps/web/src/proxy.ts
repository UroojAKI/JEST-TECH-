import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

const PROTECTED_PREFIXES = [
  '/dashboard',
  '/crm',
  '/sales',
  '/policies',
  '/claims',
  '/finance',
  '/reports',
  '/admin',
  '/portal',
  '/settings',
  '/workspace',
];

function getSafeReturnUrl(rawUrl: string | null): string {
  if (!rawUrl) return '/workspace';
  // Must start with single '/', not '//', and not contain '://' or backslashes
  if (
    rawUrl.startsWith('/') &&
    !rawUrl.startsWith('//') &&
    !rawUrl.includes('://') &&
    !rawUrl.includes('\\')
  ) {
    return rawUrl;
  }
  return '/workspace';
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;

  const isProtectedPath = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtectedPath) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    // Role-based route guard & token expiry check
    let userRoles: string[] = [];
    try {
      const payloadBase64 = token.split('.')[1];
      if (payloadBase64) {
        const payload = JSON.parse(
          Buffer.from(payloadBase64, 'base64').toString('utf-8')
        );
        // If access token has expired, redirect to login and clear the stale cookie
        if (payload.exp && payload.exp * 1000 <= Date.now()) {
          const loginUrl = new URL('/login', request.url);
          loginUrl.searchParams.set('returnUrl', pathname);
          const response = NextResponse.redirect(loginUrl);
          response.cookies.delete('access_token');
          return response;
        }

        userRoles = (payload.roles?.length ? payload.roles : [payload.role])
          .filter(Boolean)
          .map((r: string) => r.toUpperCase());
      }
    } catch {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      const response = NextResponse.redirect(loginUrl);
      response.cookies.delete('access_token');
      return response;
    }

    const isAdmin = userRoles.some((r) =>
      ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMINISTRATOR'].includes(r)
    );
    const isBackOffice = userRoles.some((r) =>
      ['BACK_OFFICE', 'OPERATIONS'].includes(r)
    );

    // 1. Admin-only routes (AUTH-004 / G008)
    const isAdminRoute =
      pathname === '/admin' ||
      pathname.startsWith('/admin/') ||
      pathname === '/workspace/admin' ||
      pathname.startsWith('/workspace/admin/') ||
      pathname === '/workspace/executive' ||
      pathname.startsWith('/workspace/executive/');

    if (isAdminRoute && !isAdmin) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // 2. Back Office & Operations routes (AUTH-003 / G007: Agents forbidden)
    const isBackOfficeRoute =
      pathname === '/finance' ||
      pathname.startsWith('/finance/') ||
      pathname === '/workspace/finance' ||
      pathname.startsWith('/workspace/finance/') ||
      pathname === '/workspace/operations' ||
      pathname.startsWith('/workspace/operations/');

    if (isBackOfficeRoute && !isAdmin && !isBackOffice) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // If user visits /login: only redirect to /workspace if token is genuinely valid and unexpired
  if (pathname === '/login') {
    if (token) {
      let isExpired = false;
      try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const payload = JSON.parse(
            Buffer.from(payloadBase64, 'base64').toString('utf-8')
          );
          if (payload.exp && payload.exp * 1000 <= Date.now()) {
            isExpired = true;
          }
        }
      } catch {
        isExpired = true;
      }

      if (!isExpired) {
        const rawReturnUrl = request.nextUrl.searchParams.get('returnUrl');
        const safeUrl = getSafeReturnUrl(rawReturnUrl);
        return NextResponse.redirect(new URL(safeUrl, request.url));
      } else {
        // Clear expired token cookie so browser isn't trapped in redirect loop
        const response = NextResponse.next();
        response.cookies.delete('access_token');
        return response;
      }
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/dashboard/:path*',
    '/crm/:path*',
    '/sales/:path*',
    '/policies/:path*',
    '/claims/:path*',
    '/finance/:path*',
    '/reports/:path*',
    '/admin/:path*',
    '/portal/:path*',
    '/settings/:path*',
    '/workspace/:path*',
    '/login',
  ],
};
