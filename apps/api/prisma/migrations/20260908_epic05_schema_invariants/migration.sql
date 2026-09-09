-- AlterEnum
ALTER TYPE "OutboxStatus" ADD VALUE IF NOT EXISTS 'DELIVERED';
ALTER TYPE "OutboxStatus" ADD VALUE IF NOT EXISTS 'DEAD_LETTER';

-- AlterTable
ALTER TABLE "users" ADD COLUMN "authVersion" INTEGER NOT NULL DEFAULT 1;

-- AlterTable
ALTER TABLE "outbox_events" ADD COLUMN "maxAttempts" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN "nextRetryAt" TIMESTAMP(3),
ADD COLUMN "deadLetteredAt" TIMESTAMP(3);

-- CreateIndex
CREATE UNIQUE INDEX "contacts_accountId_phone_key" ON "contacts"("accountId", "phone");

-- CreateTable
CREATE TABLE "idempotency_keys" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "operationType" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responsePayload" JSONB,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "idempotency_keys_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idempotency_keys_actorId_operationType_idempotencyKey_key" ON "idempotency_keys"("actorId", "operationType", "idempotencyKey");
