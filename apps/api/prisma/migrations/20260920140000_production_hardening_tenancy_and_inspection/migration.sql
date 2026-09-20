-- STEP 1: Add new enum values to InspectionStatus if not present
DO $$
BEGIN
    ALTER TYPE "public"."InspectionStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED_FOR_REVIEW';
    ALTER TYPE "public"."InspectionStatus" ADD VALUE IF NOT EXISTS 'WAIVED';
    ALTER TYPE "public"."InspectionStatus" ADD VALUE IF NOT EXISTS 'EXPIRED';
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- STEP 2: Preflight Verification & Fail-Closed Ownership Resolution
DO $$
DECLARE
    default_company_id TEXT;
    orphan_user_count INT;
    orphan_contact_count INT;
    orphan_quote_count INT;
BEGIN
    -- 1. Identify canonical company
    SELECT "id" INTO default_company_id FROM "public"."Company" ORDER BY "createdAt" ASC LIMIT 1;
    IF default_company_id IS NULL THEN
        RAISE EXCEPTION 'Preflight Failure: No canonical Company found in database.';
    END IF;

    -- 2. Backfill Users from Branch or fallback to canonical Company
    UPDATE "public"."users" u
    SET "companyId" = COALESCE(b."companyId", default_company_id)
    FROM "public"."branches" b
    WHERE u."branchId" = b."id" AND u."companyId" IS NULL;

    UPDATE "public"."users"
    SET "companyId" = default_company_id
    WHERE "companyId" IS NULL;

    -- 3. Backfill Contacts from Account, Branch, or fallback to canonical Company
    UPDATE "public"."contacts" c
    SET "companyId" = COALESCE(a."companyId", b."companyId", default_company_id)
    LEFT JOIN "public"."accounts" a ON c."accountId" = a."id"
    LEFT JOIN "public"."branches" b ON c."branchId" = b."id"
    WHERE c."companyId" IS NULL;

    UPDATE "public"."contacts"
    SET "companyId" = default_company_id
    WHERE "companyId" IS NULL;

    -- 4. Backfill Quotations from Contact, Lead, or fallback
    UPDATE "public"."quotations" q
    SET "companyId" = COALESCE(c."companyId", l."companyId", default_company_id)
    LEFT JOIN "public"."contacts" c ON q."contactId" = c."id"
    LEFT JOIN "public"."leads" l ON q."leadId" = l."id"
    WHERE q."companyId" IS NULL;

    UPDATE "public"."quotations"
    SET "companyId" = default_company_id
    WHERE "companyId" IS NULL;

    -- 5. Orphan Check: Fail-closed abort if any unresolved NULL rows remain
    SELECT COUNT(*) INTO orphan_user_count FROM "public"."users" WHERE "companyId" IS NULL;
    SELECT COUNT(*) INTO orphan_contact_count FROM "public"."contacts" WHERE "companyId" IS NULL;
    SELECT COUNT(*) INTO orphan_quote_count FROM "public"."quotations" WHERE "companyId" IS NULL;

    IF orphan_user_count > 0 OR orphan_contact_count > 0 OR orphan_quote_count > 0 THEN
        RAISE EXCEPTION 'Migration Aborted: % orphan users, % orphan contacts, % orphan quotations detected.',
            orphan_user_count, orphan_contact_count, orphan_quote_count;
    END IF;
END $$;

-- STEP 3: Enforce NOT NULL on users, contacts, and quotations
ALTER TABLE "public"."users" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "public"."contacts" ALTER COLUMN "companyId" SET NOT NULL;
ALTER TABLE "public"."quotations" ALTER COLUMN "companyId" SET NOT NULL;

-- STEP 4: Motor Inspection Tenancy & Waiver Columns
ALTER TABLE "public"."motor_inspections" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "public"."motor_inspections" ADD COLUMN IF NOT EXISTS "waivedById" TEXT;
ALTER TABLE "public"."motor_inspections" ADD COLUMN IF NOT EXISTS "waivedAt" TIMESTAMP(3);
ALTER TABLE "public"."motor_inspections" ADD COLUMN IF NOT EXISTS "waiverReason" TEXT;

