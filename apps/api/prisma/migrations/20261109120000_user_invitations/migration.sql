CREATE TABLE "user_invitations" (
  "id" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "email" TEXT NOT NULL,
  "companyId" TEXT NOT NULL,
  "invitedById" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "consumedAt" TIMESTAMP(3),
  "revokedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "user_invitations_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "user_invitations_userId_key" ON "user_invitations"("userId");
CREATE UNIQUE INDEX "user_invitations_tokenHash_key" ON "user_invitations"("tokenHash");
CREATE INDEX "user_invitations_companyId_email_idx" ON "user_invitations"("companyId", "email");
CREATE INDEX "user_invitations_expiresAt_consumedAt_idx" ON "user_invitations"("expiresAt", "consumedAt");

ALTER TABLE "user_invitations"
  ADD CONSTRAINT "user_invitations_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
