-- CreateEnum
CREATE TYPE "public"."ClaimStatus" AS ENUM ('REPORTED', 'REGISTERED', 'SURVEYOR_ASSIGNED', 'UNDER_ASSESSMENT', 'APPROVED', 'REJECTED', 'PAYMENT_PENDING', 'SETTLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."ReserveType" AS ENUM ('INITIAL', 'ADJUSTED', 'RELEASED');

-- CreateTable
CREATE TABLE "public"."claims" (
    "id" TEXT NOT NULL,
    "claimNumber" TEXT NOT NULL,
    "status" "public"."ClaimStatus" NOT NULL DEFAULT 'REPORTED',
    "policyId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "accountId" TEXT,
    "incidentDate" TIMESTAMP(3) NOT NULL,
    "reportedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT NOT NULL,
    "claimAmount" DECIMAL(65,30) NOT NULL,
    "approvedAmount" DECIMAL(65,30),
    "surveyorName" TEXT,
    "surveyorDetails" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."claim_documents" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "fileKey" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileSize" INTEGER NOT NULL,
    "uploadedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."claim_assessments" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "assessorId" TEXT,
    "assessmentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "findings" TEXT NOT NULL,
    "estimatedLoss" DECIMAL(65,30) NOT NULL,
    "approvedAmount" DECIMAL(65,30) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."claim_payments" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "transactionId" TEXT NOT NULL,
    "paymentMethod" TEXT NOT NULL,
    "status" "public"."PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "recipientDetails" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."claim_reserves" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "amount" DECIMAL(65,30) NOT NULL,
    "type" "public"."ReserveType" NOT NULL DEFAULT 'INITIAL',
    "comments" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_reserves_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."claim_histories" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "status" "public"."ClaimStatus" NOT NULL,
    "action" TEXT NOT NULL,
    "comments" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."claim_communications" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "senderId" TEXT,
    "recipient" TEXT NOT NULL,
    "channel" "public"."CommunicationChannel" NOT NULL,
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "claim_communications_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "claims_claimNumber_key" ON "public"."claims"("claimNumber");

-- CreateIndex
CREATE INDEX "claims_claimNumber_idx" ON "public"."claims"("claimNumber");

-- CreateIndex
CREATE INDEX "claims_status_idx" ON "public"."claims"("status");

-- CreateIndex
CREATE INDEX "claims_policyId_idx" ON "public"."claims"("policyId");

-- CreateIndex
CREATE INDEX "claim_documents_claimId_idx" ON "public"."claim_documents"("claimId");

-- CreateIndex
CREATE INDEX "claim_assessments_claimId_idx" ON "public"."claim_assessments"("claimId");

-- CreateIndex
CREATE UNIQUE INDEX "claim_payments_transactionId_key" ON "public"."claim_payments"("transactionId");

-- CreateIndex
CREATE INDEX "claim_payments_claimId_idx" ON "public"."claim_payments"("claimId");

-- CreateIndex
CREATE INDEX "claim_reserves_claimId_idx" ON "public"."claim_reserves"("claimId");

-- CreateIndex
CREATE INDEX "claim_histories_claimId_idx" ON "public"."claim_histories"("claimId");

-- CreateIndex
CREATE INDEX "claim_communications_claimId_idx" ON "public"."claim_communications"("claimId");

-- AddForeignKey
ALTER TABLE "public"."claims" ADD CONSTRAINT "claims_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claims" ADD CONSTRAINT "claims_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claims" ADD CONSTRAINT "claims_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claims" ADD CONSTRAINT "claims_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claims" ADD CONSTRAINT "claims_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_documents" ADD CONSTRAINT "claim_documents_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_assessments" ADD CONSTRAINT "claim_assessments_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_assessments" ADD CONSTRAINT "claim_assessments_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_payments" ADD CONSTRAINT "claim_payments_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_reserves" ADD CONSTRAINT "claim_reserves_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_reserves" ADD CONSTRAINT "claim_reserves_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_histories" ADD CONSTRAINT "claim_histories_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_histories" ADD CONSTRAINT "claim_histories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_communications" ADD CONSTRAINT "claim_communications_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_communications" ADD CONSTRAINT "claim_communications_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
