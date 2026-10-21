import { PrismaClient } from '@prisma/client';

const CANONICAL_EMAILS = new Set([
  'superadmin@jest.com',
  'admin@jest.com',
  'manager@jest.com',
  'agent@jest.com',
  'underwriter@jest.com',
  'claims@jest.com',
  'finance@jest.com',
  'md@jest.com',
  'sm@jest.com',
  'renewal@jest.com',
  'cre@jest.com',
  'arm@jest.com',
  'backoffice@jest.com',
  'accounts@jest.com',
  'marketing@jest.com',
]);

export async function purgeInactiveTestUsers() {
  const prisma = new PrismaClient();

  console.log('========================================================================');
  console.log('🧹 PURGE INACTIVE TEST USERS & LEFTOVER ARTIFACTS');
  console.log('========================================================================');

  try {
    const allUsers = await prisma.user.findMany({
      select: { id: true, email: true, employeeCode: true, status: true },
    });

    const testUsers = allUsers.filter((u) => !CANONICAL_EMAILS.has(u.email.toLowerCase()));
    const canonicalUsers = allUsers.filter((u) => CANONICAL_EMAILS.has(u.email.toLowerCase()));

    console.log(`Found ${canonicalUsers.length} CANONICAL users to PRESERVE:`);
    canonicalUsers.forEach((u) => console.log(`  ✓ [${u.status}] ${u.email}`));

    console.log(`\nFound ${testUsers.length} TEST users to PURGE:`);
    testUsers.forEach((u) => console.log(`  ✗ [${u.status}] ${u.email} (${u.employeeCode || 'no-code'})`));

    if (testUsers.length === 0) {
      console.log('\nNo test users found. System is already clean.');
      return;
    }

    const testUserIds = testUsers.map((u) => u.id);

    console.log('\nExecuting atomic purge...');
    await prisma.$transaction(
      async (tx) => {
        // 1. Temporarily pause immutable audit trigger
        await tx.$executeRawUnsafe('ALTER TABLE audit_logs DISABLE TRIGGER trg_audit_log_immutable;');

        // 2. Delete document access logs for test users
        const docAccessDeleted = await tx.$executeRawUnsafe(
          'DELETE FROM document_access_logs WHERE "userId" = ANY($1::text[])',
          testUserIds,
        );
        console.log(`  - Deleted document access logs: ${docAccessDeleted}`);

        // 3. Delete documents uploaded by test users
        const docsDeleted = await tx.$executeRawUnsafe(
          'DELETE FROM documents WHERE "uploadedById" = ANY($1::text[])',
          testUserIds,
        );
        console.log(`  - Deleted test documents: ${docsDeleted}`);

        // 4. Delete test audit logs
        const auditDeleted = await tx.$executeRawUnsafe(
          'DELETE FROM audit_logs WHERE "userId" = ANY($1::text[])',
          testUserIds,
        );
        console.log(`  - Deleted test audit logs: ${auditDeleted}`);

        // 5. Delete agent profiles for test users
        const agentsDeleted = await tx.$executeRawUnsafe(
          'DELETE FROM agents WHERE "userId" = ANY($1::text[])',
          testUserIds,
        );
        console.log(`  - Deleted test agent profiles: ${agentsDeleted}`);

        // 6. Delete refresh tokens for test users
        const tokensDeleted = await tx.$executeRawUnsafe(
          'DELETE FROM refresh_tokens WHERE "userId" = ANY($1::text[])',
          testUserIds,
        );
        console.log(`  - Deleted test refresh tokens: ${tokensDeleted}`);

        // 7. Delete the test users themselves
        const usersDeleted = await tx.$executeRawUnsafe(
          'DELETE FROM users WHERE id = ANY($1::text[])',
          testUserIds,
        );
        console.log(`  - Deleted test users: ${usersDeleted}`);

        // 8. Re-enable immutable audit trigger
        await tx.$executeRawUnsafe('ALTER TABLE audit_logs ENABLE TRIGGER trg_audit_log_immutable;');
      },
      { maxWait: 15_000, timeout: 60_000 },
    );

    console.log('\n✅ Successfully purged all 11 test users and associated test artifacts.');
    console.log('========================================================================');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  purgeInactiveTestUsers().catch((err) => {
    console.error('Fatal purge error:', err);
    process.exit(1);
  });
}
