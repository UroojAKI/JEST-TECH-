-- Migration: 20260930000001_sync_authoritative_motor_and_vehicles
-- Synchronize Vehicles multi-tenancy and Motor Journey / Verification Attempts schema with schema.prisma

-- 1. Add companyId to vehicles
ALTER TABLE "public"."vehicles" ADD COLUMN IF NOT EXISTS "companyId" TEXT;

-- Backfill vehicles.companyId from contact, lead, or default canonical company
UPDATE "public"."vehicles" v
SET "companyId" = COALESCE(
  (SELECT c."companyId" FROM "public"."contacts" c WHERE c."id" = v."contactId"),
  (SELECT l."companyId" FROM "public"."leads" l WHERE l."id" = v."leadId"),
  (SELECT "id" FROM "public"."Company" ORDER BY "createdAt" ASC LIMIT 1)
)
WHERE v."companyId" IS NULL;

CREATE INDEX IF NOT EXISTS "vehicles_companyId_idx" ON "public"."vehicles"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_companyId_fkey'
  ) THEN
    ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 2. Motor Journeys relations and index alignment
CREATE INDEX IF NOT EXISTS "motor_journeys_companyId_actorId_idx" ON "public"."motor_journeys"("companyId", "actorId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'motor_journeys_companyId_fkey'
  ) THEN
    ALTER TABLE "public"."motor_journeys" ADD CONSTRAINT "motor_journeys_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'motor_journeys_quotationId_fkey'
  ) THEN
    ALTER TABLE "public"."motor_journeys" ADD CONSTRAINT "motor_journeys_quotationId_fkey"
      FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 3. Vehicle Verification Attempts schema synchronization
ALTER TABLE "public"."vehicle_verification_attempts" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE "public"."vehicle_verification_attempts" ADD COLUMN IF NOT EXISTS "lockedAt" TIMESTAMP(3);
ALTER TABLE "public"."vehicle_verification_attempts" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);
ALTER TABLE "public"."vehicle_verification_attempts" ADD COLUMN IF NOT EXISTS "ipAddress" TEXT;

CREATE INDEX IF NOT EXISTS "vehicle_verification_attempts_companyId_actorId_registratio_idx"
  ON "public"."vehicle_verification_attempts"("companyId", "actorId", "registrationHash");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'vehicle_verification_attempts_journeyId_fkey'
  ) THEN
    ALTER TABLE "public"."vehicle_verification_attempts" ADD CONSTRAINT "vehicle_verification_attempts_journeyId_fkey"
      FOREIGN KEY ("journeyId") REFERENCES "public"."motor_journeys"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- 4. Motor Quotation Migrations schema alignment
ALTER TABLE "public"."motor_quotation_migrations" ADD COLUMN IF NOT EXISTS "oldMotorQuotationId" TEXT;
ALTER TABLE "public"."motor_quotation_migrations" ADD COLUMN IF NOT EXISTS "newQuotationId" TEXT;
ALTER TABLE "public"."motor_quotation_migrations" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'COMPLETED';

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'motor_quotation_migrations' AND column_name = 'legacyId') THEN
    UPDATE "public"."motor_quotation_migrations" SET "oldMotorQuotationId" = "legacyId" WHERE "oldMotorQuotationId" IS NULL;
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'motor_quotation_migrations' AND column_name = 'canonicalId') THEN
    UPDATE "public"."motor_quotation_migrations" SET "newQuotationId" = "canonicalId" WHERE "newQuotationId" IS NULL;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "motor_quotation_migrations_oldMotorQuotationId_key" ON "public"."motor_quotation_migrations"("oldMotorQuotationId");
CREATE UNIQUE INDEX IF NOT EXISTS "motor_quotation_migrations_newQuotationId_key" ON "public"."motor_quotation_migrations"("newQuotationId");

-- 5. Idempotency Key Composite Unique Index
CREATE INDEX IF NOT EXISTS "idempotency_keys_companyId_actorId_idx" ON "public"."idempotency_keys"("companyId", "actorId");
CREATE UNIQUE INDEX IF NOT EXISTS "idempotency_keys_companyId_actorId_operationType_idempotenc_key"
  ON "public"."idempotency_keys"("companyId", "actorId", "operationType", "idempotencyKey");

-- 6. Reports & Payment Record Indexing and FKs
CREATE INDEX IF NOT EXISTS "motor_payment_records_companyId_idx" ON "public"."motor_payment_records"("companyId");
CREATE INDEX IF NOT EXISTS "reports_companyId_idx" ON "public"."reports"("companyId");
CREATE INDEX IF NOT EXISTS "report_schedules_companyId_idx" ON "public"."report_schedules"("companyId");
CREATE INDEX IF NOT EXISTS "report_executions_companyId_idx" ON "public"."report_executions"("companyId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'reports_companyId_fkey'
  ) THEN
    ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
