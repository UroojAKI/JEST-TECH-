-- CreateEnum
DO $$ BEGIN
    CREATE TYPE "DocumentComplianceStatus" AS ENUM ('VERIFIED', 'REQUIRES_VERIFICATION', 'PENDING_UPLOAD', 'INVALID', 'MISSING_LEGACY');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- AlterTable policies
ALTER TABLE "policies" ADD COLUMN IF NOT EXISTS "documentComplianceStatus" "DocumentComplianceStatus" NOT NULL DEFAULT 'PENDING_UPLOAD';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "policies_companyId_documentComplianceStatus_idx" ON "policies"("companyId", "documentComplianceStatus");

-- AlterTable motor_inspections
ALTER TABLE "motor_inspections" ADD COLUMN IF NOT EXISTS "additionalEvidence" JSONB;

-- Safe backfill for existing policies:
-- 1. If policy has an issuedPolicyDocumentId OR has at least one POLICY_DOCUMENT / POLICY_SCHEDULE document, mark VERIFIED
UPDATE "policies" p
SET "documentComplianceStatus" = 'VERIFIED'
WHERE p."issuedPolicyDocumentId" IS NOT NULL
  OR EXISTS (
    SELECT 1 FROM "policy_documents" pd
    WHERE pd."policyId" = p."id"
      AND pd."documentType" IN ('POLICY_DOCUMENT', 'POLICY_SCHEDULE')
  );

-- 2. If policy is in non-draft status (ISSUED, ACTIVE, RENEWED, etc.) but has NO policy documents at all, mark as MISSING_LEGACY
UPDATE "policies" p
SET "documentComplianceStatus" = 'MISSING_LEGACY'
WHERE p."documentComplianceStatus" = 'PENDING_UPLOAD'
  AND p."status" IN ('ISSUED', 'ACTIVE', 'RENEWED', 'LAPSED', 'PENDING_RENEWAL')
  AND NOT EXISTS (
    SELECT 1 FROM "policy_documents" pd WHERE pd."policyId" = p."id"
  );
