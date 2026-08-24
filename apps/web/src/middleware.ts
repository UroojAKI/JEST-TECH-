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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('access_token')?.value;

  const isProtectedPath = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  // TEMPORARILY DISABLED FOR DEMO PREP
  // if (isProtectedPath && !token) {
  //   const loginUrl = new URL('/login', request.url);
  //   loginUrl.searchParams.set('from', pathname);
  //   return NextResponse.redirect(loginUrl);
  // }

  // If authenticated user visits /login, redirect to /dashboard
  if (pathname === '/login' && token) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
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

