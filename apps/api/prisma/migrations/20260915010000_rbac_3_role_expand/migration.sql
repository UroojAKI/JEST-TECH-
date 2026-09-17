-- ============================================================================
-- WAVE 1 EXPAND MIGRATION: 3-Role RBAC Foundation & Staged Backfill
-- ============================================================================

BEGIN;

-- ----------------------------------------------------------------------------
-- 1. PRE-MIGRATION AUDIT & TRACEABILITY TABLES (Existing Schema State)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "rbac_migration_backup_users" AS
SELECT 
    u.id, 
    u.email, 
    u."roleId", 
    u."branchId", 
    u.status, 
    u."authVersion", 
    NOW() as backup_at
FROM "users" u;

CREATE TABLE IF NOT EXISTS "rbac_migration_backup_roles" AS
SELECT r.id, r.name, r.code, r.type, r."isSystem", r."isActive", NOW() as backup_at
FROM "roles" r;

CREATE TABLE IF NOT EXISTS "rbac_migration_backup_role_permissions" AS
SELECT rp."roleId", rp."permissionId", rp."assignedAt", NOW() as backup_at
FROM "role_permissions" rp;

CREATE TABLE IF NOT EXISTS "rbac_migration_backup_workflow_assignments" AS
SELECT wa.id, wa."stateId", wa."transitionId", wa."roleId", wa."userId", wa."departmentId", wa."branchId", NOW() as backup_at
FROM "workflow_assignments" wa;

CREATE TABLE IF NOT EXISTS "rbac_migration_backup_dashboard_registry" AS
SELECT d.id, d."jobRoleId", d."dashboardCode", d."workspaceCode", d.title, d.layout, d.navigation, d.widgets, d."quickActions", d.permissions, NOW() as backup_at
FROM "DashboardRegistry" d;

CREATE TABLE IF NOT EXISTS "rbac_migration_backup_job_roles" AS
SELECT j.id, j.code, j.name, j."departmentId", j."defaultRoleType", NOW() as backup_at
FROM "JobRole" j;

CREATE TABLE IF NOT EXISTS "rbac_migration_backup_permissions" AS
SELECT p.*, NOW() as backup_at
FROM "permissions" p;

-- ----------------------------------------------------------------------------
-- 2. STAGE Role.type & REMOVE UNIQUE CONSTRAINT (Prevents Collision)
-- ----------------------------------------------------------------------------
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'roles_type_key') THEN
        ALTER TABLE "roles" DROP CONSTRAINT "roles_type_key";
    END IF;
END $$;

DROP INDEX IF EXISTS "roles_type_key";
ALTER TABLE "roles" ALTER COLUMN "type" TYPE TEXT;

-- ----------------------------------------------------------------------------
-- 3. DDL EXTENSIONS (Nullable during expand phase)
-- ----------------------------------------------------------------------------
-- Add companyId to users
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_companyId_fkey') THEN
        ALTER TABLE "users" ADD CONSTRAINT "users_companyId_fkey" 
        FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "users_companyId_idx" ON "users"("companyId");

-- Add AccessScope enum
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'AccessScope') THEN
        CREATE TYPE "AccessScope" AS ENUM ('OWN', 'ASSIGNED', 'ORGANIZATION', 'ALL');
    END IF;
END $$;

-- Add surrogate id and scope to role_permissions
ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "id" TEXT DEFAULT gen_random_uuid()::text;
ALTER TABLE "role_permissions" ADD COLUMN IF NOT EXISTS "scope" "AccessScope" DEFAULT 'ORGANIZATION';

-- Add roleId to DashboardRegistry
ALTER TABLE "DashboardRegistry" ADD COLUMN IF NOT EXISTS "roleId" TEXT;
ALTER TABLE "DashboardRegistry" ALTER COLUMN "jobRoleId" DROP NOT NULL;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'DashboardRegistry_roleId_fkey') THEN
        ALTER TABLE "DashboardRegistry" ADD CONSTRAINT "DashboardRegistry_roleId_fkey" 
        FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "DashboardRegistry_roleId_idx" ON "DashboardRegistry"("roleId");

