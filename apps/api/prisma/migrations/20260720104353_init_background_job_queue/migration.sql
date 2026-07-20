-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('NOTIFICATION', 'RENEWAL', 'REPORT', 'WORKFLOW', 'DOCUMENT', 'AUDIT', 'SEARCH', 'EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'RETRYING', 'DELAYED');

-- CreateTable
CREATE TABLE "public"."BackgroundJob" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "jobId" TEXT,
    "type" "public"."JobType" NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdBy" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJob_jobId_key" ON "public"."BackgroundJob"("jobId");

-- CreateIndex
CREATE INDEX "BackgroundJob_queue_status_idx" ON "public"."BackgroundJob"("queue", "status");

-- CreateIndex
CREATE INDEX "BackgroundJob_type_idx" ON "public"."BackgroundJob"("type");

-- CreateIndex
CREATE INDEX "BackgroundJob_jobId_idx" ON "public"."BackgroundJob"("jobId");
