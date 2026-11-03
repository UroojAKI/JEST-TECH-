-- AlterEnum
ALTER TYPE "EndorsementType" ADD VALUE IF NOT EXISTS 'GENERAL_CHANGE';

-- AlterTable endorsements
ALTER TABLE "endorsements" ADD COLUMN IF NOT EXISTS "baseVersion" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "endorsements" ADD COLUMN IF NOT EXISTS "beforeSnapshot" JSONB;
ALTER TABLE "endorsements" ADD COLUMN IF NOT EXISTS "rejectionReason" TEXT;

-- AlterTable policies
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "hasPendingApproval" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX IF NOT EXISTS "policies_companyId_hasPendingApproval_idx" ON "policies"("companyId", "hasPendingApproval");

-- Safe Backfill: set hasPendingApproval = true for existing policies with active pending endorsements
UPDATE "policies" p
SET "hasPendingApproval" = true
WHERE EXISTS (
  SELECT 1 FROM "endorsements" e
  WHERE e."policyId" = p."id"
    AND e."status" IN ('REQUESTED', 'UNDER_REVIEW')
);

