-- Loans CRM Module Migration
-- Adds LoanCategory, LoanEnquiryStatus, LoanPartyRole, LoanFacilityType, LoanInterestRateType, LoanDisbursementMode, LenderOfferStatus
-- Adds loan_application_cases, loan_parties, loan_facilities, loan_lender_offers, loan_add_ons, loan_documents

-- CreateEnum
CREATE TYPE "public"."LoanCategory" AS ENUM ('HOME_LOAN', 'LOAN_AGAINST_PROPERTY', 'PERSONAL_LOAN', 'BUSINESS_LOAN', 'VEHICLE_LOAN', 'EDUCATION_LOAN', 'GOLD_LOAN', 'SECURITIES_OVERDRAFT');

-- CreateEnum
CREATE TYPE "public"."LoanEnquiryStatus" AS ENUM ('DRAFT', 'DOCUMENTS_PENDING', 'SUBMITTED_FOR_REVIEW', 'UNDERWRITING_IN_PROGRESS', 'OFFERS_RECEIVED', 'OFFER_SELECTED', 'SANCTIONED', 'DISBURSED', 'REJECTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."LoanPartyRole" AS ENUM ('APPLICANT', 'CO_APPLICANT', 'GUARANTOR');

-- CreateEnum
CREATE TYPE "public"."LoanFacilityType" AS ENUM ('NEW_TERM_LOAN', 'BALANCE_TRANSFER', 'TOP_UP', 'OVERDRAFT_CASH_CREDIT');

-- CreateEnum
CREATE TYPE "public"."LoanInterestRateType" AS ENUM ('FIXED', 'FLOATING', 'HYBRID');

-- CreateEnum
CREATE TYPE "public"."LoanDisbursementMode" AS ENUM ('SINGLE_DISBURSEMENT', 'STAGED_CONSTRUCTION_LINKED');

-- CreateEnum
CREATE TYPE "public"."LenderOfferStatus" AS ENUM ('RECEIVED', 'SHORTLISTED', 'SELECTED', 'REJECTED', 'EXPIRED');

-- CreateTable
CREATE TABLE "public"."loan_application_cases" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "caseCode" TEXT NOT NULL,
    "category" "public"."LoanCategory" NOT NULL,
    "status" "public"."LoanEnquiryStatus" NOT NULL DEFAULT 'DRAFT',
    "contactId" TEXT NOT NULL,
    "agentId" TEXT,
    "agentExternalCodeId" TEXT,
    "leadId" TEXT,
    "leadSource" TEXT,
    "occupationType" TEXT NOT NULL,
    "employerBusinessName" TEXT NOT NULL,
    "monthlyIncome" DECIMAL(14,2) NOT NULL,
    "annualIncome" DECIMAL(14,2) NOT NULL,
    "existingEmiObligations" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cibilScore" INTEGER,
    "bankAccountDetails" JSONB,
    "residentialAddress" JSONB,
    "permanentAddress" JSONB,
    "customerSnapshot" JSONB NOT NULL,
    "categoryData" JSONB,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "loan_application_cases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."loan_parties" (
    "id" TEXT NOT NULL,
    "loanCaseId" TEXT NOT NULL,
    "role" "public"."LoanPartyRole" NOT NULL DEFAULT 'CO_APPLICANT',
    "name" TEXT NOT NULL,
    "relationship" TEXT,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "mobileNumber" TEXT,
    "email" TEXT,
    "panNumber" TEXT,
    "aadhaarNumber" TEXT,
    "occupation" TEXT,
    "employerBusinessName" TEXT,
    "monthlyIncome" DECIMAL(14,2),
    "cibilScore" INTEGER,
    "address" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_parties_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."loan_facilities" (
    "id" TEXT NOT NULL,
    "loanCaseId" TEXT NOT NULL,
    "facilityType" "public"."LoanFacilityType" NOT NULL DEFAULT 'NEW_TERM_LOAN',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "requestedAmount" DECIMAL(14,2) NOT NULL,
    "tenureMonths" INTEGER NOT NULL,
    "interestRateType" "public"."LoanInterestRateType" NOT NULL DEFAULT 'FLOATING',
    "targetRoiPercentage" DECIMAL(5,2),
    "disbursementMode" "public"."LoanDisbursementMode" NOT NULL DEFAULT 'SINGLE_DISBURSEMENT',
    "marginPercentage" DECIMAL(5,2),
    "ltvRatioPercentage" DECIMAL(5,2),
    "existingLenderName" TEXT,
    "existingLoanAccountNo" TEXT,
    "outstandingAmount" DECIMAL(14,2),
    "existingRoiPercentage" DECIMAL(5,2),
    "topUpAmountRequested" DECIMAL(14,2),
    "foreclosureCharges" DECIMAL(14,2),
    "selectedOfferId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."loan_lender_offers" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "lenderName" TEXT NOT NULL,
    "status" "public"."LenderOfferStatus" NOT NULL DEFAULT 'RECEIVED',
    "offeredAmount" DECIMAL(14,2) NOT NULL,
    "offeredTenureMonths" INTEGER NOT NULL,
    "interestRateType" "public"."LoanInterestRateType" NOT NULL DEFAULT 'FLOATING',
    "rateOfInterest" DECIMAL(5,2) NOT NULL,
    "emiAmount" DECIMAL(14,2) NOT NULL,
    "processingFee" DECIMAL(14,2) NOT NULL,
    "otherCharges" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "gstAmount" DECIMAL(14,2) NOT NULL,
    "totalChargesInclGst" DECIMAL(14,2) NOT NULL,
    "commissionRatePercentage" DECIMAL(5,2),
    "grossCommissionAmount" DECIMAL(14,2),
    "customerDiscountAmount" DECIMAL(14,2),
    "netCommissionPayable" DECIMAL(14,2),
    "sanctionLetterDocId" TEXT,
    "sanctionDate" TIMESTAMP(3),
    "expiryDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_lender_offers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."loan_add_ons" (
    "id" TEXT NOT NULL,
    "facilityId" TEXT NOT NULL,
    "creditLifeOpted" BOOLEAN NOT NULL DEFAULT false,
    "creditLifeSumAssured" DECIMAL(14,2),
    "creditLifePremium" DECIMAL(14,2),
    "assetInsuranceOpted" BOOLEAN NOT NULL DEFAULT false,
    "assetSumAssured" DECIMAL(14,2),
    "assetPremium" DECIMAL(14,2),
    "gstAmount" DECIMAL(14,2) NOT NULL,
    "totalPremiumInclGst" DECIMAL(14,2) NOT NULL,
    "brokerageAmount" DECIMAL(14,2),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_add_ons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."loan_documents" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "loanCaseId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "documentType" TEXT NOT NULL,
    "verificationStatus" "public"."DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "verifiedById" TEXT,
    "verifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "loan_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "loan_application_cases_caseCode_key" ON "public"."loan_application_cases"("caseCode");
CREATE INDEX "loan_application_cases_companyId_idx" ON "public"."loan_application_cases"("companyId");
CREATE INDEX "loan_application_cases_contactId_idx" ON "public"."loan_application_cases"("contactId");
CREATE INDEX "loan_application_cases_companyId_agentId_idx" ON "public"."loan_application_cases"("companyId", "agentId");
CREATE INDEX "loan_application_cases_agentExternalCodeId_idx" ON "public"."loan_application_cases"("agentExternalCodeId");
CREATE INDEX "loan_application_cases_leadId_idx" ON "public"."loan_application_cases"("leadId");
CREATE INDEX "loan_application_cases_category_idx" ON "public"."loan_application_cases"("category");
CREATE INDEX "loan_application_cases_status_idx" ON "public"."loan_application_cases"("status");
CREATE INDEX "loan_application_cases_deletedAt_idx" ON "public"."loan_application_cases"("deletedAt");

-- CreateIndex
CREATE INDEX "loan_parties_loanCaseId_idx" ON "public"."loan_parties"("loanCaseId");
CREATE INDEX "loan_parties_role_idx" ON "public"."loan_parties"("role");

-- CreateIndex
CREATE INDEX "loan_facilities_loanCaseId_idx" ON "public"."loan_facilities"("loanCaseId");
CREATE INDEX "loan_facilities_selectedOfferId_idx" ON "public"."loan_facilities"("selectedOfferId");

-- CreateIndex
CREATE INDEX "loan_lender_offers_facilityId_idx" ON "public"."loan_lender_offers"("facilityId");

-- CreateIndex
CREATE INDEX "loan_add_ons_facilityId_idx" ON "public"."loan_add_ons"("facilityId");

-- CreateIndex
CREATE INDEX "loan_documents_companyId_idx" ON "public"."loan_documents"("companyId");
CREATE INDEX "loan_documents_loanCaseId_idx" ON "public"."loan_documents"("loanCaseId");
CREATE INDEX "loan_documents_documentId_idx" ON "public"."loan_documents"("documentId");

-- AddForeignKey
ALTER TABLE "public"."loan_application_cases" ADD CONSTRAINT "loan_application_cases_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."loan_application_cases" ADD CONSTRAINT "loan_application_cases_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "public"."loan_application_cases" ADD CONSTRAINT "loan_application_cases_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."loan_application_cases" ADD CONSTRAINT "loan_application_cases_agentExternalCodeId_fkey" FOREIGN KEY ("agentExternalCodeId") REFERENCES "public"."agent_external_codes"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."loan_application_cases" ADD CONSTRAINT "loan_application_cases_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "public"."loan_application_cases" ADD CONSTRAINT "loan_application_cases_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loan_parties" ADD CONSTRAINT "loan_parties_loanCaseId_fkey" FOREIGN KEY ("loanCaseId") REFERENCES "public"."loan_application_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loan_facilities" ADD CONSTRAINT "loan_facilities_loanCaseId_fkey" FOREIGN KEY ("loanCaseId") REFERENCES "public"."loan_application_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."loan_facilities" ADD CONSTRAINT "loan_facilities_selectedOfferId_fkey" FOREIGN KEY ("selectedOfferId") REFERENCES "public"."loan_lender_offers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loan_lender_offers" ADD CONSTRAINT "loan_lender_offers_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "public"."loan_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loan_add_ons" ADD CONSTRAINT "loan_add_ons_facilityId_fkey" FOREIGN KEY ("facilityId") REFERENCES "public"."loan_facilities"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."loan_documents" ADD CONSTRAINT "loan_documents_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."companies"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."loan_documents" ADD CONSTRAINT "loan_documents_loanCaseId_fkey" FOREIGN KEY ("loanCaseId") REFERENCES "public"."loan_application_cases"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "public"."loan_documents" ADD CONSTRAINT "loan_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

