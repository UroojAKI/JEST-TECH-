-- Link each inspection directly to its canonical motor case.
-- Apply the new enum default only after its value is committed by the prior migration.
ALTER TYPE "public"."MotorCaseStatus"
  ADD VALUE IF NOT EXISTS 'INSPECTION_WAIVED';

ALTER TABLE "public"."motor_quotation_cases"
  ALTER COLUMN "status" SET DEFAULT 'DRAFT'::"public"."MotorCaseStatus";

ALTER TABLE "public"."motor_inspections"
  ADD COLUMN IF NOT EXISTS "caseId" TEXT;
ALTER TABLE "public"."motor_inspections"
  ADD COLUMN IF NOT EXISTS "rejectionCode" TEXT;

ALTER TABLE "public"."back_office_tasks"
  ADD COLUMN IF NOT EXISTS "quotationId" TEXT;

UPDATE "public"."back_office_tasks" AS task
SET "quotationId" = quotation."id"
FROM "public"."quotations" AS quotation
WHERE task."companyId" = quotation."companyId"
  AND task."quotationId" IS NULL
  AND task."sourceEntityId" = quotation."id"
  AND task."sourceType" IN ('MOTOR_QUOTATION', 'QUOTATION');

UPDATE "public"."motor_inspections" AS inspection
SET "caseId" = quotation."caseId"
FROM "public"."quotations" AS quotation
WHERE inspection."quotationId" = quotation."id"
  AND inspection."caseId" IS NULL
  AND quotation."caseId" IS NOT NULL
  AND EXISTS (
    SELECT 1
    FROM "public"."motor_quotation_cases" AS motor_case
    WHERE motor_case."id" = quotation."caseId"
      AND motor_case."companyId" = quotation."companyId"
  );

CREATE INDEX IF NOT EXISTS "motor_inspections_caseId_idx"
  ON "public"."motor_inspections"("caseId");
CREATE INDEX IF NOT EXISTS "back_office_tasks_quotationId_idx"
  ON "public"."back_office_tasks"("quotationId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'motor_inspections_caseId_fkey'
  ) THEN
    ALTER TABLE "public"."motor_inspections"
      ADD CONSTRAINT "motor_inspections_caseId_fkey"
      FOREIGN KEY ("caseId")
      REFERENCES "public"."motor_quotation_cases"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'back_office_tasks_quotationId_fkey'
  ) THEN
    ALTER TABLE "public"."back_office_tasks"
      ADD CONSTRAINT "back_office_tasks_quotationId_fkey"
      FOREIGN KEY ("quotationId")
      REFERENCES "public"."quotations"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
