-- CreateEnum
CREATE TYPE "PosPartnerType" AS ENUM ('INDIVIDUAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "PosPartnerStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'INACTIVE');

-- CreateEnum
CREATE TYPE "PosVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- AlterEnum
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POS_PARTNER_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POS_PARTNER_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POS_PARTNER_SUSPENDED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POS_PARTNER_REACTIVATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POS_INSURER_MAPPED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POS_INSURER_REMAPPED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POS_DOCUMENT_UPLOADED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POS_DOCUMENT_VERIFIED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POS_COMMISSION_AGREEMENT_CREATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POS_COMMISSION_AGREEMENT_UPDATED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POLICY_POS_ATTRIBUTED';
ALTER TYPE "AuditAction" ADD VALUE IF NOT EXISTS 'POLICY_ADDRESS_UPDATED';

-- CreateTable
CREATE TABLE "pos_partners" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "posCode" TEXT NOT NULL,
    "partnerType" "PosPartnerType" NOT NULL,
    "name" TEXT NOT NULL,
    "displayName" TEXT,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "registrationNumber" TEXT,
    "panNumberEncrypted" TEXT,
    "status" "PosPartnerStatus" NOT NULL DEFAULT 'ACTIVE',
    "verificationStatus" "PosVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "effectiveFrom" TIMESTAMP(3),
    "effectiveUntil" TIMESTAMP(3),
    "address" JSONB,
    "createdById" TEXT NOT NULL,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "pos_partners_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_insurer_mappings" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "posPartnerId" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "insurerPartnerCode" TEXT,
    "insurerPospId" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_insurer_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_partner_documents" (
    "id" TEXT NOT NULL,
    "posPartnerId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT,
    "fileSize" INTEGER,
    "verificationStatus" "PosVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "expiryDate" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_partner_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_commission_agreements" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "posPartnerId" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "insuranceProductId" TEXT,
    "commissionType" TEXT NOT NULL DEFAULT 'PERCENTAGE',
    "commissionRate" DECIMAL(65,30),
    "fixedAmount" DECIMAL(65,30),
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "effectiveUntil" TIMESTAMP(3),
    "approvalStatus" TEXT NOT NULL DEFAULT 'APPROVED',
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_commission_agreements_pkey" PRIMARY KEY ("id")
);

-- AlterTable policies
ALTER TABLE "policies"
    ADD COLUMN IF NOT EXISTS "posPartnerId" TEXT,
    ADD COLUMN IF NOT EXISTS "posInsurerMappingId" TEXT,
    ADD COLUMN IF NOT EXISTS "distributionChannel" TEXT DEFAULT 'POS',
    ADD COLUMN IF NOT EXISTS "posCodeSnapshot" TEXT,
    ADD COLUMN IF NOT EXISTS "posNameSnapshot" TEXT,
    ADD COLUMN IF NOT EXISTS "insurerCodeSnapshot" TEXT,
    ADD COLUMN IF NOT EXISTS "insurerNameSnapshot" TEXT,
    ADD COLUMN IF NOT EXISTS "addressLine1" TEXT,
    ADD COLUMN IF NOT EXISTS "addressLine2" TEXT,
    ADD COLUMN IF NOT EXISTS "landmark" TEXT,
    ADD COLUMN IF NOT EXISTS "locality" TEXT,
    ADD COLUMN IF NOT EXISTS "city" TEXT,
    ADD COLUMN IF NOT EXISTS "district" TEXT,
    ADD COLUMN IF NOT EXISTS "state" TEXT,
    ADD COLUMN IF NOT EXISTS "stateCode" TEXT,
    ADD COLUMN IF NOT EXISTS "pincode" TEXT,
    ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'India',
    ADD COLUMN IF NOT EXISTS "addressSource" TEXT,
    ADD COLUMN IF NOT EXISTS "addressCapturedAt" TIMESTAMP(3),
    ADD COLUMN IF NOT EXISTS "addressSnapshot" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pos_partners_companyId_posCode_key" ON "pos_partners"("companyId", "posCode");
CREATE INDEX IF NOT EXISTS "pos_partners_companyId_status_idx" ON "pos_partners"("companyId", "status");
CREATE INDEX IF NOT EXISTS "pos_partners_companyId_name_idx" ON "pos_partners"("companyId", "name");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "pos_insurer_mappings_posPartnerId_key" ON "pos_insurer_mappings"("posPartnerId");
CREATE INDEX IF NOT EXISTS "pos_insurer_mappings_companyId_insurerId_isActive_idx" ON "pos_insurer_mappings"("companyId", "insurerId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_partner_documents_posPartnerId_idx" ON "pos_partner_documents"("posPartnerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "pos_commission_agreements_companyId_posPartnerId_idx" ON "pos_commission_agreements"("companyId", "posPartnerId");
CREATE INDEX IF NOT EXISTS "pos_commission_agreements_companyId_insurerId_idx" ON "pos_commission_agreements"("companyId", "insurerId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "policies_posPartnerId_idx" ON "policies"("posPartnerId");

-- AddForeignKey
ALTER TABLE "pos_partners" DROP CONSTRAINT IF EXISTS "pos_partners_companyId_fkey";
ALTER TABLE "pos_partners" ADD CONSTRAINT "pos_partners_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_partners" DROP CONSTRAINT IF EXISTS "pos_partners_createdById_fkey";
ALTER TABLE "pos_partners" ADD CONSTRAINT "pos_partners_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "pos_partners" DROP CONSTRAINT IF EXISTS "pos_partners_updatedById_fkey";
ALTER TABLE "pos_partners" ADD CONSTRAINT "pos_partners_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_insurer_mappings" DROP CONSTRAINT IF EXISTS "pos_insurer_mappings_posPartnerId_fkey";
ALTER TABLE "pos_insurer_mappings" ADD CONSTRAINT "pos_insurer_mappings_posPartnerId_fkey" FOREIGN KEY ("posPartnerId") REFERENCES "pos_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_insurer_mappings" DROP CONSTRAINT IF EXISTS "pos_insurer_mappings_insurerId_fkey";
ALTER TABLE "pos_insurer_mappings" ADD CONSTRAINT "pos_insurer_mappings_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "insurers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_partner_documents" DROP CONSTRAINT IF EXISTS "pos_partner_documents_posPartnerId_fkey";
ALTER TABLE "pos_partner_documents" ADD CONSTRAINT "pos_partner_documents_posPartnerId_fkey" FOREIGN KEY ("posPartnerId") REFERENCES "pos_partners"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_commission_agreements" DROP CONSTRAINT IF EXISTS "pos_commission_agreements_posPartnerId_fkey";
ALTER TABLE "pos_commission_agreements" ADD CONSTRAINT "pos_commission_agreements_posPartnerId_fkey" FOREIGN KEY ("posPartnerId") REFERENCES "pos_partners"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "pos_commission_agreements" DROP CONSTRAINT IF EXISTS "pos_commission_agreements_insurerId_fkey";
ALTER TABLE "pos_commission_agreements" ADD CONSTRAINT "pos_commission_agreements_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "insurers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "policies" DROP CONSTRAINT IF EXISTS "policies_posPartnerId_fkey";
ALTER TABLE "policies" ADD CONSTRAINT "policies_posPartnerId_fkey" FOREIGN KEY ("posPartnerId") REFERENCES "pos_partners"("id") ON DELETE SET NULL ON UPDATE CASCADE;
