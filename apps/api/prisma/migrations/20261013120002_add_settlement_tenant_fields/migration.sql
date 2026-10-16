-- AlterTable Settlement: add tenant isolation and calculation fields
ALTER TABLE "Settlement" ADD COLUMN "companyId" TEXT;
ALTER TABLE "Settlement" ADD COLUMN "insurerName" TEXT;
ALTER TABLE "Settlement" ADD COLUMN "retainedCommission" DECIMAL(19,4) DEFAULT 0;
ALTER TABLE "Settlement" ADD COLUMN "netPayable" DECIMAL(19,4);
ALTER TABLE "Settlement" ADD COLUMN "period" TEXT;

-- CreateIndex
CREATE INDEX "Settlement_companyId_idx" ON "Settlement"("companyId");

-- AddForeignKey
ALTER TABLE "Settlement" ADD CONSTRAINT "Settlement_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
