ALTER TABLE "contacts" ADD COLUMN IF NOT EXISTS "panNumberHash" VARCHAR(64);
ALTER TABLE "customers" ADD COLUMN IF NOT EXISTS "panNumberHash" VARCHAR(64);
ALTER TABLE "accounts" ADD COLUMN IF NOT EXISTS "panNumberHash" VARCHAR(64);

CREATE INDEX IF NOT EXISTS "contacts_companyId_panNumberHash_idx"
  ON "contacts" ("companyId", "panNumberHash");
CREATE INDEX IF NOT EXISTS "customers_companyId_panNumberHash_idx"
  ON "customers" ("companyId", "panNumberHash");
CREATE INDEX IF NOT EXISTS "accounts_panNumberHash_idx"
  ON "accounts" ("panNumberHash");
