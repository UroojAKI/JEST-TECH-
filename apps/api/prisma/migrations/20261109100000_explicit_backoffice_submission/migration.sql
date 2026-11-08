-- Keep quotations in the agent workspace until an explicit handoff to back office.
ALTER TABLE "quotations"
  ADD COLUMN "backOfficeSubmittedAt" TIMESTAMP(3),
  ADD COLUMN "backOfficeSubmittedById" TEXT;

CREATE INDEX "quotations_companyId_backOfficeSubmittedAt_idx"
  ON "quotations"("companyId", "backOfficeSubmittedAt");
