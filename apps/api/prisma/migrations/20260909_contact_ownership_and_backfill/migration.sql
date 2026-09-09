-- Step 1: Add nullable columns to contacts
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "branchId" TEXT;
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- Step 2: Add foreign key constraints
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_branchId_fkey') THEN
        ALTER TABLE "contacts" ADD CONSTRAINT "contacts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'contacts_companyId_fkey') THEN
        ALTER TABLE "contacts" ADD CONSTRAINT "contacts_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

-- Step 3: Historical data backfill
-- Resolve branchId from createdBy user's branch
UPDATE "contacts" c
SET "branchId" = u."branchId"
FROM "users" u
WHERE c."createdById" = u."id" AND c."branchId" IS NULL AND u."branchId" IS NOT NULL;

-- Fallback branchId if still null: default to first active branch
UPDATE "contacts"
SET "branchId" = (SELECT id FROM "Branch" WHERE "isActive" = true ORDER BY "createdAt" ASC LIMIT 1)
WHERE "branchId" IS NULL;

-- Resolve companyId from branch's hierarchy: branch -> zone -> region -> company
UPDATE "contacts" c
SET "companyId" = r."companyId"
FROM "Branch" b
JOIN "Zone" z ON b."zoneId" = z."id"
JOIN "Region" r ON z."regionId" = r."id"
WHERE c."branchId" = b."id" AND c."companyId" IS NULL;

-- Fallback companyId if still null: default to first active company
UPDATE "contacts"
SET "companyId" = (SELECT id FROM "Company" WHERE "isActive" = true ORDER BY "createdAt" ASC LIMIT 1)
WHERE "companyId" IS NULL;

-- Step 4: Drop legacy index if exists
DROP INDEX IF EXISTS "contacts_accountId_phone_key";

-- Step 5: Create indexes
CREATE INDEX IF NOT EXISTS "contacts_branchId_idx" ON "contacts"("branchId");
CREATE INDEX IF NOT EXISTS "contacts_companyId_idx" ON "contacts"("companyId");
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_companyId_phone_key" ON "contacts"("companyId", "phone");
