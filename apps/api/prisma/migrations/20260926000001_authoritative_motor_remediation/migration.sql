-- Migration: 20260926000001_authoritative_motor_remediation
-- Authoritative Single Motor Journey Schema Consolidation

-- 1. Update MotorWorkflowState Enum Values
DO $$
BEGIN
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'READY_FOR_PROPOSAL';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'PROPOSAL_IN_PROGRESS';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'PROPOSAL_COMPLETED';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'PROPOSAL_APPROVED';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'PAYMENT_UNDER_PROCESS';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'PAYMENT_DONE';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'INSPECTION_REQUIRED';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'INSPECTION_SUBMITTED';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'INSPECTION_REJECTED';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'INSPECTION_COMPLETED';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'ISSUANCE_PENDING';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'ISSUANCE_IN_PROGRESS';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'POLICY_ISSUED';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'ACTIVE';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'REJECTED';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'CANCELLED';
  ALTER TYPE "MotorWorkflowState" ADD VALUE IF NOT EXISTS 'EXPIRED';
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 2. MotorJourneys Table
CREATE TABLE IF NOT EXISTS "public"."motor_journeys" (
  "id" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "actorId" TEXT NOT NULL,
  "leadId" TEXT,
  "contactId" TEXT,
  "vehicleCategory" TEXT,
  "policyType" TEXT,
  "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS',
  "quotationId" TEXT,
  "metadata" JSONB,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "motor_journeys_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "motor_journeys_quotationId_key" ON "public"."motor_journeys"("quotationId");
CREATE INDEX IF NOT EXISTS "motor_journeys_companyId_status_idx" ON "public"."motor_journeys"("companyId", "status");
CREATE INDEX IF NOT EXISTS "motor_journeys_actorId_idx" ON "public"."motor_journeys"("actorId");

-- 3. VehicleVerificationAttempts Table
CREATE TABLE IF NOT EXISTS "public"."vehicle_verification_attempts" (
  "id" TEXT NOT NULL,
  "journeyId" TEXT NOT NULL,
  "registrationHash" TEXT NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 1,
  "actorId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "vehicle_verification_attempts_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "vehicle_verification_attempts_journeyId_registrationHash_key" ON "public"."vehicle_verification_attempts"("journeyId", "registrationHash");
CREATE INDEX IF NOT EXISTS "vehicle_verification_attempts_companyId_registrationHash_idx" ON "public"."vehicle_verification_attempts"("companyId", "registrationHash");

-- 4. MotorQuotationMigration Table
CREATE TABLE IF NOT EXISTS "public"."motor_quotation_migrations" (
  "id" TEXT NOT NULL,
  "legacyId" TEXT NOT NULL,
  "canonicalId" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "migratedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "payloadSnapshot" JSONB NOT NULL,
  CONSTRAINT "motor_quotation_migrations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "motor_quotation_migrations_legacyId_key" ON "public"."motor_quotation_migrations"("legacyId");
CREATE UNIQUE INDEX IF NOT EXISTS "motor_quotation_migrations_canonicalId_key" ON "public"."motor_quotation_migrations"("canonicalId");

-- 5. MotorPaymentRecord Hardening
ALTER TABLE "public"."motor_payment_records" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS "motor_payment_records_companyId_paymentMethod_referenceNu_key" ON "public"."motor_payment_records"("companyId", "paymentMethod", "referenceNumber");

-- 6. IdempotencyKey Fields
ALTER TABLE "public"."idempotency_keys" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "public"."idempotency_keys" ADD COLUMN IF NOT EXISTS "resourceId" TEXT;
ALTER TABLE "public"."idempotency_keys" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'IN_PROGRESS';
ALTER TABLE "public"."idempotency_keys" ADD COLUMN IF NOT EXISTS "responseStatus" INTEGER;

-- 7. Reporting Multitenancy Columns
ALTER TABLE "public"."reports" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "public"."report_schedules" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
ALTER TABLE "public"."report_executions" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
