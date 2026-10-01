-- Wave 2: Canonical Domain Model & Case State Machine Migration
-- Adds 14 new states to MotorCaseStatus enum (total 19 canonical states + legacy)
-- Adds UNRESOLVED_MIGRATION to BackOfficeTaskStatus enum
-- Adds case_id foreign key and index to back_office_tasks
-- Updates default status on motor_quotation_cases to DRAFT

ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'DRAFT';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'CUSTOMER_VERIFIED';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'VEHICLE_VERIFIED';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'QUOTE_GENERATED';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'PROPOSAL_READY';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'SUBMITTED_FOR_REVIEW';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'BACK_OFFICE_REVIEW';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'INSPECTION_REQUIRED';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'INSPECTION_SUBMITTED';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'INSPECTION_APPROVED';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_VERIFIED';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'DOCUMENTS_VERIFIED';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'READY_FOR_ISSUANCE';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'ISSUED';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'REJECTED';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'REWORK_REQUIRED';
ALTER TYPE "MotorCaseStatus" ADD VALUE IF NOT EXISTS 'RESUBMITTED';

ALTER TYPE "BackOfficeTaskStatus" ADD VALUE IF NOT EXISTS 'UNRESOLVED_MIGRATION';

ALTER TABLE "back_office_tasks" ADD COLUMN IF NOT EXISTS "case_id" TEXT;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'back_office_tasks_case_id_fkey') THEN
        ALTER TABLE "back_office_tasks" ADD CONSTRAINT "back_office_tasks_case_id_fkey" 
        FOREIGN KEY ("case_id") REFERENCES "motor_quotation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS "back_office_tasks_case_id_idx" ON "back_office_tasks"("case_id");

ALTER TABLE "motor_quotation_cases" ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"MotorCaseStatus";
