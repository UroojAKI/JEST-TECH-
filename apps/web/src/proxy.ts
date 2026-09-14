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

    // Role-based route guard for /admin paths
    if (pathname.startsWith('/admin')) {
      try {
        const payloadBase64 = token.split('.')[1];
        if (payloadBase64) {
          const payload = JSON.parse(
            Buffer.from(payloadBase64, 'base64').toString('utf-8')
          );
          const userRole = payload.role;
          const userRoles: string[] = payload.roles || (userRole ? [userRole] : []);
          const allowedAdminRoles = [
            'SUPER_ADMIN',
            'ADMIN',
            'SYSTEM_ADMINISTRATOR',
          ];
          const hasAdminRole = userRoles.some((r) =>
            allowedAdminRoles.includes(r)
          );
          if (!hasAdminRole) {
            return NextResponse.redirect(new URL('/unauthorized', request.url));
          }
        }
      } catch {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('returnUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }
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