-- Make users.roleId nullable to support external/quarantined non-staff identities
ALTER TABLE "users" ALTER COLUMN "roleId" DROP NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. RESOLVE TENANT HIERARCHY (Strict - Zero Fallbacks)
-- ----------------------------------------------------------------------------
UPDATE "users" u
SET "companyId" = r."companyId"
FROM "Branch" b
JOIN "Zone" z ON b."zoneId" = z."id"
JOIN "Region" r ON z."regionId" = r."id"
WHERE u."branchId" = b."id" AND u."companyId" IS NULL;

-- Record mapping for audit
CREATE TABLE IF NOT EXISTS "rbac_migration_mapping_user_companies" AS
SELECT u.id as user_id, u.email, u."companyId", NOW() as mapped_at
FROM "users" u;

-- Invariant Assertion: Fail immediately if any active user has unresolved companyId
DO $$
DECLARE
    unassigned_count INT;
BEGIN
    SELECT COUNT(*) INTO unassigned_count
    FROM "users"
    WHERE "status" = 'ACTIVE' AND "companyId" IS NULL;

    IF unassigned_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT FAILURE: % active users have unresolved company ownership. No automatic assignment permitted.', unassigned_count;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 5. ESTABLISH CANONICAL ROLES (Staged as TEXT type)
