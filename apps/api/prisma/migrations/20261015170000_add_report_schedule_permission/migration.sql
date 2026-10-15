-- Add a separate grant for scheduling so report:create never implicitly
-- authorizes report delivery automation.
INSERT INTO "permissions" (
  "id", "name", "code", "description", "category", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'Schedule Reports',
  'report:schedule',
  'Create, update, and manage scheduled report deliveries',
  'REPORT',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
WHERE NOT EXISTS (
  SELECT 1 FROM "permissions" WHERE "code" = 'report:schedule'
);

-- ADMIN receives the global role grant; BACK_OFFICE receives tenant organization scope.
-- Do not grant this permission to AGENT by default.
INSERT INTO "role_permissions" (
  "id", "roleId", "permissionId", "scope", "assignedAt"
)
SELECT gen_random_uuid()::text, r."id", p."id", 'ALL', CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'ADMIN'
  AND p."code" = 'report:schedule'
ON CONFLICT ("roleId", "permissionId", "scope") DO NOTHING;

INSERT INTO "role_permissions" (
  "id", "roleId", "permissionId", "scope", "assignedAt"
)
SELECT gen_random_uuid()::text, r."id", p."id", 'ORGANIZATION', CURRENT_TIMESTAMP
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r."code" = 'BACK_OFFICE'
  AND p."code" = 'report:schedule'
ON CONFLICT ("roleId", "permissionId", "scope") DO NOTHING;
