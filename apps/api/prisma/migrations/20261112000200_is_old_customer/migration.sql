-- AlterTable
ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "isOldCustomer" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "isOldCustomer" BOOLEAN NOT NULL DEFAULT false;

