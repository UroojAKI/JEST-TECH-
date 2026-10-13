-- AddColumn: direct tenant key for belt-and-suspenders tenant isolation
ALTER TABLE "Commission" ADD COLUMN "companyId" TEXT;

-- BackfillFromUser: populate companyId from the related user record
UPDATE "Commission" c
SET "companyId" = u."companyId"
FROM "User" u
WHERE c."userId" = u."id"
  AND u."companyId" IS NOT NULL;

-- AddIndex
CREATE INDEX "Commission_companyId_idx" ON "Commission"("companyId");

-- AddForeignKey (nullable FK — non-blocking, allows legacy rows without companyId)
ALTER TABLE "Commission" ADD CONSTRAINT "Commission_companyId_fkey"
  FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE SET NULL ON UPDATE CASCADE;
