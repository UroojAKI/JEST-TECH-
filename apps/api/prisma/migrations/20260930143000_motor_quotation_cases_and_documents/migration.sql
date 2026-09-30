-- Migration: 20260930143000_motor_quotation_cases_and_documents
-- Canonical Motor Quotation Case and Motor Quotation Document Association (V2 Architecture)

-- 1. Create Enums if not exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MotorCaseStatus') THEN
    CREATE TYPE "public"."MotorCaseStatus" AS ENUM ('OPEN', 'QUOTED', 'SELECTED', 'COMPLETED', 'CANCELLED');
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MotorDocumentType') THEN
    CREATE TYPE "public"."MotorDocumentType" AS ENUM (
      'INSURER_QUOTE', 'RC', 'PREVIOUS_POLICY', 'DRIVING_LICENSE', 'PAN',
      'ADDRESS_PROOF', 'INSPECTION_REPORT', 'INSPECTION_PHOTOS', 'INVOICE',
      'FORM_21', 'FORM_22', 'HYPOTHECATION', 'NOC', 'PERMIT', 'PUC',
      'FITNESS_CERTIFICATE', 'NATIONAL_PERMIT', 'AGGREGATOR_AGREEMENT',
      'COMMERCIAL_DL', 'SPECIAL_PURPOSE_CERTIFICATE', 'OTHER'
    );
  END IF;
END $$;

-- 2. Create motor_quotation_cases table
CREATE TABLE IF NOT EXISTS "public"."motor_quotation_cases" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "category" "public"."VehicleCategory" NOT NULL,
    "vehicleStatus" "public"."VehicleStatus" NOT NULL DEFAULT 'EXISTING',
    "registrationNumber" TEXT,
    "contactId" TEXT NOT NULL,
    "vehicleId" TEXT,
    "leadId" TEXT,
    "journeyId" TEXT,
    "selectedQuoteId" TEXT,
    "status" "public"."MotorCaseStatus" NOT NULL DEFAULT 'OPEN',
    "customerSnapshot" JSONB NOT NULL,
    "vehicleSnapshot" JSONB NOT NULL,
    "previousPolicySnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "motor_quotation_cases_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "motor_quotation_cases_caseCode_key" ON "public"."motor_quotation_cases"("caseCode");
CREATE INDEX IF NOT EXISTS "motor_quotation_cases_companyId_idx" ON "public"."motor_quotation_cases"("companyId");
CREATE INDEX IF NOT EXISTS "motor_quotation_cases_contactId_idx" ON "public"."motor_quotation_cases"("contactId");
CREATE INDEX IF NOT EXISTS "motor_quotation_cases_caseCode_idx" ON "public"."motor_quotation_cases"("caseCode");
CREATE INDEX IF NOT EXISTS "motor_quotation_cases_leadId_idx" ON "public"."motor_quotation_cases"("leadId");
CREATE INDEX IF NOT EXISTS "motor_quotation_cases_vehicleId_idx" ON "public"."motor_quotation_cases"("vehicleId");
CREATE INDEX IF NOT EXISTS "motor_quotation_cases_selectedQuoteId_idx" ON "public"."motor_quotation_cases"("selectedQuoteId");

-- 3. Add caseId to quotations table
ALTER TABLE "public"."quotations" ADD COLUMN IF NOT EXISTS "caseId" TEXT;
CREATE INDEX IF NOT EXISTS "quotations_caseId_idx" ON "public"."quotations"("caseId");

-- 4. Foreign keys for motor_quotation_cases and quotations
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotation_cases_companyId_fkey') THEN
    ALTER TABLE "public"."motor_quotation_cases" ADD CONSTRAINT "motor_quotation_cases_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotation_cases_contactId_fkey') THEN
    ALTER TABLE "public"."motor_quotation_cases" ADD CONSTRAINT "motor_quotation_cases_contactId_fkey"
      FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotation_cases_vehicleId_fkey') THEN
    ALTER TABLE "public"."motor_quotation_cases" ADD CONSTRAINT "motor_quotation_cases_vehicleId_fkey"
      FOREIGN KEY ("vehicleId") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotation_cases_leadId_fkey') THEN
    ALTER TABLE "public"."motor_quotation_cases" ADD CONSTRAINT "motor_quotation_cases_leadId_fkey"
      FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotation_cases_selectedQuoteId_fkey') THEN
    ALTER TABLE "public"."motor_quotation_cases" ADD CONSTRAINT "motor_quotation_cases_selectedQuoteId_fkey"
      FOREIGN KEY ("selectedQuoteId") REFERENCES "public"."quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'quotations_caseId_fkey') THEN
    ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "public"."motor_quotation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

-- 5. Create motor_quotation_documents table (reusing core documents storage)
CREATE TABLE IF NOT EXISTS "public"."motor_quotation_documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseId" TEXT,
    "quotationId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentType" "public"."MotorDocumentType" NOT NULL,
    "verificationStatus" "public"."DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "motor_quotation_documents_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "motor_quotation_documents_companyId_idx" ON "public"."motor_quotation_documents"("companyId");
CREATE INDEX IF NOT EXISTS "motor_quotation_documents_quotationId_idx" ON "public"."motor_quotation_documents"("quotationId");
CREATE INDEX IF NOT EXISTS "motor_quotation_documents_caseId_idx" ON "public"."motor_quotation_documents"("caseId");
CREATE INDEX IF NOT EXISTS "motor_quotation_documents_documentId_idx" ON "public"."motor_quotation_documents"("documentId");

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotation_documents_companyId_fkey') THEN
    ALTER TABLE "public"."motor_quotation_documents" ADD CONSTRAINT "motor_quotation_documents_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotation_documents_caseId_fkey') THEN
    ALTER TABLE "public"."motor_quotation_documents" ADD CONSTRAINT "motor_quotation_documents_caseId_fkey"
      FOREIGN KEY ("caseId") REFERENCES "public"."motor_quotation_cases"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotation_documents_quotationId_fkey') THEN
    ALTER TABLE "public"."motor_quotation_documents" ADD CONSTRAINT "motor_quotation_documents_quotationId_fkey"
      FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotation_documents_documentId_fkey') THEN
    ALTER TABLE "public"."motor_quotation_documents" ADD CONSTRAINT "motor_quotation_documents_documentId_fkey"
      FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;