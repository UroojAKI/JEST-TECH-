-- DropForeignKey
ALTER TABLE "public"."users" DROP CONSTRAINT "users_roleId_fkey";

-- DropIndex
DROP INDEX "public"."agents_agentCode_idx";

-- DropIndex
DROP INDEX "public"."agents_agentCode_key";

-- DropIndex
DROP INDEX "public"."contacts_companyId_phone_key";

-- DropIndex
DROP INDEX "public"."customers_email_idx";

-- DropIndex
DROP INDEX "public"."customers_mobile_idx";

-- AlterTable
ALTER TABLE "public"."DashboardRegistry" ALTER COLUMN "roleId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."agents" ADD COLUMN     "companyId" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."back_office_tasks" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "idempotencyKey" TEXT,
ADD COLUMN     "sourceEntityId" TEXT,
ADD COLUMN     "sourceType" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."claims" ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "backOfficeAssigneeId" TEXT,
ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "public"."customer_alerts" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."customers" ADD COLUMN     "companyId" TEXT,
ADD COLUMN     "primaryAgentId" TEXT,
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."inspections" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."leads" ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "public"."motor_quotations" ADD COLUMN     "companyId" TEXT,
ALTER COLUMN "updatedAt" DROP DEFAULT;

-- AlterTable
ALTER TABLE "public"."policies" ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "public"."quotations" ADD COLUMN     "agentId" TEXT,
ADD COLUMN     "companyId" TEXT;

-- AlterTable
ALTER TABLE "public"."role_permissions" ALTER COLUMN "id" DROP DEFAULT,
ALTER COLUMN "scope" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."tasks" ALTER COLUMN "updatedAt" DROP DEFAULT;

-- Backfill existing records to the primary Company
DO $$
DECLARE
    default_company_id TEXT;
BEGIN
    SELECT "id" INTO default_company_id FROM "public"."Company" LIMIT 1;
    IF default_company_id IS NOT NULL THEN
        UPDATE "public"."agents" SET "companyId" = default_company_id WHERE "companyId" IS NULL;
        UPDATE "public"."customers" SET "companyId" = default_company_id WHERE "companyId" IS NULL;
        UPDATE "public"."leads" SET "companyId" = default_company_id WHERE "companyId" IS NULL;
        UPDATE "public"."quotations" SET "companyId" = default_company_id WHERE "companyId" IS NULL;
        UPDATE "public"."policies" SET "companyId" = default_company_id WHERE "companyId" IS NULL;
        UPDATE "public"."claims" SET "companyId" = default_company_id WHERE "companyId" IS NULL;
        UPDATE "public"."motor_quotations" SET "companyId" = default_company_id WHERE "companyId" IS NULL;
        UPDATE "public"."back_office_tasks" SET "companyId" = default_company_id WHERE "companyId" IS NULL;
    END IF;
END $$;

-- CreateTable
CREATE TABLE "public"."customer_agent_histories" (
    "id" TEXT NOT NULL,
    "companyId" TEXT,
    "customerId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "assignedById" TEXT,
    "reason" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "unassignedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_agent_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "customer_agent_histories_companyId_idx" ON "public"."customer_agent_histories"("companyId");

-- CreateIndex
CREATE INDEX "customer_agent_histories_companyId_customerId_idx" ON "public"."customer_agent_histories"("companyId", "customerId");

-- CreateIndex
CREATE INDEX "customer_agent_histories_companyId_agentId_idx" ON "public"."customer_agent_histories"("companyId", "agentId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "unique_active_customer_agent" ON "public"."customer_agent_histories" ("customerId") WHERE "unassignedAt" IS NULL;

-- CreateIndex
CREATE INDEX "agents_companyId_idx" ON "public"."agents"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "agents_companyId_agentCode_key" ON "public"."agents"("companyId", "agentCode");

-- CreateIndex
CREATE INDEX "back_office_tasks_companyId_status_idx" ON "public"."back_office_tasks"("companyId", "status");

-- CreateIndex
CREATE INDEX "back_office_tasks_companyId_sourceType_sourceEntityId_idx" ON "public"."back_office_tasks"("companyId", "sourceType", "sourceEntityId");

-- CreateIndex
CREATE INDEX "back_office_tasks_companyId_idx" ON "public"."back_office_tasks"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "back_office_tasks_companyId_idempotencyKey_key" ON "public"."back_office_tasks"("companyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "claims_companyId_idx" ON "public"."claims"("companyId");

-- CreateIndex
CREATE INDEX "claims_agentId_idx" ON "public"."claims"("agentId");

-- CreateIndex
CREATE INDEX "claims_backOfficeAssigneeId_idx" ON "public"."claims"("backOfficeAssigneeId");

-- CreateIndex
CREATE INDEX "contacts_companyId_phone_idx" ON "public"."contacts"("companyId", "phone");

-- CreateIndex
CREATE INDEX "contacts_companyId_email_idx" ON "public"."contacts"("companyId", "email");

-- CreateIndex
CREATE INDEX "customers_companyId_mobile_idx" ON "public"."customers"("companyId", "mobile");

-- CreateIndex
CREATE INDEX "customers_companyId_email_idx" ON "public"."customers"("companyId", "email");

-- CreateIndex
CREATE INDEX "customers_companyId_idx" ON "public"."customers"("companyId");

-- CreateIndex
CREATE INDEX "customers_primaryAgentId_idx" ON "public"."customers"("primaryAgentId");

-- CreateIndex
CREATE INDEX "leads_companyId_idx" ON "public"."leads"("companyId");

-- CreateIndex
CREATE INDEX "leads_agentId_idx" ON "public"."leads"("agentId");

-- CreateIndex
CREATE INDEX "motor_quotations_companyId_idx" ON "public"."motor_quotations"("companyId");

-- CreateIndex
CREATE INDEX "policies_companyId_idx" ON "public"."policies"("companyId");

-- CreateIndex
CREATE INDEX "policies_agentId_idx" ON "public"."policies"("agentId");

-- CreateIndex
CREATE INDEX "quotations_companyId_idx" ON "public"."quotations"("companyId");

-- CreateIndex
CREATE INDEX "quotations_agentId_idx" ON "public"."quotations"("agentId");

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claims" ADD CONSTRAINT "claims_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claims" ADD CONSTRAINT "claims_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claims" ADD CONSTRAINT "claims_backOfficeAssigneeId_fkey" FOREIGN KEY ("backOfficeAssigneeId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."agents" ADD CONSTRAINT "agents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_primaryAgentId_fkey" FOREIGN KEY ("primaryAgentId") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."motor_quotations" ADD CONSTRAINT "motor_quotations_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."back_office_tasks" ADD CONSTRAINT "back_office_tasks_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_agent_histories" ADD CONSTRAINT "customer_agent_histories_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_agent_histories" ADD CONSTRAINT "customer_agent_histories_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_agent_histories" ADD CONSTRAINT "customer_agent_histories_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."agents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."customer_agent_histories" ADD CONSTRAINT "customer_agent_histories_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
