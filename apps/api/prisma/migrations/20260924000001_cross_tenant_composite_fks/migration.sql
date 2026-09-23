-- Migration: 20260924000001_cross_tenant_composite_fks
-- Sprint 1.4 & 2.3: Database Level Cross-Tenant Composite Constraints & Ledger Tenancy

-- 1. Create Composite Unique Indexes required for Composite Foreign Keys
CREATE UNIQUE INDEX IF NOT EXISTS "contacts_companyId_id_key" ON "public"."contacts"("companyId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "leads_companyId_id_key" ON "public"."leads"("companyId", "id");
CREATE UNIQUE INDEX IF NOT EXISTS "quotations_companyId_id_key" ON "public"."quotations"("companyId", "id");

-- 2. Add Composite Foreign Key Constraints to prevent cross-tenant references at the DB engine level
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'leads_companyId_contactId_fkey'
  ) THEN
    ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_companyId_contactId_fkey"
      FOREIGN KEY ("companyId", "contactId") REFERENCES "public"."contacts"("companyId", "id") ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotations_companyId_contactId_fkey'
  ) THEN
    ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_companyId_contactId_fkey"
      FOREIGN KEY ("companyId", "contactId") REFERENCES "public"."contacts"("companyId", "id") ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'quotations_companyId_leadId_fkey'
  ) THEN
    ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_companyId_leadId_fkey"
      FOREIGN KEY ("companyId", "leadId") REFERENCES "public"."leads"("companyId", "id") ON DELETE RESTRICT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'policies_companyId_quotationId_fkey'
  ) THEN
    ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_companyId_quotationId_fkey"
      FOREIGN KEY ("companyId", "quotationId") REFERENCES "public"."quotations"("companyId", "id") ON DELETE RESTRICT;
  END IF;
END $$;

-- 3. JournalEntry Tenancy & Indexing
ALTER TABLE "public"."JournalEntry" ADD COLUMN IF NOT EXISTS "companyId" TEXT;
CREATE INDEX IF NOT EXISTS "JournalEntry_companyId_date_idx" ON "public"."JournalEntry"("companyId", "date");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'JournalEntry_companyId_fkey'
  ) THEN
    ALTER TABLE "public"."JournalEntry" ADD CONSTRAINT "JournalEntry_companyId_fkey"
      FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE SET NULL;
  END IF;
END $$;
