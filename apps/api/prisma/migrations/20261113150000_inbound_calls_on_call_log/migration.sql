-- Incoming (IVR) calls: a call can be logged before any agent answers,
-- and we remember which IVR menu key the caller pressed.
ALTER TABLE "call_logs" ALTER COLUMN "userId" DROP NOT NULL;

ALTER TABLE "call_logs" ADD COLUMN "ivrOption" TEXT;