-- ----------------------------------------------------------------------------
-- Canonical ADMIN
INSERT INTO "roles" ("id", "name", "code", "type", "description", "isSystem", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Administrator', 'ADMIN', 'ADMIN', 'Unrestricted administration and system governance', true, true, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "type" = 'ADMIN', "description" = EXCLUDED."description", "isActive" = true;

-- Canonical BACK_OFFICE
INSERT INTO "roles" ("id", "name", "code", "type", "description", "isSystem", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Back Office Operations', 'BACK_OFFICE', 'BACK_OFFICE', 'Organization operations, underwriting, claims, finance, renewals', true, true, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "type" = 'BACK_OFFICE', "description" = EXCLUDED."description", "isActive" = true;

-- Canonical AGENT
INSERT INTO "roles" ("id", "name", "code", "type", "description", "isSystem", "isActive", "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Insurance Agent', 'AGENT', 'AGENT', 'Customer-facing sales, lead acquisition, and field work', true, true, NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "type" = 'AGENT', "description" = EXCLUDED."description", "isActive" = true;

-- Assert exactly 1 of each canonical code exists
DO $$
DECLARE
    admin_count INT;
    bo_count INT;
    agent_count INT;
BEGIN
    SELECT COUNT(*) INTO admin_count FROM "roles" WHERE "code" = 'ADMIN';
    SELECT COUNT(*) INTO bo_count FROM "roles" WHERE "code" = 'BACK_OFFICE';
    SELECT COUNT(*) INTO agent_count FROM "roles" WHERE "code" = 'AGENT';

    IF admin_count != 1 OR bo_count != 1 OR agent_count != 1 THEN
        RAISE EXCEPTION 'PREFLIGHT FAILURE: Canonical roles establishment failed (ADMIN=%, BO=%, AGENT=%)', admin_count, bo_count, agent_count;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 6. QUARANTINE CUSTOMER IDENTITIES (Phase 4 Preparation)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "quarantined_customer_identities" AS
SELECT 
    u.*, 
    'LEGACY_CUSTOMER_MIGRATION' as reason,
    '20260915_RBAC_REBUILD' as migration_version,
    NOW() as quarantined_at
FROM "users" u
JOIN "roles" r ON u."roleId" = r.id
WHERE r.code = 'CUSTOMER';

-- Clear roleId and suspend internal CRM access for customer users
UPDATE "users"
SET "roleId" = NULL, "status" = 'SUSPENDED'
WHERE "roleId" IN (SELECT id FROM "roles" WHERE "code" = 'CUSTOMER');

-- Delete workflow assignments referencing CUSTOMER
DELETE FROM "workflow_assignments"
WHERE "roleId" IN (SELECT id FROM "roles" WHERE "code" = 'CUSTOMER');

-- ----------------------------------------------------------------------------
-- 7. REMAP USERS TO CANONICAL ROLES (Including CFO in ADMIN)
-- ----------------------------------------------------------------------------
-- ADMIN mapping: SUPER_ADMIN, ADMIN, SYSTEM_ADMINISTRATOR, MD_CEO, CHIEF_FINANCE_OFFICER
UPDATE "users"
SET "roleId" = (SELECT id FROM "roles" WHERE "code" = 'ADMIN' LIMIT 1)
WHERE "roleId" IN (
    SELECT id FROM "roles" 
    WHERE "code" IN ('SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMINISTRATOR', 'MD_CEO', 'CHIEF_FINANCE_OFFICER')
);

-- AGENT mapping: SALES_AGENT, POSP_ADVISOR, SALES_EXECUTIVE
UPDATE "users"
SET "roleId" = (SELECT id FROM "roles" WHERE "code" = 'AGENT' LIMIT 1)
WHERE "roleId" IN (
    SELECT id FROM "roles" 
    WHERE "code" IN ('SALES_AGENT', 'POSP_ADVISOR', 'SALES_EXECUTIVE')
);

-- BACK_OFFICE mapping: all other operational roles (excluding quarantined CUSTOMER)
UPDATE "users"
SET "roleId" = (SELECT id FROM "roles" WHERE "code" = 'BACK_OFFICE' LIMIT 1)
WHERE "roleId" IN (
    SELECT id FROM "roles" 
    WHERE "code" NOT IN (
        'SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMINISTRATOR', 'MD_CEO', 'CHIEF_FINANCE_OFFICER',
        'SALES_AGENT', 'POSP_ADVISOR', 'SALES_EXECUTIVE',
        'CUSTOMER',
        'BACK_OFFICE', 'AGENT'
    )
);

-- ----------------------------------------------------------------------------
-- 8. REMAP WORKFLOW ASSIGNMENTS (Including CFO in ADMIN)
-- ----------------------------------------------------------------------------
UPDATE "workflow_assignments"
SET "roleId" = (SELECT id FROM "roles" WHERE "code" = 'ADMIN' LIMIT 1)
WHERE "roleId" IN (
    SELECT id FROM "roles" 
    WHERE "code" IN ('SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMINISTRATOR', 'MD_CEO', 'CHIEF_FINANCE_OFFICER')
);

UPDATE "workflow_assignments"
SET "roleId" = (SELECT id FROM "roles" WHERE "code" = 'AGENT' LIMIT 1)
WHERE "roleId" IN (
    SELECT id FROM "roles" 
    WHERE "code" IN ('SALES_AGENT', 'POSP_ADVISOR', 'SALES_EXECUTIVE')
);

UPDATE "workflow_assignments"
SET "roleId" = (SELECT id FROM "roles" WHERE "code" = 'BACK_OFFICE' LIMIT 1)
WHERE "roleId" IN (
    SELECT id FROM "roles" 
    WHERE "code" NOT IN (
        'SUPER_ADMIN', 'ADMIN', 'SYSTEM_ADMINISTRATOR', 'MD_CEO', 'CHIEF_FINANCE_OFFICER',
        'SALES_AGENT', 'POSP_ADVISOR', 'SALES_EXECUTIVE',
        'CUSTOMER',
        'BACK_OFFICE', 'AGENT'
    )
);

-- ----------------------------------------------------------------------------
-- 9. SEED AUTHORITATIVE CANONICAL PERMISSIONS CATALOG (56 Permissions)
-- ----------------------------------------------------------------------------
-- Clean legacy role_permissions and non-canonical permissions to prevent unique constraint collisions
DELETE FROM "role_permissions";
DELETE FROM "permissions" WHERE "code" NOT IN (
    'lead:read', 'lead:create', 'lead:update', 'lead:delete', 'lead:assign', 'lead:merge', 'lead:export',
    'contact:read', 'contact:create', 'contact:update', 'contact:delete', 'contact:export',
    'opportunity:read', 'opportunity:create', 'opportunity:update', 'opportunity:pipeline',
    'quotation:read', 'quotation:create', 'quotation:update', 'quotation:approve', 'quotation:reject', 'quotation:export',
    'policy:read', 'policy:create', 'policy:update', 'policy:issue', 'policy:cancel', 'policy:export',
    'claim:read', 'claim:create', 'claim:update', 'claim:approve', 'claim:reject', 'claim:settle', 'claim:export',
    'renewal:read', 'renewal:update', 'renewal:process', 'renewal:export',
    'document:read', 'document:upload', 'document:delete',
    'commission:read', 'commission:process', 'commission:configure', 'commission:export',
    'report:read', 'report:create', 'report:export',
    'user:read', 'user:create', 'user:update', 'user:delete', 'user:deactivate',
    'system:manage', 'audit:read'
);

INSERT INTO "permissions" ("id", "code", "name", "category", "createdAt", "updatedAt")
VALUES
    (gen_random_uuid()::text, 'lead:read', 'Read Leads', 'LEAD', NOW(), NOW()),
    (gen_random_uuid()::text, 'lead:create', 'Create Leads', 'LEAD', NOW(), NOW()),
    (gen_random_uuid()::text, 'lead:update', 'Update Leads', 'LEAD', NOW(), NOW()),
    (gen_random_uuid()::text, 'lead:delete', 'Delete Leads', 'LEAD', NOW(), NOW()),
    (gen_random_uuid()::text, 'lead:assign', 'Assign Leads', 'LEAD', NOW(), NOW()),
    (gen_random_uuid()::text, 'lead:merge', 'Merge Leads', 'LEAD', NOW(), NOW()),
    (gen_random_uuid()::text, 'lead:export', 'Export Leads', 'LEAD', NOW(), NOW()),
    (gen_random_uuid()::text, 'contact:read', 'Read Contacts', 'CONTACT', NOW(), NOW()),
    (gen_random_uuid()::text, 'contact:create', 'Create Contacts', 'CONTACT', NOW(), NOW()),
    (gen_random_uuid()::text, 'contact:update', 'Update Contacts', 'CONTACT', NOW(), NOW()),
    (gen_random_uuid()::text, 'contact:delete', 'Delete Contacts', 'CONTACT', NOW(), NOW()),
    (gen_random_uuid()::text, 'contact:export', 'Export Contacts', 'CONTACT', NOW(), NOW()),
    (gen_random_uuid()::text, 'opportunity:read', 'Read Opportunities', 'LEAD', NOW(), NOW()),
    (gen_random_uuid()::text, 'opportunity:create', 'Create Opportunities', 'LEAD', NOW(), NOW()),
    (gen_random_uuid()::text, 'opportunity:update', 'Update Opportunities', 'LEAD', NOW(), NOW()),
    (gen_random_uuid()::text, 'opportunity:pipeline', 'Manage Opportunity Pipeline', 'LEAD', NOW(), NOW()),
    (gen_random_uuid()::text, 'quotation:read', 'Read Quotations', 'QUOTATION', NOW(), NOW()),
    (gen_random_uuid()::text, 'quotation:create', 'Create Quotations', 'QUOTATION', NOW(), NOW()),
    (gen_random_uuid()::text, 'quotation:update', 'Update Quotations', 'QUOTATION', NOW(), NOW()),
    (gen_random_uuid()::text, 'quotation:approve', 'Approve Quotations', 'QUOTATION', NOW(), NOW()),
    (gen_random_uuid()::text, 'quotation:reject', 'Reject Quotations', 'QUOTATION', NOW(), NOW()),
    (gen_random_uuid()::text, 'quotation:export', 'Export Quotations', 'QUOTATION', NOW(), NOW()),
    (gen_random_uuid()::text, 'policy:read', 'Read Policies', 'POLICY', NOW(), NOW()),
    (gen_random_uuid()::text, 'policy:create', 'Create Policies', 'POLICY', NOW(), NOW()),
    (gen_random_uuid()::text, 'policy:update', 'Update Policies', 'POLICY', NOW(), NOW()),
    (gen_random_uuid()::text, 'policy:issue', 'Issue Policies', 'POLICY', NOW(), NOW()),
    (gen_random_uuid()::text, 'policy:cancel', 'Cancel Policies', 'POLICY', NOW(), NOW()),
    (gen_random_uuid()::text, 'policy:export', 'Export Policies', 'POLICY', NOW(), NOW()),
    (gen_random_uuid()::text, 'claim:read', 'Read Claims', 'CLAIM', NOW(), NOW()),
    (gen_random_uuid()::text, 'claim:create', 'Create Claims', 'CLAIM', NOW(), NOW()),
    (gen_random_uuid()::text, 'claim:update', 'Update Claims', 'CLAIM', NOW(), NOW()),
    (gen_random_uuid()::text, 'claim:approve', 'Approve Claims', 'CLAIM', NOW(), NOW()),
    (gen_random_uuid()::text, 'claim:reject', 'Reject Claims', 'CLAIM', NOW(), NOW()),
    (gen_random_uuid()::text, 'claim:settle', 'Settle Claims', 'CLAIM', NOW(), NOW()),
    (gen_random_uuid()::text, 'claim:export', 'Export Claims', 'CLAIM', NOW(), NOW()),
    (gen_random_uuid()::text, 'renewal:read', 'Read Renewals', 'POLICY', NOW(), NOW()),
    (gen_random_uuid()::text, 'renewal:update', 'Update Renewals', 'POLICY', NOW(), NOW()),
    (gen_random_uuid()::text, 'renewal:process', 'Process Renewals', 'POLICY', NOW(), NOW()),
    (gen_random_uuid()::text, 'renewal:export', 'Export Renewals', 'POLICY', NOW(), NOW()),
    (gen_random_uuid()::text, 'document:read', 'Read Documents', 'DOCUMENT', NOW(), NOW()),
    (gen_random_uuid()::text, 'document:upload', 'Upload Documents', 'DOCUMENT', NOW(), NOW()),
    (gen_random_uuid()::text, 'document:delete', 'Delete Documents', 'DOCUMENT', NOW(), NOW()),
    (gen_random_uuid()::text, 'commission:read', 'Read Commissions', 'ACCOUNT', NOW(), NOW()),
    (gen_random_uuid()::text, 'commission:process', 'Process Commissions', 'ACCOUNT', NOW(), NOW()),
    (gen_random_uuid()::text, 'commission:configure', 'Configure Commissions', 'ACCOUNT', NOW(), NOW()),
    (gen_random_uuid()::text, 'commission:export', 'Export Commissions', 'ACCOUNT', NOW(), NOW()),
    (gen_random_uuid()::text, 'report:read', 'Read Reports', 'REPORT', NOW(), NOW()),
    (gen_random_uuid()::text, 'report:create', 'Create Reports', 'REPORT', NOW(), NOW()),
    (gen_random_uuid()::text, 'report:export', 'Export Reports', 'REPORT', NOW(), NOW()),
    (gen_random_uuid()::text, 'user:read', 'Read Users', 'USER', NOW(), NOW()),
    (gen_random_uuid()::text, 'user:create', 'Create Users', 'USER', NOW(), NOW()),
    (gen_random_uuid()::text, 'user:update', 'Update Users', 'USER', NOW(), NOW()),
    (gen_random_uuid()::text, 'user:delete', 'Delete Users', 'USER', NOW(), NOW()),
    (gen_random_uuid()::text, 'user:deactivate', 'Deactivate Users', 'USER', NOW(), NOW()),
    (gen_random_uuid()::text, 'system:manage', 'Manage System Settings', 'SYSTEM', NOW(), NOW()),
    (gen_random_uuid()::text, 'audit:read', 'Read Audit Logs', 'SYSTEM', NOW(), NOW())
ON CONFLICT ("code") DO UPDATE SET "name" = EXCLUDED."name", "category" = EXCLUDED."category";

-- Invariant Assertion: Verify that zero canonical permissions are missing
DO $$
DECLARE
    missing_count INT;
BEGIN
    SELECT COUNT(*) INTO missing_count
    FROM (
        VALUES
          ('lead:read'), ('lead:create'), ('lead:update'), ('lead:delete'), ('lead:assign'), ('lead:merge'), ('lead:export'),
          ('contact:read'), ('contact:create'), ('contact:update'), ('contact:delete'), ('contact:export'),
          ('opportunity:read'), ('opportunity:create'), ('opportunity:update'), ('opportunity:pipeline'),
          ('quotation:read'), ('quotation:create'), ('quotation:update'), ('quotation:approve'), ('quotation:reject'), ('quotation:export'),
          ('policy:read'), ('policy:create'), ('policy:update'), ('policy:issue'), ('policy:cancel'), ('policy:export'),
          ('claim:read'), ('claim:create'), ('claim:update'), ('claim:approve'), ('claim:reject'), ('claim:settle'), ('claim:export'),
          ('renewal:read'), ('renewal:update'), ('renewal:process'), ('renewal:export'),
          ('document:read'), ('document:upload'), ('document:delete'),
          ('commission:read'), ('commission:process'), ('commission:configure'), ('commission:export'),
          ('report:read'), ('report:create'), ('report:export'),
          ('user:read'), ('user:create'), ('user:update'), ('user:delete'), ('user:deactivate'),
          ('system:manage'), ('audit:read')
    ) required(code)
    LEFT JOIN "permissions" p ON p.code = required.code
    WHERE p.id IS NULL;

    IF missing_count > 0 THEN
       RAISE EXCEPTION 'PREFLIGHT FAILURE: % canonical permissions missing from database catalog', missing_count;
    END IF;
END $$;

-- ----------------------------------------------------------------------------
-- 10. REBUILD ROLE_PERMISSIONS MATRIX (Explicit Policy-Driven Scopes)
-- ----------------------------------------------------------------------------
CREATE TEMP TABLE temp_canonical_role_permissions (
    role_id TEXT NOT NULL,
    permission_id TEXT NOT NULL,
    scope "AccessScope" NOT NULL
);

-- ADMIN: All 56 permissions with 'ALL' scope
INSERT INTO temp_canonical_role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'ALL'::"AccessScope"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'ADMIN';

-- BACK_OFFICE: Operational permissions with 'ORGANIZATION' scope
-- EXCLUDES: user management, system governance, commission configuration, AND lead:delete (Admin-only)
INSERT INTO temp_canonical_role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'ORGANIZATION'::"AccessScope"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'BACK_OFFICE'
  AND p.code NOT IN (
      'user:create', 'user:delete', 'user:deactivate', 
      'system:manage', 'audit:read', 'commission:configure',
      'lead:delete'
  );

-- AGENT: Directly assignable resources get BOTH OWN and ASSIGNED scopes
INSERT INTO temp_canonical_role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'OWN'::"AccessScope"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'AGENT'
  AND p.code IN (
      'lead:read', 'lead:create', 'lead:update',
      'opportunity:read', 'opportunity:create', 'opportunity:update',
      'renewal:read', 'renewal:update'
  );

INSERT INTO temp_canonical_role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'ASSIGNED'::"AccessScope"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'AGENT'
  AND p.code IN (
      'lead:read', 'lead:update',
      'opportunity:read', 'opportunity:update',
      'renewal:read', 'renewal:update'
  );

-- AGENT: Portfolio, relationship, and personal resources get OWN scope
-- (Parent entity authorization enforced at application policy layer for Document, Claim, Contact)
INSERT INTO temp_canonical_role_permissions (role_id, permission_id, scope)
SELECT r.id, p.id, 'OWN'::"AccessScope"
FROM "roles" r
CROSS JOIN "permissions" p
WHERE r.code = 'AGENT'
  AND p.code IN (
      'contact:read', 'contact:create', 'contact:update',
      'quotation:read', 'quotation:create', 'quotation:update',
      'policy:read', 'policy:create', 'policy:update',
      'claim:read', 'claim:create',
      'document:read', 'document:upload',
      'commission:read'
  );

-- Clean rebuild of role_permissions
DELETE FROM "role_permissions";

ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_pkey";
ALTER TABLE "role_permissions" DROP CONSTRAINT IF EXISTS "role_permissions_roleId_permissionId_scope_key";

-- Populate surrogate id and canonical rows
INSERT INTO "role_permissions" ("id", "roleId", "permissionId", "scope", "assignedAt")
SELECT gen_random_uuid()::text, role_id, permission_id, scope, NOW()
FROM temp_canonical_role_permissions
ON CONFLICT DO NOTHING;

-- Apply Primary Key on surrogate id and unique constraint on (roleId, permissionId, scope)
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("id");
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_permissionId_scope_key" UNIQUE ("roleId", "permissionId", "scope");

-- ----------------------------------------------------------------------------
-- 11. CONSOLIDATE DASHBOARDS (Clean Re-creation of 3 Canonical Registries)
-- ----------------------------------------------------------------------------
DELETE FROM "DashboardRegistry";

INSERT INTO "DashboardRegistry" (
    "id",
    "roleId",
    "jobRoleId",
    "dashboardCode",
    "workspaceCode",
    "title",
    "subtitle",
    "layout",
    "navigation",
    "widgets",
    "quickActions",
    "permissions",
    "createdAt",
    "updatedAt"
) VALUES 
-- Canonical ADMIN Dashboard
(
    gen_random_uuid()::text,
    (SELECT id FROM "roles" WHERE "code" = 'ADMIN' LIMIT 1),
    NULL,
    'admin-dashboard',
    'admin',
    'Administrator Command Center',
    'Executive and administrative oversight',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '["system:manage", "user:read", "audit:read"]'::jsonb,
    NOW(),
    NOW()
),
-- Canonical BACK_OFFICE Dashboard
(
    gen_random_uuid()::text,
    (SELECT id FROM "roles" WHERE "code" = 'BACK_OFFICE' LIMIT 1),
    NULL,
    'back-office-dashboard',
    'operations',
    'Operations & Processing Workspace',
    'Policy issuance, underwriting, claims, finance, and renewals',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '["policy:read", "claim:read", "lead:assign", "quotation:approve"]'::jsonb,
    NOW(),
    NOW()
),
-- Canonical AGENT Dashboard
(
    gen_random_uuid()::text,
    (SELECT id FROM "roles" WHERE "code" = 'AGENT' LIMIT 1),
    NULL,
    'agent-dashboard',
    'sales',
    'Agent Sales Workspace',
    'Customer acquisition, quotations, and active policy portfolio',
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '[]'::jsonb,
    '["lead:read", "lead:create", "quotation:create", "policy:read"]'::jsonb,
    NOW(),
    NOW()
);

-- Enforce at most one dashboard registry record per role
ALTER TABLE "DashboardRegistry" DROP CONSTRAINT IF EXISTS "DashboardRegistry_roleId_key";
ALTER TABLE "DashboardRegistry" ADD CONSTRAINT "DashboardRegistry_roleId_key" UNIQUE ("roleId");

-- ----------------------------------------------------------------------------
-- 12. SCHEMA-SAFE DYNAMIC FOREIGN KEY AUDIT (Zero Unmapped References Assertion)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    r RECORD;
    unmapped_ref_count INT;
    canonical_role_ids TEXT[];
BEGIN
    SELECT array_agg(id) INTO canonical_role_ids
    FROM "roles" WHERE "code" IN ('ADMIN', 'BACK_OFFICE', 'AGENT');

    -- Dynamically verify that NO foreign-key-constrained column references non-canonical roles across any schema
    FOR r IN (
        SELECT
            tc.table_schema,
            tc.table_name,
            kcu.column_name
        FROM information_schema.table_constraints tc
        JOIN information_schema.key_column_usage kcu
          ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
        WHERE tc.constraint_type = 'FOREIGN KEY'
          AND ccu.table_schema = current_schema()
          AND ccu.table_name = 'roles'
          AND ccu.column_name = 'id'
    ) LOOP
        EXECUTE format(
            'SELECT COUNT(*) FROM %I.%I WHERE %I IS NOT NULL AND NOT (%I = ANY($1))',
            r.table_schema, r.table_name, r.column_name, r.column_name
        ) INTO unmapped_ref_count
        USING canonical_role_ids;

        IF unmapped_ref_count > 0 THEN
            RAISE EXCEPTION 'PREFLIGHT FAILURE: Foreign key %I.%I.%I contains % references to non-canonical roles',
                r.table_schema, r.table_name, r.column_name, unmapped_ref_count;
        END IF;
    END LOOP;
END $$;

-- ----------------------------------------------------------------------------
-- 13. DELETE LEGACY ROLES (Safe after all dependencies remapped and verified)
-- ----------------------------------------------------------------------------
DELETE FROM "roles" WHERE "code" NOT IN ('ADMIN', 'BACK_OFFICE', 'AGENT');

-- ----------------------------------------------------------------------------
-- 14. PREFLIGHT HARDENING ASSERTIONS (Zero-Tolerance Quality Gate)
-- ----------------------------------------------------------------------------
DO $$
DECLARE
    legacy_user_count INT;
    unassigned_staff_count INT;
    legacy_wa_count INT;
    legacy_rp_count INT;
    admin_dash_count INT;
    bo_dash_count INT;
    agent_dash_count INT;
    total_dash_count INT;
    duplicate_perms INT;
    remaining_roles INT;
BEGIN
    -- 1. Zero staff users on legacy roles
    SELECT COUNT(*) INTO legacy_user_count
    FROM "users" u JOIN "roles" r ON u."roleId" = r.id
    WHERE r.code NOT IN ('ADMIN', 'BACK_OFFICE', 'AGENT');

    IF legacy_user_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT FAILURE: % users remain assigned to legacy roles', legacy_user_count;
    END IF;

    -- 2. Zero active users with NULL roleId
    SELECT COUNT(*) INTO unassigned_staff_count
    FROM "users" u
    WHERE u.status = 'ACTIVE' AND u."roleId" IS NULL;

    IF unassigned_staff_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT FAILURE: % active users have NULL roleId', unassigned_staff_count;
    END IF;

    -- 3. Zero workflow assignments on legacy roles
    SELECT COUNT(*) INTO legacy_wa_count
    FROM "workflow_assignments" wa JOIN "roles" r ON wa."roleId" = r.id
    WHERE r.code NOT IN ('ADMIN', 'BACK_OFFICE', 'AGENT');

    IF legacy_wa_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT FAILURE: % workflow assignments reference legacy roles', legacy_wa_count;
    END IF;

    -- 4. Zero role permissions on legacy roles
    SELECT COUNT(*) INTO legacy_rp_count
    FROM "role_permissions" rp JOIN "roles" r ON rp."roleId" = r.id
    WHERE r.code NOT IN ('ADMIN', 'BACK_OFFICE', 'AGENT');

    IF legacy_rp_count > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT FAILURE: % role permissions reference legacy roles', legacy_rp_count;
    END IF;

    -- 5. Exactly 1 dashboard per canonical role (Total = 3)
    SELECT COUNT(*) INTO admin_dash_count FROM "DashboardRegistry" WHERE "roleId" = (SELECT id FROM "roles" WHERE "code" = 'ADMIN');
    SELECT COUNT(*) INTO bo_dash_count FROM "DashboardRegistry" WHERE "roleId" = (SELECT id FROM "roles" WHERE "code" = 'BACK_OFFICE');
    SELECT COUNT(*) INTO agent_dash_count FROM "DashboardRegistry" WHERE "roleId" = (SELECT id FROM "roles" WHERE "code" = 'AGENT');
    SELECT COUNT(*) INTO total_dash_count FROM "DashboardRegistry";

    IF admin_dash_count != 1 OR bo_dash_count != 1 OR agent_dash_count != 1 OR total_dash_count != 3 THEN
        RAISE EXCEPTION 'PREFLIGHT FAILURE: Dashboard consolidation invalid (ADMIN=%, BO=%, AGENT=%, TOTAL=%)', 
            admin_dash_count, bo_dash_count, agent_dash_count, total_dash_count;
    END IF;

    -- 6. Zero duplicate permissions per role and scope
    SELECT COUNT(*) - COUNT(DISTINCT ("roleId", "permissionId", "scope")) INTO duplicate_perms
    FROM "role_permissions";

    IF duplicate_perms > 0 THEN
        RAISE EXCEPTION 'PREFLIGHT FAILURE: % duplicate role permissions found', duplicate_perms;
    END IF;

    -- 7. Exactly 3 rows remain in roles table
    SELECT COUNT(*) INTO remaining_roles FROM "roles";
    IF remaining_roles != 3 THEN
        RAISE EXCEPTION 'PREFLIGHT FAILURE: Expected exactly 3 rows in roles table, found %', remaining_roles;
    END IF;
END $$;

COMMIT;
