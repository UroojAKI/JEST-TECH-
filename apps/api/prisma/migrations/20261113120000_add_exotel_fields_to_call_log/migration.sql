-- Exotel telephony: click-to-call results and call recording storage/expiry.
-- All columns are nullable so existing manually logged calls are unaffected.
ALTER TABLE "call_logs"
  ADD COLUMN "provider" TEXT,
  ADD COLUMN "providerCallSid" TEXT,
  ADD COLUMN "callStatus" TEXT,
  ADD COLUMN "fromNumber" TEXT,
  ADD COLUMN "toNumber" TEXT,
  ADD COLUMN "startedAt" TIMESTAMP(3),
  ADD COLUMN "endedAt" TIMESTAMP(3),
  ADD COLUMN "recordingUrl" TEXT,
  ADD COLUMN "recordingStorageKey" TEXT,
  ADD COLUMN "recordingExpiresAt" TIMESTAMP(3),
  ADD COLUMN "recordingDeletedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "call_logs_providerCallSid_key" ON "call_logs"("providerCallSid");

CREATE INDEX "call_logs_recordingExpiresAt_idx" ON "call_logs"("recordingExpiresAt");