-- Backfill Motor Inspections from Quotation
UPDATE "public"."motor_inspections" mi
SET "companyId" = q."companyId"
FROM "public"."quotations" q
WHERE mi."quotationId" = q."id" AND mi."companyId" IS NULL;

DO $$
DECLARE
    default_company_id TEXT;
BEGIN
    SELECT "id" INTO default_company_id FROM "public"."Company" ORDER BY "createdAt" ASC LIMIT 1;
    IF default_company_id IS NOT NULL THEN
        UPDATE "public"."motor_inspections" SET "companyId" = default_company_id WHERE "companyId" IS NULL;
    END IF;
END $$;

ALTER TABLE "public"."motor_inspections" ALTER COLUMN "companyId" SET NOT NULL;

-- Add Foreign Key Constraints if not exists
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'motor_inspections_companyId_fkey'
    ) THEN
        ALTER TABLE "public"."motor_inspections" ADD CONSTRAINT "motor_inspections_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT;
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'motor_inspections_waivedById_fkey'
    ) THEN
        ALTER TABLE "public"."motor_inspections" ADD CONSTRAINT "motor_inspections_waivedById_fkey"
            FOREIGN KEY ("waivedById") REFERENCES "public"."users"("id") ON DELETE SET NULL;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "motor_inspections_companyId_idx" ON "public"."motor_inspections"("companyId");
CREATE INDEX IF NOT EXISTS "motor_inspections_companyId_status_idx" ON "public"."motor_inspections"("companyId", "status");

-- STEP 5: Create MotorInspectionHistory Table
CREATE TABLE IF NOT EXISTS "public"."motor_inspection_histories" (
    "id" TEXT NOT NULL,
    "inspectionId" TEXT NOT NULL,
    "fromStatus" "public"."InspectionStatus" NOT NULL,
    "toStatus" "public"."InspectionStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "actorRole" TEXT NOT NULL,
    "reason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "motor_inspection_histories_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'motor_inspection_histories_inspectionId_fkey'
    ) THEN
        ALTER TABLE "public"."motor_inspection_histories" ADD CONSTRAINT "motor_inspection_histories_inspectionId_fkey"
            FOREIGN KEY ("inspectionId") REFERENCES "public"."motor_inspections"("id") ON DELETE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "motor_inspection_histories_inspectionId_idx" ON "public"."motor_inspection_histories"("inspectionId");

-- STEP 6: OutboxEvent Idempotency Column
ALTER TABLE "public"."outbox_events" ADD COLUMN IF NOT EXISTS "eventKey" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "outbox_events_eventKey_key" ON "public"."outbox_events"("eventKey");

-- STEP 7: BackOfficeTask Idempotency & Tenancy
ALTER TABLE "public"."back_office_tasks" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "public"."back_office_tasks" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT;
ALTER TABLE "public"."back_office_tasks" ADD COLUMN IF NOT EXISTS "sourceType" TEXT;
ALTER TABLE "public"."back_office_tasks" ADD COLUMN IF NOT EXISTS "sourceEntityId" TEXT;

DO $$
DECLARE
    default_company_id TEXT;
BEGIN
    SELECT "id" INTO default_company_id FROM "public"."Company" ORDER BY "createdAt" ASC LIMIT 1;
    IF default_company_id IS NOT NULL THEN
        UPDATE "public"."back_office_tasks" SET "companyId" = default_company_id WHERE "companyId" IS NULL;
    END IF;
END $$;

ALTER TABLE "public"."back_office_tasks" ALTER COLUMN "companyId" SET NOT NULL;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'back_office_tasks_companyId_fkey'
    ) THEN
        ALTER TABLE "public"."back_office_tasks" ADD CONSTRAINT "back_office_tasks_companyId_fkey"
            FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT;
    END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "back_office_tasks_companyId_idempotencyKey_key"
    ON "public"."back_office_tasks"("companyId", "idempotencyKey")
    WHERE "idempotencyKey" IS NOT NULL;
