import {
  isAllowlistedPlatformAdmin,
  withPlatformAdminPermission,
} from './platform-admin.util';

describe('platform administrator allowlist', () => {
  const previousValue = process.env.PLATFORM_ADMIN_EMAILS;

  afterEach(() => {
    if (previousValue === undefined) delete process.env.PLATFORM_ADMIN_EMAILS;
    else process.env.PLATFORM_ADMIN_EMAILS = previousValue;
  });

  it('fails closed when the allowlist is missing', () => {
    delete process.env.PLATFORM_ADMIN_EMAILS;
    expect(isAllowlistedPlatformAdmin('admin@example.com', 'ADMIN')).toBe(false);
  });

  it('requires both an explicit email match and the ADMIN role', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'security@example.com, platform@example.com ';
    expect(isAllowlistedPlatformAdmin(' PLATFORM@example.com ', 'ADMIN')).toBe(true);
    expect(isAllowlistedPlatformAdmin('platform@example.com', 'BACK_OFFICE')).toBe(false);
    expect(isAllowlistedPlatformAdmin('other@example.com', 'ADMIN')).toBe(false);
  });

  it('adds wildcard authorization only for an allowlisted platform administrator', () => {
    process.env.PLATFORM_ADMIN_EMAILS = 'platform@example.com';
    expect(
      withPlatformAdminPermission('platform@example.com', 'ADMIN', ['report:read']),
    ).toEqual(['report:read', '*']);
    expect(
      withPlatformAdminPermission('tenant-admin@example.com', 'ADMIN', ['report:read']),
    ).toEqual(['report:read']);
  });
});
