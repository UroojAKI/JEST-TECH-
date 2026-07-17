-- CreateEnum
CREATE TYPE "public"."QuotationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED_TO_POLICY');

-- CreateTable
CREATE TABLE "public"."quotations" (
    "id" TEXT NOT NULL,
    "quotationCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "status" "public"."QuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "leadId" TEXT,
    "contactId" TEXT NOT NULL,
    "accountId" TEXT,
    "insurerName" TEXT NOT NULL,
    "productType" TEXT NOT NULL,
    "sumInsured" DECIMAL(65,30) NOT NULL,
    "basePremium" DECIMAL(65,30) NOT NULL,
    "gstAmount" DECIMAL(65,30) NOT NULL,
    "totalPremium" DECIMAL(65,30) NOT NULL,
    "ncbPercentage" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" DECIMAL(65,30) NOT NULL DEFAULT 0,
    "expiryDate" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quotation_versions" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "sumInsured" DECIMAL(65,30) NOT NULL,
    "basePremium" DECIMAL(65,30) NOT NULL,
    "gstAmount" DECIMAL(65,30) NOT NULL,
    "totalPremium" DECIMAL(65,30) NOT NULL,
    "discountAmount" DECIMAL(65,30) NOT NULL,
    "metadata" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quotation_addons" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "addonCode" TEXT NOT NULL,
    "addonName" TEXT NOT NULL,
    "premium" DECIMAL(65,30) NOT NULL,
    "description" TEXT,

    CONSTRAINT "quotation_addons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quotation_discounts" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "discountType" TEXT NOT NULL,
    "percentage" DECIMAL(65,30),
    "amount" DECIMAL(65,30) NOT NULL,
    "description" TEXT,

    CONSTRAINT "quotation_discounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quotation_comparisons" (
    "id" TEXT NOT NULL,
    "comparisonCode" TEXT NOT NULL,
    "leadId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_comparisons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quotation_histories" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "comments" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."quotation_documents" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "quotation_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quotationCode_key" ON "public"."quotations"("quotationCode");

-- CreateIndex
CREATE INDEX "quotations_quotationCode_idx" ON "public"."quotations"("quotationCode");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "public"."quotations"("status");

-- CreateIndex
CREATE INDEX "quotation_versions_quotationId_idx" ON "public"."quotation_versions"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_addons_quotationId_idx" ON "public"."quotation_addons"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_discounts_quotationId_idx" ON "public"."quotation_discounts"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_comparisons_comparisonCode_key" ON "public"."quotation_comparisons"("comparisonCode");

-- CreateIndex
CREATE INDEX "quotation_comparisons_comparisonCode_idx" ON "public"."quotation_comparisons"("comparisonCode");

-- CreateIndex
CREATE INDEX "quotation_histories_quotationId_idx" ON "public"."quotation_histories"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_documents_quotationId_idx" ON "public"."quotation_documents"("quotationId");

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotation_versions" ADD CONSTRAINT "quotation_versions_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotation_versions" ADD CONSTRAINT "quotation_versions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotation_addons" ADD CONSTRAINT "quotation_addons_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotation_discounts" ADD CONSTRAINT "quotation_discounts_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotation_histories" ADD CONSTRAINT "quotation_histories_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotation_histories" ADD CONSTRAINT "quotation_histories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotation_documents" ADD CONSTRAINT "quotation_documents_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;
