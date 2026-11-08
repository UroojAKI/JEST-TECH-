ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "failedLoginWindowStartedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "lockedUntil" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "users_lockedUntil_idx" ON "users" ("lockedUntil");
