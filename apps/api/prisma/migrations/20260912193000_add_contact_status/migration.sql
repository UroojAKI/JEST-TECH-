-- Step 1: Create ContactStatus enum if it does not exist
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'ContactStatus') THEN
        CREATE TYPE "ContactStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'ARCHIVED');
    END IF;
END $$;

-- Step 2: Add status column to contacts table if it does not exist
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "status" "ContactStatus" NOT NULL DEFAULT 'ACTIVE';

-- Step 3: Create index on status column
CREATE INDEX IF NOT EXISTS "contacts_status_idx" ON "contacts"("status");
