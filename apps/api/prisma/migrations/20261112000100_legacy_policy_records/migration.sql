-- Independent historical policy records. These rows intentionally have no quotation,
-- payment, inspection, or normal Policy foreign keys.
CREATE TYPE "LegacyPolicyStatus" AS ENUM ('ACTIVE', 'EXPIRED', 'CANCELLED');
CREATE TYPE "LegacyRenewalReminderStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

CREATE TABLE "legacy_policy_records" (
  "id" TEXT NOT NULL,
  "legacyPolicyNumber" TEXT NOT NULL,
  "insurerName" TEXT NOT NULL,
  "insurerPolicyNumber" TEXT NOT NULL,
  "productType" TEXT NOT NULL,
  "coverageDescription" TEXT,
  "premiumAmount" DECIMAL(12,2) NOT NULL,
  "policyStartDate" TIMESTAMP(3) NOT NULL,
  "policyExpiryDate" TIMESTAMP(3) NOT NULL,
  "issueDate" TIMESTAMP(3),
  "status" "LegacyPolicyStatus" NOT NULL,
  "customerId" TEXT,
  "contactId" TEXT,
  "companyId" TEXT NOT NULL,
  "evidenceDocumentId" TEXT NOT NULL,
  "agentDeclaration" BOOLEAN NOT NULL,
  "declarationText" TEXT NOT NULL,
  "createdById" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legacy_policy_records_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "legacy_policy_renewal_reminders" (
  "id" TEXT NOT NULL,
  "legacyPolicyId" TEXT NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "offsetDays" INTEGER NOT NULL,
  "status" "LegacyRenewalReminderStatus" NOT NULL DEFAULT 'PENDING',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "legacy_policy_renewal_reminders_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "legacy_policy_records_legacyPolicyNumber_key" ON "legacy_policy_records"("legacyPolicyNumber");
CREATE UNIQUE INDEX "legacy_policy_records_companyId_insurerName_insurerPolicyNumber_key" ON "legacy_policy_records"("companyId","insurerName","insurerPolicyNumber");
CREATE INDEX "legacy_policy_records_companyId_customerId_idx" ON "legacy_policy_records"("companyId","customerId");
CREATE INDEX "legacy_policy_records_companyId_contactId_idx" ON "legacy_policy_records"("companyId","contactId");
CREATE INDEX "legacy_policy_records_companyId_policyExpiryDate_status_idx" ON "legacy_policy_records"("companyId","policyExpiryDate","status");
CREATE INDEX "legacy_policy_records_createdById_idx" ON "legacy_policy_records"("createdById");
CREATE UNIQUE INDEX "legacy_policy_renewal_reminders_legacyPolicyId_offsetDays_key" ON "legacy_policy_renewal_reminders"("legacyPolicyId","offsetDays");
CREATE INDEX "legacy_policy_renewal_reminders_dueDate_status_idx" ON "legacy_policy_renewal_reminders"("dueDate","status");
CREATE INDEX "legacy_policy_renewal_reminders_legacyPolicyId_idx" ON "legacy_policy_renewal_reminders"("legacyPolicyId");

ALTER TABLE "legacy_policy_records" ADD CONSTRAINT "legacy_policy_records_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_policy_records" ADD CONSTRAINT "legacy_policy_records_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_policy_records" ADD CONSTRAINT "legacy_policy_records_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_policy_records" ADD CONSTRAINT "legacy_policy_records_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "legacy_policy_renewal_reminders" ADD CONSTRAINT "legacy_policy_renewal_reminders_legacyPolicyId_fkey" FOREIGN KEY ("legacyPolicyId") REFERENCES "legacy_policy_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;
