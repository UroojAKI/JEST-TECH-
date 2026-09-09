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

  // Allow direct access to /login so users can switch accounts or re-authenticate
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
