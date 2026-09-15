-- ============================================================================
-- WAVE 1 CONTRACT MIGRATION: Enum Narrowing & Legacy Schema Retirement
-- ============================================================================

BEGIN;

-- 1. Drop defaultRoleType from JobRole (completes authorization decoupling)
ALTER TABLE "JobRole" DROP COLUMN IF EXISTS "defaultRoleType";

-- Ensure audit/backup tables retain values as TEXT so they do not block enum retirement
DO $$ BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rbac_migration_backup_roles' AND column_name = 'type') THEN
        ALTER TABLE "rbac_migration_backup_roles" ALTER COLUMN "type" TYPE TEXT;
    END IF;
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'rbac_migration_backup_job_roles' AND column_name = 'defaultRoleType') THEN
        ALTER TABLE "rbac_migration_backup_job_roles" ALTER COLUMN "defaultRoleType" TYPE TEXT;
    END IF;
END $$;

-- 2. Zero-Surprise RoleType Dependency Discovery: Deep PostgreSQL pg_depend Catalog Inspection
-- MUST EXECUTE BEFORE ENUM CONVERSION TO VERIFY ZERO OBJECTS STILL REFERENCE RoleType
DO $$
DECLARE
    dep_count INT;
    dep_descriptions TEXT;
BEGIN
    SELECT 
        COUNT(*),
        COALESCE(string_agg(
            CASE 
                WHEN dep.classid = 'pg_class'::regclass THEN 
                    (SELECT format('%I.%I (column %I)', n.nspname, c.relname, a.attname)
                     FROM pg_class c 
                     JOIN pg_namespace n ON n.oid = c.relnamespace
                     LEFT JOIN pg_attribute a ON a.attrelid = c.oid AND a.attnum = dep.objsubid
                     WHERE c.oid = dep.objid)
                WHEN dep.classid = 'pg_proc'::regclass THEN 
                    (SELECT format('function %I.%I()', n.nspname, p.proname)
                     FROM pg_proc p 
                     JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE p.oid = dep.objid)
                ELSE format('object %s (class %s)', dep.objid, dep.classid)
            END, ', '
        ), '')
    INTO dep_count, dep_descriptions
    FROM pg_depend dep
    JOIN pg_type t ON t.oid = dep.refobjid
    WHERE t.typname = 'RoleType'
      AND dep.deptype != 'i';

    IF dep_count > 0 THEN
        RAISE EXCEPTION 'CONTRACT FAILURE: Cannot drop RoleType enum, % database dependencies remain: %', dep_count, dep_descriptions;
    END IF;
END $$;

-- 3. Create new narrowed enum RoleType_new
CREATE TYPE "RoleType_new" AS ENUM ('ADMIN', 'BACK_OFFICE', 'AGENT');

-- 4. Convert roles.type column from TEXT to RoleType_new
ALTER TABLE "roles" ALTER COLUMN "type" TYPE "RoleType_new" USING ("type"::"RoleType_new");

-- 5. Drop old RoleType enum and rename new enum
DROP TYPE "RoleType";
ALTER TYPE "RoleType_new" RENAME TO "RoleType";

-- 6. Restore unique index on Role.type
CREATE UNIQUE INDEX "roles_type_key" ON "roles"("type");

-- 7. Contract Final Invariant Assertion: Ensure exactly 3 roles in roles table
DO $$
DECLARE
    role_count INT;
BEGIN
    SELECT COUNT(*) INTO role_count FROM "roles";
    IF role_count != 3 THEN
        RAISE EXCEPTION 'CONTRACT FAILURE: Expected exactly 3 roles in roles table, found %', role_count;
    END IF;
END $$;

COMMIT;
