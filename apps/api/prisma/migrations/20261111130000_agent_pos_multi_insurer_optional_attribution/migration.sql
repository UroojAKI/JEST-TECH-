-- Agent POS: one partner can have insurer-specific identifiers for multiple insurers.
DROP INDEX IF EXISTS "pos_insurer_mappings_posPartnerId_key";
CREATE UNIQUE INDEX IF NOT EXISTS "pos_insurer_mappings_posPartnerId_insurerId_key"
  ON "pos_insurer_mappings"("posPartnerId", "insurerId");
CREATE INDEX IF NOT EXISTS "pos_insurer_mappings_posPartnerId_isActive_idx"
  ON "pos_insurer_mappings"("posPartnerId", "isActive");

-- Preserve insurer-side Agent POS identifiers on each policy at issuance time.
ALTER TABLE "policies"
  ADD COLUMN IF NOT EXISTS "insurerPartnerCodeSnapshot" TEXT,
  ADD COLUMN IF NOT EXISTS "insurerPospIdSnapshot" TEXT;
