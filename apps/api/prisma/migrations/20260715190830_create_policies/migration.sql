-- CreateEnum
CREATE TYPE "public"."PolicyStatus" AS ENUM ('ACTIVE', 'LAPSED', 'CANCELLED', 'PENDING_RENEWAL');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateTable
CREATE TABLE "public"."policies" (
    "id" TEXT NOT NULL,
    "policyNumber" TEXT NOT NULL,
    "status" "public"."PolicyStatus" NOT NULL DEFAULT 'ACTIVE',
    "quotationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "accountId" TEXT,
    "premiumAmount" DECIMAL(65,30) NOT NULL,
    "effectiveDate" TIMESTAMP(3) NOT NULL,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policy_members" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "policy_members_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policy_nominees" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "relation" TEXT NOT NULL,
    "percentage" DECIMAL(65,30) NOT NULL,

    CONSTRAINT "policy_nominees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policy_renewals" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "renewalNumber" INTEGER NOT NULL,
    "previousExpiry" TIMESTAMP(3) NOT NULL,
    "newExpiry" TIMESTAMP(3) NOT NULL,
    "premiumAmount" DECIMAL(65,30) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_renewals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policy_payments" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'SUCCESS',

    CONSTRAINT "policy_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policy_documents" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."policy_histories" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "comments" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "policy_histories_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "policies_policyNumber_key" ON "public"."policies"("policyNumber");

-- CreateIndex
CREATE UNIQUE INDEX "policies_quotationId_key" ON "public"."policies"("quotationId");

-- CreateIndex
CREATE INDEX "policies_policyNumber_idx" ON "public"."policies"("policyNumber");

-- CreateIndex
CREATE INDEX "policies_status_idx" ON "public"."policies"("status");

-- CreateIndex
CREATE INDEX "policy_members_policyId_idx" ON "public"."policy_members"("policyId");

-- CreateIndex
CREATE INDEX "policy_nominees_policyId_idx" ON "public"."policy_nominees"("policyId");

-- CreateIndex
CREATE INDEX "policy_renewals_policyId_idx" ON "public"."policy_renewals"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_payments_transactionId_key" ON "public"."policy_payments"("transactionId");

-- CreateIndex
CREATE INDEX "policy_payments_policyId_idx" ON "public"."policy_payments"("policyId");

-- CreateIndex
CREATE INDEX "policy_documents_policyId_idx" ON "public"."policy_documents"("policyId");

-- CreateIndex
CREATE INDEX "policy_histories_policyId_idx" ON "public"."policy_histories"("policyId");

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_members" ADD CONSTRAINT "policy_members_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_nominees" ADD CONSTRAINT "policy_nominees_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_renewals" ADD CONSTRAINT "policy_renewals_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_payments" ADD CONSTRAINT "policy_payments_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_documents" ADD CONSTRAINT "policy_documents_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_histories" ADD CONSTRAINT "policy_histories_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_histories" ADD CONSTRAINT "policy_histories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
