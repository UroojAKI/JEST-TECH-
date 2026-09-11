-- Migration: Durable RenewalJob table for PostgreSQL-backed renewal obligation tracking
-- Purpose: Persist renewal reminder obligations BEFORE BullMQ dispatch to survive Redis failures

CREATE TYPE "RenewalJobStatus" AS ENUM (
  'PENDING',
  'PROCESSING',
  'COMPLETED',
  'FAILED',
  'RETRYING',
  'DEAD_LETTER'
);

CREATE TABLE "renewal_jobs" (
  "id"             TEXT NOT NULL,
  "policyId"       TEXT NOT NULL,
  "renewalCycle"   INTEGER NOT NULL,
  "offsetDays"     INTEGER NOT NULL,
  "scheduledFor"   TIMESTAMP(3) NOT NULL,
  "status"         "RenewalJobStatus" NOT NULL DEFAULT 'PENDING',
  "attempts"       INTEGER NOT NULL DEFAULT 0,
  "lastAttemptAt"  TIMESTAMP(3),
  "nextRetryAt"    TIMESTAMP(3),
  "deadLetteredAt" TIMESTAMP(3),
  "errorMessage"   TEXT,
  "providerJobId"  TEXT,
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL,

  CONSTRAINT "renewal_jobs_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "renewal_jobs_policyId_renewalCycle_offsetDays_key"
  ON "renewal_jobs"("policyId", "renewalCycle", "offsetDays");

CREATE INDEX "renewal_jobs_status_scheduledFor_idx"
  ON "renewal_jobs"("status", "scheduledFor");

CREATE INDEX "renewal_jobs_policyId_idx"
  ON "renewal_jobs"("policyId");

ALTER TABLE "renewal_jobs"
  ADD CONSTRAINT "renewal_jobs_policyId_fkey"
  FOREIGN KEY ("policyId") REFERENCES "policies"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;
