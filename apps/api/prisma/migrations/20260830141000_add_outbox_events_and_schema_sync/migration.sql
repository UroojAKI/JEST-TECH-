-- CreateEnum
CREATE TYPE "public"."OutboxStatus" AS ENUM ('PENDING', 'PROCESSING', 'PUBLISHED', 'FAILED');

-- AlterEnum
ALTER TYPE "public"."PolicyStatus" ADD VALUE 'ISSUED';

-- AlterEnum
ALTER TYPE "public"."QuotationStatus" ADD VALUE 'ACCEPTED';

-- AlterTable
ALTER TABLE "public"."policies" ALTER COLUMN "status" SET DEFAULT 'DRAFT';

-- AlterTable
ALTER TABLE "public"."renewal_tasks" ADD COLUMN     "offsetDays" INTEGER NOT NULL DEFAULT 30;

-- CreateTable
CREATE TABLE "public"."insurer_policy_details" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "insurerPolicyNumber" TEXT,
    "insurerQuoteId" TEXT,
    "insurerProposalId" TEXT,
    "submissionPayload" JSONB,
    "responsePayload" JSONB,
    "issuedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurer_policy_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."outbox_events" (
    "id" TEXT NOT NULL,
    "aggregateType" TEXT NOT NULL,
    "aggregateId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "public"."OutboxStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "processedAt" TIMESTAMP(3),

    CONSTRAINT "outbox_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "insurer_policy_details_policyId_key" ON "public"."insurer_policy_details"("policyId");

-- CreateIndex
CREATE INDEX "insurer_policy_details_policyId_idx" ON "public"."insurer_policy_details"("policyId");

-- CreateIndex
CREATE INDEX "insurer_policy_details_insurerPolicyNumber_idx" ON "public"."insurer_policy_details"("insurerPolicyNumber");

-- CreateIndex
CREATE INDEX "outbox_events_status_createdAt_idx" ON "public"."outbox_events"("status", "createdAt");

-- CreateIndex
CREATE INDEX "outbox_events_aggregateType_aggregateId_idx" ON "public"."outbox_events"("aggregateType", "aggregateId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_versions_quotationId_versionNumber_key" ON "public"."quotation_versions"("quotationId", "versionNumber");

-- CreateIndex
CREATE UNIQUE INDEX "renewal_tasks_policyId_offsetDays_key" ON "public"."renewal_tasks"("policyId", "offsetDays");

-- AddForeignKey
ALTER TABLE "public"."insurer_policy_details" ADD CONSTRAINT "insurer_policy_details_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;