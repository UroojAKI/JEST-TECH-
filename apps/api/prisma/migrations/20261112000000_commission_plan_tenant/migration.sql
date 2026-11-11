-- Add tenant ownership to commission plans. Existing global/legacy plans remain
-- nullable and are deliberately excluded from tenant accrual until recreated
-- under an owning company by an authorized administrator.
ALTER TABLE "CommissionPlan"
  ADD COLUMN "companyId" TEXT;

ALTER TABLE "CommissionPlan"
  ADD CONSTRAINT "CommissionPlan_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

CREATE INDEX "CommissionPlan_companyId_isActive_idx"
  ON "CommissionPlan"("companyId", "isActive");
