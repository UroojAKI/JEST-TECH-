-- Persist the predecessor policy for every renewal quotation and issued policy.
ALTER TABLE "quotations" ADD COLUMN "renewalOfPolicyId" TEXT;
ALTER TABLE "policies" ADD COLUMN "renewedFromPolicyId" TEXT;

CREATE INDEX "quotations_renewalOfPolicyId_idx" ON "quotations"("renewalOfPolicyId");
CREATE INDEX "policies_renewedFromPolicyId_idx" ON "policies"("renewedFromPolicyId");

ALTER TABLE "quotations"
  ADD CONSTRAINT "quotations_renewalOfPolicyId_fkey"
  FOREIGN KEY ("renewalOfPolicyId") REFERENCES "policies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "policies"
  ADD CONSTRAINT "policies_renewedFromPolicyId_fkey"
  FOREIGN KEY ("renewedFromPolicyId") REFERENCES "policies"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
