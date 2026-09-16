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

    // Role-based route guard
    let userRoles: string[] = [];
    try {
      const payloadBase64 = token.split('.')[1];
      if (payloadBase64) {
        const payload = JSON.parse(
          Buffer.from(payloadBase64, 'base64').toString('utf-8')
        );
        userRoles = (payload.roles?.length ? payload.roles : [payload.role])
          .filter(Boolean)
          .map((r: string) => r.toUpperCase());
      }
    } catch {
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('returnUrl', pathname);
      return NextResponse.redirect(loginUrl);
    }

    const isAdmin = userRoles.some((r) =>
      ['ADMIN', 'SUPER_ADMIN', 'SYSTEM_ADMINISTRATOR'].includes(r)
    );
    const isBackOffice = userRoles.some((r) =>
      ['BACK_OFFICE', 'OPERATIONS'].includes(r)
    );

    // 1. Admin-only routes (AUTH-004 / G008)
    const isAdminRoute =
      pathname.startsWith('/admin') ||
      pathname.startsWith('/workspace/admin') ||
      pathname.startsWith('/workspace/executive');

    if (isAdminRoute && !isAdmin) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }

    // 2. Back Office & Operations routes (AUTH-003 / G007: Agents forbidden)
    const isBackOfficeRoute =
      pathname.startsWith('/finance') ||
      pathname.startsWith('/workspace/finance') ||
      pathname.startsWith('/workspace/operations');

    if (isBackOfficeRoute && !isAdmin && !isBackOffice) {
      return NextResponse.redirect(new URL('/unauthorized', request.url));
    }
  }

  // If user is already authenticated and visits /login, redirect to /workspace
  if (pathname === '/login' && token) {
    const returnUrl = request.nextUrl.searchParams.get('returnUrl');
    return NextResponse.redirect(
      new URL(returnUrl || '/workspace', request.url)
    );
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
