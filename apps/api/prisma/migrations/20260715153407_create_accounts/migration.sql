-- CreateEnum
CREATE TYPE "public"."AccountType" AS ENUM ('INDIVIDUAL', 'CORPORATE', 'SME', 'ENTERPRISE', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "public"."CommunicationChannel" AS ENUM ('EMAIL', 'PHONE', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "public"."KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterTable
ALTER TABLE "public"."contacts" ADD COLUMN     "accountId" TEXT;

-- CreateTable
CREATE TABLE "public"."accounts" (
    "id" TEXT NOT NULL,
    "accountCode" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."AccountType" NOT NULL,
    "industry" TEXT,
    "website" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "gstNumber" TEXT,
    "panNumber" TEXT,
    "annualRevenue" DECIMAL(65,30),
    "employeeCount" INTEGER,
    "description" TEXT,
    "status" BOOLEAN NOT NULL DEFAULT true,
    "preferredCommunication" "public"."CommunicationChannel" NOT NULL DEFAULT 'EMAIL',
    "preferredLanguage" TEXT,
    "kycStatus" "public"."KycStatus" NOT NULL DEFAULT 'PENDING',
    "kycCompletedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_accountCode_key" ON "public"."accounts"("accountCode");

-- CreateIndex
CREATE INDEX "accounts_name_idx" ON "public"."accounts"("name");

-- CreateIndex
CREATE INDEX "accounts_phone_idx" ON "public"."accounts"("phone");

-- CreateIndex
CREATE INDEX "accounts_email_idx" ON "public"."accounts"("email");

-- CreateIndex
CREATE INDEX "accounts_accountCode_idx" ON "public"."accounts"("accountCode");

-- CreateIndex
CREATE INDEX "contacts_accountId_idx" ON "public"."contacts"("accountId");

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
