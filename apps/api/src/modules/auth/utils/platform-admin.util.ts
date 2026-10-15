/**
 * Global configuration and role writes are intentionally gated separately from
 * tenant ADMIN permissions. An ADMIN account becomes a platform administrator
 * only when its exact email is explicitly allowlisted in PLATFORM_ADMIN_EMAILS.
 *
 * The allowlist is fail-closed: unset/empty means no platform administrators.
 */
export function isAllowlistedPlatformAdmin(
  email: string | undefined | null,
  role: string | undefined | null,
): boolean {
  if (!email || String(role || '').trim().toUpperCase() !== 'ADMIN') {
    return false;
  }

  const allowlistedEmails = (process.env.PLATFORM_ADMIN_EMAILS || '')
    .split(',')
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);

  return allowlistedEmails.includes(email.trim().toLowerCase());
}

export function withPlatformAdminPermission(
  email: string | undefined | null,
  role: string | undefined | null,
  permissions: string[],
): string[] {
  if (!isAllowlistedPlatformAdmin(email, role)) return permissions;
  return Array.from(new Set([...permissions, '*']));
}
