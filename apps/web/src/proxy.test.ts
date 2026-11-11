import { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import { proxy } from './proxy';

function makeUnexpiredJwtCookie(): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const payload = Buffer.from(
    JSON.stringify({
      sub: 'user-1',
      exp: Math.floor(Date.now() / 1000) + 900,
    }),
  ).toString('base64url');
  return `${header}.${payload}.sig`;
}

describe('Next.js Auth Proxy (/login redirect loop protection)', () => {
  it('does NOT redirect back to returnUrl when reason=session_expired even if access_token exists', () => {
    const req = new NextRequest(
      'http://localhost:3000/login?reason=session_expired&returnUrl=%2Fsales%2Fquotations',
      {
        headers: {
          cookie: `access_token=${makeUnexpiredJwtCookie()}; refresh_token=stale-rt; csrf_token=stale-csrf`,
        },
      },
    );

    const res = proxy(req);
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
    const setCookies = res.headers.getSetCookie?.() || [];
    const cookieHeader = setCookies.join('; ');
    expect(cookieHeader).toContain('access_token=;');
    expect(cookieHeader).toContain('refresh_token=;');
    expect(cookieHeader).toContain('csrf_token=;');
  });

  it('redirects authenticated user visiting /login normally to safe returnUrl', () => {
    const req = new NextRequest(
      'http://localhost:3000/login?returnUrl=%2Fsales%2Fquotations',
      {
        headers: {
          cookie: `access_token=${makeUnexpiredJwtCookie()}`,
        },
      },
    );

    const res = proxy(req);
    expect(res.status).toBe(307);
    expect(res.headers.get('location')).toBe('http://localhost:3000/sales/quotations');
  });
});

