-- CreateEnum
CREATE TYPE "public"."UserStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'PENDING_VERIFICATION');

-- CreateEnum
CREATE TYPE "public"."RoleType" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'TEAM_LEADER', 'SALES_AGENT', 'OPERATIONS', 'UNDERWRITER', 'CLAIMS_OFFICER', 'FINANCE', 'SUPPORT', 'CUSTOMER', 'MD_CEO', 'CHIEF_FINANCE_OFFICER', 'SALES_MANAGER', 'SALES_EXECUTIVE', 'POLICY_ISSUANCE_EXECUTIVE', 'RENEWAL_EXECUTIVE', 'CUSTOMER_SERVICE_EXECUTIVE', 'FINANCE_ACCOUNTS_EXECUTIVE', 'SYSTEM_ADMINISTRATOR', 'POSP_ADVISOR', 'AGENT_MANAGER', 'MARKETING_DIRECTOR');

-- CreateEnum
CREATE TYPE "public"."PermissionCategory" AS ENUM ('SYSTEM', 'USER', 'ROLE', 'CONTACT', 'ACCOUNT', 'LEAD', 'QUOTATION', 'POLICY', 'CLAIM', 'REPORT', 'WORKFLOW', 'DOCUMENT', 'DASHBOARD');

-- CreateEnum
CREATE TYPE "public"."AuditAction" AS ENUM ('CREATE', 'UPDATE', 'DELETE', 'LOGIN', 'LOGOUT', 'PASSWORD_RESET', 'APPROVE', 'REJECT');

-- CreateEnum
CREATE TYPE "public"."ContactType" AS ENUM ('INDIVIDUAL', 'CORPORATE');

-- CreateEnum
CREATE TYPE "public"."Gender" AS ENUM ('MALE', 'FEMALE', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."AccountType" AS ENUM ('INDIVIDUAL', 'CORPORATE', 'SME', 'ENTERPRISE', 'GOVERNMENT');

-- CreateEnum
CREATE TYPE "public"."CommunicationChannel" AS ENUM ('EMAIL', 'PHONE', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "public"."KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."LeadSource" AS ENUM ('WALK_IN', 'REFERRAL', 'ADVISOR', 'DIGITAL', 'RENEWAL', 'CROSS_SELL', 'CAMPAIGN', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."LeadStatus" AS ENUM ('NEW', 'CONTACTED', 'DOCS_RECEIVED', 'QUOTE_PREPARED', 'NEGOTIATION', 'PAYMENT_RECEIVED', 'POLICY_ISSUED', 'QUALIFIED', 'UNQUALIFIED', 'CONVERTED', 'LOST');

-- CreateEnum
CREATE TYPE "public"."ActivityType" AS ENUM ('CALL', 'EMAIL', 'MEETING', 'TASK');

-- CreateEnum
CREATE TYPE "public"."ActivityStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."QuotationStatus" AS ENUM ('DRAFT', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED', 'EXPIRED', 'CONVERTED_TO_POLICY');

-- CreateEnum
CREATE TYPE "public"."PolicyStatus" AS ENUM ('ACTIVE', 'LAPSED', 'CANCELLED', 'PENDING_RENEWAL');

-- CreateEnum
CREATE TYPE "public"."PaymentStatus" AS ENUM ('PENDING', 'SUCCESS', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ClaimStatus" AS ENUM ('REPORTED', 'REGISTERED', 'SURVEYOR_ASSIGNED', 'UNDER_ASSESSMENT', 'APPROVED', 'REJECTED', 'PAYMENT_PENDING', 'SETTLED', 'CLOSED');

-- CreateEnum
CREATE TYPE "public"."NotificationType" AS ENUM ('SYSTEM', 'LEAD_ASSIGNED', 'LEAD_UPDATED', 'FOLLOW_UP_DUE', 'QUOTATION_CREATED', 'QUOTATION_APPROVED', 'QUOTATION_REJECTED', 'POLICY_ISSUED', 'POLICY_CANCELLED', 'POLICY_RENEWAL_45', 'POLICY_RENEWAL_30', 'POLICY_RENEWAL_20', 'CLAIM_REGISTERED', 'CLAIM_ASSIGNED', 'CLAIM_APPROVED', 'CLAIM_SETTLED', 'DOCUMENT_UPLOADED', 'ENDORSEMENT_APPROVED');

-- CreateEnum
CREATE TYPE "public"."NotificationPriority" AS ENUM ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW');

-- CreateEnum
CREATE TYPE "public"."NotificationStatus" AS ENUM ('PENDING', 'SENT', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."RenewalTaskStatus" AS ENUM ('PENDING', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "public"."DocumentVerificationStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED');

-- CreateEnum
CREATE TYPE "public"."DocumentStatus" AS ENUM ('ACTIVE', 'ARCHIVED', 'DELETED');

-- CreateEnum
CREATE TYPE "public"."DocumentAccessAction" AS ENUM ('VIEW', 'DOWNLOAD', 'DELETE', 'RESTORE');

-- CreateEnum
CREATE TYPE "public"."VehicleType" AS ENUM ('TWO_WHEELER', 'FOUR_WHEELER', 'COMMERCIAL_GCV', 'TRACTOR', 'AUTO_RICKSHAW', 'TAXI', 'BUS_COACH', 'MISC_CLASS_D');

-- CreateEnum
CREATE TYPE "public"."FuelType" AS ENUM ('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID');

-- CreateEnum
CREATE TYPE "public"."TransmissionType" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "public"."RatingRuleType" AS ENUM ('BASE_RATE', 'AGE_LOADING', 'NCB_DISCOUNT', 'OD_DISCOUNT', 'TP_DISCOUNT', 'NCB_RESET', 'ADDON_RATE', 'TAX_RATE');

-- CreateEnum
CREATE TYPE "public"."AddonCode" AS ENUM ('ZERO_DEP', 'ENGINE_PROTECT', 'RSA', 'RTI', 'CONSUMABLES', 'NCB_PROTECT', 'PASSENGER_COVER', 'OTHER');

-- CreateEnum
CREATE TYPE "public"."ProductType" AS ENUM ('THIRD_PARTY_ONLY', 'STANDALONE_OWN_DAMAGE', 'PACKAGE_COMPREHENSIVE');

-- CreateEnum
CREATE TYPE "public"."ProposalStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'DOCUMENT_PENDING', 'APPROVED', 'REJECTED', 'POLICY_ISSUED');

-- CreateEnum
CREATE TYPE "public"."EndorsementType" AS ENUM ('CONTACT_CHANGE', 'ADDRESS_CHANGE', 'VEHICLE_CHANGE', 'IDV_CHANGE', 'NCB_CHANGE', 'COVERAGE_CHANGE', 'NOMINEE_CHANGE', 'OWNER_TRANSFER', 'PREMIUM_CHANGE');

-- CreateEnum
CREATE TYPE "public"."EndorsementStatus" AS ENUM ('REQUESTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'COMPLETED');

-- CreateEnum
CREATE TYPE "public"."ReportRunStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."KpiUnit" AS ENUM ('PERCENTAGE', 'CURRENCY', 'COUNT', 'RATIO', 'DAYS');

-- CreateEnum
CREATE TYPE "public"."ReportCategory" AS ENUM ('SALES', 'UNDERWRITING', 'CLAIMS', 'POLICY', 'CRM', 'FINANCE', 'AUDIT', 'CUSTOM');

-- CreateEnum
CREATE TYPE "public"."ReportModule" AS ENUM ('LEADS', 'CONTACTS', 'QUOTATIONS', 'POLICIES', 'CLAIMS', 'REPORTS');

-- CreateEnum
CREATE TYPE "public"."ReportType" AS ENUM ('TABULAR', 'SUMMARY', 'CHART', 'MATRIX');

-- CreateEnum
CREATE TYPE "public"."ReportStatus" AS ENUM ('ACTIVE', 'INACTIVE');

-- CreateEnum
CREATE TYPE "public"."ReportFilterOperator" AS ENUM ('EQUALS', 'CONTAINS', 'STARTS_WITH', 'ENDS_WITH', 'BETWEEN', 'GREATER_THAN', 'LESS_THAN', 'IN', 'NOT_IN', 'NULL', 'NOT_NULL');

-- CreateEnum
CREATE TYPE "public"."ReportExecutionStatus" AS ENUM ('RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "public"."ReportScheduleFrequency" AS ENUM ('DAILY', 'WEEKLY', 'MONTHLY');

-- CreateEnum
CREATE TYPE "public"."WorkflowModule" AS ENUM ('LEADS', 'PROPOSALS', 'ENDORSEMENTS', 'POLICIES', 'CLAIMS', 'QUOTATIONS');

-- CreateEnum
CREATE TYPE "public"."WorkflowEntityType" AS ENUM ('LEAD', 'PROPOSAL', 'POLICY', 'ENDORSEMENT', 'CLAIM', 'QUOTATION');

-- CreateEnum
CREATE TYPE "public"."WorkflowApprovalType" AS ENUM ('ANY', 'ALL', 'SEQUENTIAL');

-- CreateEnum
CREATE TYPE "public"."JobType" AS ENUM ('NOTIFICATION', 'RENEWAL', 'REPORT', 'WORKFLOW', 'DOCUMENT', 'AUDIT', 'SEARCH', 'EMAIL', 'SMS', 'WHATSAPP');

-- CreateEnum
CREATE TYPE "public"."JobStatus" AS ENUM ('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED', 'RETRYING', 'DELAYED');

-- CreateEnum
CREATE TYPE "public"."VehicleCategory" AS ENUM ('BIKE', 'PRIVATE_CAR', 'GCV', 'TRACTOR', 'AUTO', 'TAXI', 'BUS_COACH', 'MISC_CLASS_D');

-- CreateEnum
CREATE TYPE "public"."MotorPolicyType" AS ENUM ('THIRD_PARTY_ONLY', 'STANDALONE_OD', 'PACKAGE_COMPREHENSIVE');

-- CreateTable
CREATE TABLE "public"."roles" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."RoleType" NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."permissions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."PermissionCategory" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "public"."users" (
    "id" TEXT NOT NULL,
    "employeeCode" TEXT,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "passwordHash" TEXT NOT NULL,
    "profileImage" TEXT,
    "designation" TEXT,
    "legacyDepartment" TEXT,
    "status" "public"."UserStatus" NOT NULL DEFAULT 'PENDING_VERIFICATION',
    "isEmailVerified" BOOLEAN NOT NULL DEFAULT false,
    "isPhoneVerified" BOOLEAN NOT NULL DEFAULT false,
    "lastLoginAt" TIMESTAMP(3),
    "teamId" TEXT,
    "departmentId" TEXT,
    "branchId" TEXT,
    "roleId" TEXT NOT NULL,
    "jobRoleId" TEXT,
    "managerId" TEXT,
    "dashboardPreference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."refresh_tokens" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."audit_logs" (
    "id" TEXT NOT NULL,
    "action" "public"."AuditAction" NOT NULL,
    "entity" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "oldValue" JSONB,
    "newValue" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT,
    "correlationId" TEXT,
    "module" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."contacts" (
    "id" TEXT NOT NULL,
    "contactCode" TEXT NOT NULL,
    "type" "public"."ContactType" NOT NULL,
    "firstName" TEXT NOT NULL,
    "middleName" TEXT,
    "lastName" TEXT NOT NULL,
    "gender" "public"."Gender",
    "dateOfBirth" TIMESTAMP(3),
    "companyName" TEXT,
    "email" TEXT,
    "phone" TEXT NOT NULL,
    "alternatePhone" TEXT,
    "whatsappNumber" TEXT,
    "occupation" TEXT,
    "panNumber" TEXT,
    "aadhaarNumber" TEXT,
    "gstNumber" TEXT,
    "accountId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "contacts_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "public"."leads" (
    "id" TEXT NOT NULL,
    "leadCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "source" "public"."LeadSource" NOT NULL DEFAULT 'DIGITAL',
    "status" "public"."LeadStatus" NOT NULL DEFAULT 'NEW',
    "description" TEXT,
    "contactId" TEXT NOT NULL,
    "accountId" TEXT,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "updatedById" TEXT,
    "score" INTEGER NOT NULL DEFAULT 0,
    "priority" TEXT,
    "firstResponseAt" TIMESTAMP(3),
    "slaStatus" TEXT,
    "isDuplicate" BOOLEAN NOT NULL DEFAULT false,
    "duplicateOfId" TEXT,
    "currentWorkflowStep" TEXT NOT NULL DEFAULT 'ASSIGNED',
    "crmUpdatedAt" TIMESTAMP(3),
    "nextFollowup" TIMESTAMP(3),
    "estimatedPremium" DECIMAL(12,2),
    "noReferralReason" TEXT,
    "assignedManagerId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lead_stage_history" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "fromStage" TEXT NOT NULL,
    "toStage" TEXT NOT NULL,
    "performedById" TEXT NOT NULL,
    "performerRole" TEXT NOT NULL,
    "isOverride" BOOLEAN NOT NULL DEFAULT false,
    "overrideReason" TEXT,
    "remarks" TEXT,
    "prerequisitesMet" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_stage_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."lead_assignments" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "assignedToId" TEXT NOT NULL,
    "assignedById" TEXT NOT NULL,
    "reason" TEXT,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lead_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."referrals" (
    "id" TEXT NOT NULL,
    "sourceLeadId" TEXT,
    "referrerContactId" TEXT,
    "referralName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "relationship" TEXT,
    "interestedProduct" TEXT,
    "status" TEXT NOT NULL DEFAULT 'NEW',
    "assignedToId" TEXT,
    "createdLeadId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "referrals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_targets" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "targetGwp" DECIMAL(12,2) NOT NULL,
    "targetPolicies" INTEGER NOT NULL,
    "targetConversionRate" DECIMAL(5,2) NOT NULL DEFAULT 30.0,
    "achievedGwp" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "achievedPolicies" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "sales_targets_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."sales_performance" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "leadsAssigned" INTEGER NOT NULL DEFAULT 0,
    "callsMade" INTEGER NOT NULL DEFAULT 0,
    "meetingsHeld" INTEGER NOT NULL DEFAULT 0,
    "quotesGenerated" INTEGER NOT NULL DEFAULT 0,
    "proposalsSent" INTEGER NOT NULL DEFAULT 0,
    "policiesIssued" INTEGER NOT NULL DEFAULT 0,
    "totalRevenue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sales_performance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."call_logs" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "contactId" TEXT,
    "userId" TEXT NOT NULL,
    "callType" TEXT NOT NULL DEFAULT 'OUTBOUND',
    "callOutcome" TEXT NOT NULL,
    "durationSeconds" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "scheduledFollowup" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "call_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."meeting_logs" (
    "id" TEXT NOT NULL,
    "leadId" TEXT,
    "contactId" TEXT,
    "userId" TEXT NOT NULL,
    "meetingType" TEXT NOT NULL DEFAULT 'IN_PERSON',
    "location" TEXT,
    "status" TEXT NOT NULL DEFAULT 'SCHEDULED',
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "completedAt" TIMESTAMP(3),
    "summary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notes" (
    "id" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."activities" (
    "id" TEXT NOT NULL,
    "type" "public"."ActivityType" NOT NULL,
    "subject" TEXT NOT NULL,
    "description" TEXT,
    "status" "public"."ActivityStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "leadId" TEXT NOT NULL,
    "assignedToId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

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
    "vehicleId" TEXT,
    "vehicleCategory" "public"."VehicleCategory",
    "policyType" TEXT,
    "registrationNumber" TEXT,
    "motorMetadata" JSONB,
    "policyTenure" INTEGER NOT NULL DEFAULT 1,
    "activeTpInsurer" TEXT,
    "activeTpPolicyNumber" TEXT,
    "activeTpExpiryDate" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

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
    "addonCode" "public"."AddonCode" NOT NULL,
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
    "policyTenure" INTEGER NOT NULL DEFAULT 1,
    "vehicleId" TEXT,
    "vehicleCategory" "public"."VehicleCategory",
    "policyType" TEXT,
    "motorMetadata" JSONB,
    "activeTpInsurer" TEXT,
    "activeTpPolicyNumber" TEXT,
    "activeTpExpiryDate" TIMESTAMP(3),
    "createdById" TEXT,
    "updatedById" TEXT,
    "proposalId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),
    "version" INTEGER NOT NULL DEFAULT 1,

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
    "version" INTEGER NOT NULL DEFAULT 1,

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

-- CreateTable
CREATE TABLE "public"."notifications" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "priority" "public"."NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "userId" TEXT NOT NULL,
    "entityId" TEXT,
    "entityType" TEXT,
    "actionUrl" TEXT,
    "icon" TEXT,
    "color" TEXT,
    "expiresAt" TIMESTAMP(3),
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" "public"."NotificationType" NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "subject" TEXT,
    "body" TEXT NOT NULL,
    "variables" JSONB,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_preferences" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,
    "sms" BOOLEAN NOT NULL DEFAULT false,
    "whatsapp" BOOLEAN NOT NULL DEFAULT false,
    "renewals" BOOLEAN NOT NULL DEFAULT true,
    "claims" BOOLEAN NOT NULL DEFAULT true,
    "policies" BOOLEAN NOT NULL DEFAULT true,
    "leads" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."notification_histories" (
    "id" TEXT NOT NULL,
    "notificationId" TEXT NOT NULL,
    "status" "public"."NotificationStatus" NOT NULL DEFAULT 'SENT',
    "channel" TEXT NOT NULL DEFAULT 'IN_APP',
    "sentAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "failureReason" TEXT,

    CONSTRAINT "notification_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."renewal_tasks" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "status" "public"."RenewalTaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "public"."NotificationPriority" NOT NULL DEFAULT 'MEDIUM',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "renewal_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."documents" (
    "id" TEXT NOT NULL,
    "documentNumber" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "storageProvider" TEXT NOT NULL,
    "hash" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "status" "public"."DocumentStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "verificationStatus" "public"."DocumentVerificationStatus" NOT NULL DEFAULT 'PENDING',
    "expiryDate" TIMESTAMP(3),
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_versions" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "version" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalFileName" TEXT NOT NULL,
    "size" INTEGER NOT NULL,
    "hash" TEXT NOT NULL,
    "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."document_access_logs" (
    "id" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "action" "public"."DocumentAccessAction" NOT NULL,
    "ipAddress" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_access_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vehicle_category_documents" (
    "id" TEXT NOT NULL,
    "vehicleType" "public"."VehicleType" NOT NULL,
    "documentName" TEXT NOT NULL,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "phase" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_category_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vehicle_manufacturers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_manufacturers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vehicle_models" (
    "id" TEXT NOT NULL,
    "manufacturerId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "vehicleType" "public"."VehicleType" NOT NULL DEFAULT 'FOUR_WHEELER',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_models_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vehicle_variants" (
    "id" TEXT NOT NULL,
    "modelId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "fuelType" "public"."FuelType" NOT NULL DEFAULT 'PETROL',
    "transmissionType" "public"."TransmissionType" NOT NULL DEFAULT 'MANUAL',
    "engineCapacity" INTEGER NOT NULL,
    "exShowroomPrice" DECIMAL(65,30) NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vehicle_variants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rto_masters" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "state" TEXT NOT NULL,
    "district" TEXT NOT NULL,
    "rtoOfficeName" TEXT NOT NULL,
    "rtoZone" TEXT NOT NULL DEFAULT 'ZONE_A',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rto_masters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."insurers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "logoUrl" TEXT,
    "irdaiRegistrationNumber" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "address" TEXT,
    "rating" DECIMAL(65,30),
    "supportedVehicleTypes" JSONB,
    "supportedPolicyTypes" JSONB,
    "supportedAddons" JSONB,
    "supportsZeroDep" BOOLEAN NOT NULL DEFAULT true,
    "supportsRTI" BOOLEAN NOT NULL DEFAULT true,
    "supportsEngineProtect" BOOLEAN NOT NULL DEFAULT true,
    "supportsRSA" BOOLEAN NOT NULL DEFAULT true,
    "supportsNCBProtection" BOOLEAN NOT NULL DEFAULT true,
    "supportsConsumables" BOOLEAN NOT NULL DEFAULT true,
    "supportsKeyProtect" BOOLEAN NOT NULL DEFAULT true,
    "supportsTyreProtect" BOOLEAN NOT NULL DEFAULT true,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contactDetails" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."insurance_products" (
    "id" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "productName" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL DEFAULT 'FOUR_WHEELER',
    "policyType" TEXT NOT NULL DEFAULT 'COMPREHENSIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurance_products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."discount_rules" (
    "id" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "vehicleType" TEXT NOT NULL DEFAULT 'FOUR_WHEELER',
    "policyType" TEXT NOT NULL DEFAULT 'COMPREHENSIVE',
    "maxDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 70.0,
    "minDiscountPercent" DECIMAL(5,2) NOT NULL DEFAULT 0.0,
    "managerApprovalThresholdPercent" DECIMAL(5,2) NOT NULL DEFAULT 15.0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "discount_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."commission_matrices" (
    "id" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "productType" TEXT NOT NULL DEFAULT 'MOTOR',
    "odCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 15.0,
    "tpCommissionPercent" DECIMAL(5,2) NOT NULL DEFAULT 2.5,
    "brokeragePercent" DECIMAL(5,2) NOT NULL DEFAULT 17.5,
    "tdsPercent" DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "commission_matrices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."underwriting_questions" (
    "id" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "questionText" TEXT NOT NULL,
    "answerType" TEXT NOT NULL DEFAULT 'BOOLEAN',
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "underwriting_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."add_on_rules" (
    "id" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "addonCode" TEXT NOT NULL,
    "addonName" TEXT NOT NULL,
    "maxVehicleAgeYears" INTEGER NOT NULL DEFAULT 5,
    "allowedFuelTypes" JSONB,
    "premiumFormula" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "add_on_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "type" "public"."ProductType" NOT NULL,
    "baseCommissionRate" DECIMAL(65,30) NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."rating_rules" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "insurerId" TEXT NOT NULL,
    "ruleName" TEXT NOT NULL,
    "ruleType" "public"."RatingRuleType" NOT NULL,
    "eligibilityCriteria" JSONB NOT NULL,
    "formulaOrRate" JSONB NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "rating_rules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proposals" (
    "id" TEXT NOT NULL,
    "proposalNumber" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" "public"."ProposalStatus" NOT NULL DEFAULT 'DRAFT',
    "remarks" TEXT,
    "submittedById" TEXT NOT NULL,
    "reviewedById" TEXT,
    "approvedById" TEXT,
    "rejectedReason" TEXT,
    "submittedAt" TIMESTAMP(3),
    "reviewedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "proposals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proposal_documents" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "documentId" TEXT,
    "mandatory" BOOLEAN NOT NULL DEFAULT true,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "remarks" TEXT,

    CONSTRAINT "proposal_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."proposal_histories" (
    "id" TEXT NOT NULL,
    "proposalId" TEXT NOT NULL,
    "status" "public"."ProposalStatus" NOT NULL,
    "comments" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "proposal_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."endorsements" (
    "id" TEXT NOT NULL,
    "endorsementNumber" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "type" "public"."EndorsementType" NOT NULL,
    "status" "public"."EndorsementStatus" NOT NULL DEFAULT 'REQUESTED',
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "reason" TEXT NOT NULL,
    "requestedChanges" JSONB,
    "validatedChanges" JSONB,
    "effectiveDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "endorsements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."endorsement_documents" (
    "id" TEXT NOT NULL,
    "endorsementId" TEXT NOT NULL,
    "documentId" TEXT NOT NULL,

    CONSTRAINT "endorsement_documents_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."endorsement_histories" (
    "id" TEXT NOT NULL,
    "endorsementId" TEXT NOT NULL,
    "status" "public"."EndorsementStatus" NOT NULL,
    "comments" TEXT,
    "performedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "endorsement_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."saved_reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."ReportCategory" NOT NULL,
    "dataSource" TEXT NOT NULL,
    "columns" JSONB NOT NULL,
    "filters" JSONB NOT NULL,
    "sortBy" TEXT,
    "sortDir" TEXT DEFAULT 'asc',
    "isBuiltIn" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_runs" (
    "id" TEXT NOT NULL,
    "savedReportId" TEXT NOT NULL,
    "status" "public"."ReportRunStatus" NOT NULL DEFAULT 'PENDING',
    "rowCount" INTEGER,
    "exportPath" TEXT,
    "errorMessage" TEXT,
    "appliedFilters" JSONB,
    "triggeredById" TEXT,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "report_runs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."kpi_definitions" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT,
    "formula" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "unit" "public"."KpiUnit" NOT NULL DEFAULT 'COUNT',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kpi_definitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."reports" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "category" "public"."ReportCategory" NOT NULL,
    "module" "public"."ReportModule" NOT NULL,
    "type" "public"."ReportType" NOT NULL DEFAULT 'TABULAR',
    "status" "public"."ReportStatus" NOT NULL DEFAULT 'ACTIVE',
    "version" INTEGER NOT NULL DEFAULT 1,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "shared" BOOLEAN NOT NULL DEFAULT false,
    "parentId" TEXT,
    "executionCount" INTEGER NOT NULL DEFAULT 0,
    "lastExecutedAt" TIMESTAMP(3),
    "averageDuration" DOUBLE PRECISION NOT NULL DEFAULT 0.0,
    "createdById" TEXT,
    "updatedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_columns" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "sortable" BOOLEAN NOT NULL DEFAULT true,
    "filterable" BOOLEAN NOT NULL DEFAULT true,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "order" INTEGER NOT NULL DEFAULT 0,
    "configuration" JSONB,

    CONSTRAINT "report_columns_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_filters" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "field" TEXT NOT NULL,
    "operator" "public"."ReportFilterOperator" NOT NULL,
    "defaultValue" JSONB,
    "required" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "report_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_executions" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "requestedById" TEXT,
    "status" "public"."ReportExecutionStatus" NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "duration" INTEGER,
    "filePath" TEXT,
    "recordCount" INTEGER NOT NULL DEFAULT 0,
    "parameters" JSONB,

    CONSTRAINT "report_executions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."report_schedules" (
    "id" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "cronExpression" TEXT NOT NULL,
    "frequency" "public"."ReportScheduleFrequency" NOT NULL,
    "timezone" TEXT NOT NULL DEFAULT 'UTC',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "nextRun" TIMESTAMP(3),

    CONSTRAINT "report_schedules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."saved_report_filters" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "filters" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "saved_report_filters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."favorite_reports" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reportId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "favorite_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflows" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "module" "public"."WorkflowModule" NOT NULL,
    "description" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "version" INTEGER NOT NULL DEFAULT 1,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "workflows_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_states" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isInitial" BOOLEAN NOT NULL DEFAULT false,
    "isTerminal" BOOLEAN NOT NULL DEFAULT false,
    "slaMinutes" INTEGER,
    "escalationRoleId" TEXT,

    CONSTRAINT "workflow_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_transitions" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "fromStateId" TEXT,
    "toStateId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "triggerType" TEXT NOT NULL DEFAULT 'MANUAL',
    "conditions" JSONB,

    CONSTRAINT "workflow_transitions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_actions" (
    "id" TEXT NOT NULL,
    "stateId" TEXT,
    "transitionId" TEXT,
    "type" TEXT NOT NULL,
    "configuration" JSONB,

    CONSTRAINT "workflow_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_assignments" (
    "id" TEXT NOT NULL,
    "stateId" TEXT,
    "transitionId" TEXT,
    "roleId" TEXT,
    "userId" TEXT,
    "departmentId" TEXT,
    "branchId" TEXT,
    "order" INTEGER NOT NULL DEFAULT 0,
    "required" BOOLEAN NOT NULL DEFAULT true,
    "approvalType" "public"."WorkflowApprovalType" NOT NULL DEFAULT 'ANY',

    CONSTRAINT "workflow_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."workflow_histories" (
    "id" TEXT NOT NULL,
    "workflowId" TEXT NOT NULL,
    "workflowVersion" INTEGER NOT NULL,
    "entityId" TEXT NOT NULL,
    "entityType" "public"."WorkflowEntityType" NOT NULL,
    "fromStateId" TEXT,
    "toStateId" TEXT NOT NULL,
    "performedById" TEXT,
    "comments" TEXT,
    "duration" INTEGER,
    "result" JSONB,
    "variables" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "workflow_histories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."BackgroundJob" (
    "id" TEXT NOT NULL,
    "queue" TEXT NOT NULL,
    "jobId" TEXT,
    "type" "public"."JobType" NOT NULL,
    "status" "public"."JobStatus" NOT NULL DEFAULT 'QUEUED',
    "payload" JSONB,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "startedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "error" TEXT,
    "createdBy" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BackgroundJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Company" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "logoUrl" TEXT,
    "address" TEXT,
    "taxId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Company_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Region" (
    "id" TEXT NOT NULL,
    "companyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Region_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Zone" (
    "id" TEXT NOT NULL,
    "regionId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Zone_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Branch" (
    "id" TEXT NOT NULL,
    "zoneId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Branch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Department" (
    "id" TEXT NOT NULL,
    "branchId" TEXT,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Department_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JobRole" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "departmentId" TEXT NOT NULL,
    "defaultRoleType" "public"."RoleType" NOT NULL DEFAULT 'SALES_AGENT',
    "parentRoleId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JobRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DashboardRegistry" (
    "id" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,
    "dashboardCode" TEXT NOT NULL,
    "workspaceCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "subtitle" TEXT,
    "layout" JSONB NOT NULL,
    "navigation" JSONB NOT NULL,
    "widgets" JSONB NOT NULL,
    "quickActions" JSONB NOT NULL,
    "permissions" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DashboardRegistry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkspacePreference" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "theme" TEXT NOT NULL DEFAULT 'system',
    "layout" TEXT NOT NULL DEFAULT 'default',
    "favoriteWidgets" JSONB,
    "collapsedMenus" JSONB,
    "language" TEXT NOT NULL DEFAULT 'en',
    "timezone" TEXT NOT NULL DEFAULT 'Asia/Kolkata',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspacePreference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Team" (
    "id" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Team_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SystemConfig" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "valueType" TEXT NOT NULL,
    "description" TEXT,
    "isPublic" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemConfig_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."FeatureFlag" (
    "key" TEXT NOT NULL,
    "isEnabled" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FeatureFlag_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "public"."NumberingFormat" (
    "entityType" TEXT NOT NULL,
    "prefix" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "padding" INTEGER NOT NULL DEFAULT 6,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "NumberingFormat_pkey" PRIMARY KEY ("entityType")
);

-- CreateTable
CREATE TABLE "public"."NumberingSequence" (
    "entityType" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "NumberingSequence_pkey" PRIMARY KEY ("entityType","year","month")
);

-- CreateTable
CREATE TABLE "public"."LookupCategory" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LookupCategory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LookupValue" (
    "id" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "parentId" TEXT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LookupValue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Holiday" (
    "id" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "name" TEXT NOT NULL,
    "isGlobal" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Holiday_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WorkingHours" (
    "id" TEXT NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,
    "startTime" TEXT NOT NULL,
    "endTime" TEXT NOT NULL,
    "isWorkingDay" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkingHours_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadScoreRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "condition" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LeadScoreRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."LeadScoreLog" (
    "id" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "ruleId" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LeadScoreLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."AssignmentRule" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "condition" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "priority" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AssignmentRule_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."RoutingQueue" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "strategy" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RoutingQueue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."QueueMember" (
    "id" TEXT NOT NULL,
    "queueId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isAvailable" BOOLEAN NOT NULL DEFAULT true,
    "capacity" INTEGER NOT NULL DEFAULT 10,
    "currentLoad" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "QueueMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SlaPolicy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "targetEntity" TEXT NOT NULL,
    "priority" TEXT,
    "firstResponseMin" INTEGER,
    "resolutionMin" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SlaPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."SlaViolation" (
    "id" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "breachType" TEXT NOT NULL,
    "breachedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "isResolved" BOOLEAN NOT NULL DEFAULT false,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "SlaViolation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."ChartOfAccount" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "description" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ChartOfAccount_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JournalEntry" (
    "id" TEXT NOT NULL,
    "entryNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceId" TEXT,
    "referenceType" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "JournalEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."JournalLine" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "debit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "credit" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "JournalLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Invoice" (
    "id" TEXT NOT NULL,
    "invoiceNum" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "totalAmount" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'UNPAID',
    "entityId" TEXT NOT NULL,
    "entityType" TEXT NOT NULL DEFAULT 'POLICY',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Receipt" (
    "id" TEXT NOT NULL,
    "receiptNum" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "amount" DECIMAL(19,4) NOT NULL,
    "paymentMode" TEXT NOT NULL,
    "reference" TEXT,
    "status" TEXT NOT NULL DEFAULT 'CLEARED',
    "customerId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Receipt_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."PaymentAllocation" (
    "id" TEXT NOT NULL,
    "receiptId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommissionPlan" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "rules" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommissionPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Commission" (
    "id" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "roleTier" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACCRUED',
    "planId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Commission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Settlement" (
    "id" TEXT NOT NULL,
    "batchNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "totalAmount" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Settlement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CustomerAnalytics" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "lifetimePremium" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "lifetimeClaims" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "lifetimeValue" DECIMAL(19,4) NOT NULL DEFAULT 0,
    "renewalProbability" INTEGER NOT NULL DEFAULT 0,
    "customerRiskScore" INTEGER NOT NULL DEFAULT 0,
    "crossSellScore" INTEGER NOT NULL DEFAULT 0,
    "healthScore" INTEGER NOT NULL DEFAULT 100,
    "churnProbability" INTEGER NOT NULL DEFAULT 0,
    "activePolicies" INTEGER NOT NULL DEFAULT 0,
    "expiredPolicies" INTEGER NOT NULL DEFAULT 0,
    "claimRatio" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "lastCalculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerAnalytics_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."CommunicationLog" (
    "id" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "provider" TEXT,
    "providerMessageId" TEXT,
    "templateId" TEXT,
    "subject" TEXT,
    "messagePreview" TEXT,
    "messageBody" TEXT,
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "errorCode" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CommunicationLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FamilyMember" (
    "id" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "relationship" TEXT NOT NULL,
    "dateOfBirth" TIMESTAMP(3),
    "gender" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DimBranch" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "zone" TEXT,
    "region" TEXT,

    CONSTRAINT "DimBranch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DimAgent" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,

    CONSTRAINT "DimAgent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DimCustomer" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "city" TEXT,
    "state" TEXT,

    CONSTRAINT "DimCustomer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DimProduct" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "insurer" TEXT NOT NULL,

    CONSTRAINT "DimProduct_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DimDate" (
    "dateId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "quarter" INTEGER NOT NULL,
    "dayOfWeek" INTEGER NOT NULL,

    CONSTRAINT "DimDate_pkey" PRIMARY KEY ("dateId")
);

-- CreateTable
CREATE TABLE "public"."FactPolicy" (
    "id" TEXT NOT NULL,
    "dateId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "premiumAmount" DECIMAL(19,4) NOT NULL,
    "commissionAmt" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactPolicy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FactClaim" (
    "id" TEXT NOT NULL,
    "dateId" TEXT NOT NULL,
    "policyId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amountClaimed" DECIMAL(19,4) NOT NULL,
    "amountSettled" DECIMAL(19,4) NOT NULL,
    "status" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactClaim_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."FactRevenue" (
    "id" TEXT NOT NULL,
    "dateId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "amount" DECIMAL(19,4) NOT NULL,
    "type" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FactRevenue_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Dashboard" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "roleTarget" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Dashboard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."Widget" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "config" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Widget_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DashboardWidget" (
    "dashboardId" TEXT NOT NULL,
    "widgetId" TEXT NOT NULL,
    "x" INTEGER NOT NULL,
    "y" INTEGER NOT NULL,
    "w" INTEGER NOT NULL,
    "h" INTEGER NOT NULL,

    CONSTRAINT "DashboardWidget_pkey" PRIMARY KEY ("dashboardId","widgetId")
);

-- CreateTable
CREATE TABLE "public"."ForecastResult" (
    "id" TEXT NOT NULL,
    "metric" TEXT NOT NULL,
    "targetDate" TIMESTAMP(3) NOT NULL,
    "branchId" TEXT,
    "value" DECIMAL(19,4) NOT NULL,
    "lowerBound" DECIMAL(19,4),
    "upperBound" DECIMAL(19,4),
    "modelUsed" TEXT NOT NULL,
    "calculatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ForecastResult_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."IntegrationProvider" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isPrimary" BOOLEAN NOT NULL DEFAULT false,
    "priority" INTEGER NOT NULL DEFAULT 1,
    "config" TEXT NOT NULL,
    "failureCount" INTEGER NOT NULL DEFAULT 0,
    "successRate" DECIMAL(5,2),
    "averageLatency" INTEGER,
    "lastHeartbeat" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IntegrationProvider_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."WebhookAuditLog" (
    "id" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "providerEventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PROCESSED',
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookAuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."vehicles" (
    "id" TEXT NOT NULL,
    "vehicleCode" TEXT NOT NULL,
    "category" "public"."VehicleCategory" NOT NULL,
    "registrationNumber" TEXT,
    "makeModel" TEXT,
    "manufactureYearMonth" TEXT,
    "dateOfRegistration" TIMESTAMP(3),
    "engineNumber" TEXT,
    "chassisNumber" TEXT,
    "fuelType" TEXT,
    "rtoLocation" TEXT,
    "categorySpecificData" JSONB,
    "contactId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "vehicles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."renewal_configurations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Default',
    "policyType" TEXT,
    "vehicleCategory" TEXT,
    "lookAheadDays" INTEGER NOT NULL DEFAULT 60,
    "reminderOffsets" INTEGER[] DEFAULT ARRAY[30, 7, 1]::INTEGER[],
    "escalationDays" INTEGER NOT NULL DEFAULT 3,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "renewal_configurations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "public"."DocumentChecklistItem" (
    "id" TEXT NOT NULL,
    "category" "public"."VehicleCategory" NOT NULL,
    "documentName" TEXT NOT NULL,
    "condition" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DocumentChecklistItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "roles_name_key" ON "public"."roles"("name");

-- CreateIndex
CREATE UNIQUE INDEX "roles_code_key" ON "public"."roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "roles_type_key" ON "public"."roles"("type");

-- CreateIndex
CREATE INDEX "roles_name_idx" ON "public"."roles"("name");

-- CreateIndex
CREATE INDEX "roles_code_idx" ON "public"."roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_name_key" ON "public"."permissions"("name");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_code_key" ON "public"."permissions"("code");

-- CreateIndex
CREATE INDEX "permissions_category_idx" ON "public"."permissions"("category");

-- CreateIndex
CREATE INDEX "role_permissions_roleId_idx" ON "public"."role_permissions"("roleId");

-- CreateIndex
CREATE INDEX "role_permissions_permissionId_idx" ON "public"."role_permissions"("permissionId");

-- CreateIndex
CREATE UNIQUE INDEX "users_employeeCode_key" ON "public"."users"("employeeCode");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_email_idx" ON "public"."users"("email");

-- CreateIndex
CREATE INDEX "users_employeeCode_idx" ON "public"."users"("employeeCode");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "public"."users"("status");

-- CreateIndex
CREATE INDEX "users_deletedAt_idx" ON "public"."users"("deletedAt");

-- CreateIndex
CREATE INDEX "users_branchId_idx" ON "public"."users"("branchId");

-- CreateIndex
CREATE INDEX "users_teamId_idx" ON "public"."users"("teamId");

-- CreateIndex
CREATE INDEX "users_departmentId_idx" ON "public"."users"("departmentId");

-- CreateIndex
CREATE INDEX "users_roleId_idx" ON "public"."users"("roleId");

-- CreateIndex
CREATE INDEX "users_jobRoleId_idx" ON "public"."users"("jobRoleId");

-- CreateIndex
CREATE INDEX "users_managerId_idx" ON "public"."users"("managerId");

-- CreateIndex
CREATE INDEX "refresh_tokens_userId_idx" ON "public"."refresh_tokens"("userId");

-- CreateIndex
CREATE INDEX "refresh_tokens_expiresAt_idx" ON "public"."refresh_tokens"("expiresAt");

-- CreateIndex
CREATE INDEX "audit_logs_entity_idx" ON "public"."audit_logs"("entity");

-- CreateIndex
CREATE INDEX "audit_logs_entityId_idx" ON "public"."audit_logs"("entityId");

-- CreateIndex
CREATE INDEX "audit_logs_action_idx" ON "public"."audit_logs"("action");

-- CreateIndex
CREATE INDEX "audit_logs_entity_entityId_idx" ON "public"."audit_logs"("entity", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "public"."audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_userId_idx" ON "public"."audit_logs"("userId");

-- CreateIndex
CREATE INDEX "audit_logs_correlationId_idx" ON "public"."audit_logs"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "contacts_contactCode_key" ON "public"."contacts"("contactCode");

-- CreateIndex
CREATE INDEX "contacts_phone_idx" ON "public"."contacts"("phone");

-- CreateIndex
CREATE INDEX "contacts_email_idx" ON "public"."contacts"("email");

-- CreateIndex
CREATE INDEX "contacts_contactCode_idx" ON "public"."contacts"("contactCode");

-- CreateIndex
CREATE INDEX "contacts_accountId_idx" ON "public"."contacts"("accountId");

-- CreateIndex
CREATE INDEX "contacts_deletedAt_idx" ON "public"."contacts"("deletedAt");

-- CreateIndex
CREATE INDEX "contacts_createdById_idx" ON "public"."contacts"("createdById");

-- CreateIndex
CREATE INDEX "contacts_updatedById_idx" ON "public"."contacts"("updatedById");

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
CREATE INDEX "accounts_deletedAt_idx" ON "public"."accounts"("deletedAt");

-- CreateIndex
CREATE INDEX "accounts_createdById_idx" ON "public"."accounts"("createdById");

-- CreateIndex
CREATE INDEX "accounts_updatedById_idx" ON "public"."accounts"("updatedById");

-- CreateIndex
CREATE UNIQUE INDEX "leads_leadCode_key" ON "public"."leads"("leadCode");

-- CreateIndex
CREATE INDEX "leads_leadCode_idx" ON "public"."leads"("leadCode");

-- CreateIndex
CREATE INDEX "leads_status_idx" ON "public"."leads"("status");

-- CreateIndex
CREATE INDEX "leads_currentWorkflowStep_idx" ON "public"."leads"("currentWorkflowStep");

-- CreateIndex
CREATE INDEX "leads_contactId_idx" ON "public"."leads"("contactId");

-- CreateIndex
CREATE INDEX "leads_assignedToId_idx" ON "public"."leads"("assignedToId");

-- CreateIndex
CREATE INDEX "leads_deletedAt_idx" ON "public"."leads"("deletedAt");

-- CreateIndex
CREATE INDEX "leads_accountId_idx" ON "public"."leads"("accountId");

-- CreateIndex
CREATE INDEX "leads_createdById_idx" ON "public"."leads"("createdById");

-- CreateIndex
CREATE INDEX "leads_status_assignedToId_idx" ON "public"."leads"("status", "assignedToId");

-- CreateIndex
CREATE INDEX "leads_updatedById_idx" ON "public"."leads"("updatedById");

-- CreateIndex
CREATE INDEX "leads_duplicateOfId_idx" ON "public"."leads"("duplicateOfId");

-- CreateIndex
CREATE INDEX "leads_assignedManagerId_idx" ON "public"."leads"("assignedManagerId");

-- CreateIndex
CREATE INDEX "lead_stage_history_leadId_idx" ON "public"."lead_stage_history"("leadId");

-- CreateIndex
CREATE INDEX "lead_stage_history_createdAt_idx" ON "public"."lead_stage_history"("createdAt");

-- CreateIndex
CREATE INDEX "lead_stage_history_performedById_idx" ON "public"."lead_stage_history"("performedById");

-- CreateIndex
CREATE INDEX "lead_assignments_leadId_idx" ON "public"."lead_assignments"("leadId");

-- CreateIndex
CREATE INDEX "lead_assignments_assignedToId_idx" ON "public"."lead_assignments"("assignedToId");

-- CreateIndex
CREATE INDEX "lead_assignments_assignedById_idx" ON "public"."lead_assignments"("assignedById");

-- CreateIndex
CREATE INDEX "referrals_sourceLeadId_idx" ON "public"."referrals"("sourceLeadId");

-- CreateIndex
CREATE INDEX "referrals_phone_idx" ON "public"."referrals"("phone");

-- CreateIndex
CREATE INDEX "referrals_referrerContactId_idx" ON "public"."referrals"("referrerContactId");

-- CreateIndex
CREATE INDEX "referrals_assignedToId_idx" ON "public"."referrals"("assignedToId");

-- CreateIndex
CREATE INDEX "referrals_createdLeadId_idx" ON "public"."referrals"("createdLeadId");

-- CreateIndex
CREATE INDEX "sales_targets_userId_idx" ON "public"."sales_targets"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "sales_targets_userId_year_month_key" ON "public"."sales_targets"("userId", "year", "month");

-- CreateIndex
CREATE INDEX "sales_performance_userId_date_idx" ON "public"."sales_performance"("userId", "date");

-- CreateIndex
CREATE INDEX "sales_performance_userId_idx" ON "public"."sales_performance"("userId");

-- CreateIndex
CREATE INDEX "call_logs_leadId_idx" ON "public"."call_logs"("leadId");

-- CreateIndex
CREATE INDEX "call_logs_userId_idx" ON "public"."call_logs"("userId");

-- CreateIndex
CREATE INDEX "call_logs_contactId_idx" ON "public"."call_logs"("contactId");

-- CreateIndex
CREATE INDEX "meeting_logs_leadId_idx" ON "public"."meeting_logs"("leadId");

-- CreateIndex
CREATE INDEX "meeting_logs_userId_idx" ON "public"."meeting_logs"("userId");

-- CreateIndex
CREATE INDEX "meeting_logs_contactId_idx" ON "public"."meeting_logs"("contactId");

-- CreateIndex
CREATE INDEX "notes_leadId_idx" ON "public"."notes"("leadId");

-- CreateIndex
CREATE INDEX "notes_createdById_idx" ON "public"."notes"("createdById");

-- CreateIndex
CREATE INDEX "notes_deletedAt_idx" ON "public"."notes"("deletedAt");

-- CreateIndex
CREATE INDEX "activities_leadId_idx" ON "public"."activities"("leadId");

-- CreateIndex
CREATE INDEX "activities_assignedToId_idx" ON "public"."activities"("assignedToId");

-- CreateIndex
CREATE INDEX "activities_deletedAt_idx" ON "public"."activities"("deletedAt");

-- CreateIndex
CREATE INDEX "activities_createdById_idx" ON "public"."activities"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_quotationCode_key" ON "public"."quotations"("quotationCode");

-- CreateIndex
CREATE INDEX "quotations_quotationCode_idx" ON "public"."quotations"("quotationCode");

-- CreateIndex
CREATE INDEX "quotations_status_idx" ON "public"."quotations"("status");

-- CreateIndex
CREATE INDEX "quotations_deletedAt_idx" ON "public"."quotations"("deletedAt");

-- CreateIndex
CREATE INDEX "quotations_contactId_idx" ON "public"."quotations"("contactId");

-- CreateIndex
CREATE INDEX "quotations_leadId_idx" ON "public"."quotations"("leadId");

-- CreateIndex
CREATE INDEX "quotations_accountId_idx" ON "public"."quotations"("accountId");

-- CreateIndex
CREATE INDEX "quotations_createdById_idx" ON "public"."quotations"("createdById");

-- CreateIndex
CREATE INDEX "quotations_updatedById_idx" ON "public"."quotations"("updatedById");

-- CreateIndex
CREATE INDEX "quotations_vehicleId_idx" ON "public"."quotations"("vehicleId");

-- CreateIndex
CREATE INDEX "quotation_versions_quotationId_idx" ON "public"."quotation_versions"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_versions_createdById_idx" ON "public"."quotation_versions"("createdById");

-- CreateIndex
CREATE INDEX "quotation_addons_quotationId_idx" ON "public"."quotation_addons"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_discounts_quotationId_idx" ON "public"."quotation_discounts"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "quotation_comparisons_comparisonCode_key" ON "public"."quotation_comparisons"("comparisonCode");

-- CreateIndex
CREATE INDEX "quotation_comparisons_comparisonCode_idx" ON "public"."quotation_comparisons"("comparisonCode");

-- CreateIndex
CREATE INDEX "quotation_comparisons_leadId_idx" ON "public"."quotation_comparisons"("leadId");

-- CreateIndex
CREATE INDEX "quotation_histories_quotationId_idx" ON "public"."quotation_histories"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_histories_createdById_idx" ON "public"."quotation_histories"("createdById");

-- CreateIndex
CREATE INDEX "quotation_documents_quotationId_idx" ON "public"."quotation_documents"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "policies_policyNumber_key" ON "public"."policies"("policyNumber");

-- CreateIndex
CREATE UNIQUE INDEX "policies_quotationId_key" ON "public"."policies"("quotationId");

-- CreateIndex
CREATE UNIQUE INDEX "policies_proposalId_key" ON "public"."policies"("proposalId");

-- CreateIndex
CREATE INDEX "policies_policyNumber_idx" ON "public"."policies"("policyNumber");

-- CreateIndex
CREATE INDEX "policies_status_idx" ON "public"."policies"("status");

-- CreateIndex
CREATE INDEX "policies_contactId_idx" ON "public"."policies"("contactId");

-- CreateIndex
CREATE INDEX "policies_expiryDate_idx" ON "public"."policies"("expiryDate");

-- CreateIndex
CREATE INDEX "policies_accountId_idx" ON "public"."policies"("accountId");

-- CreateIndex
CREATE INDEX "policies_deletedAt_idx" ON "public"."policies"("deletedAt");

-- CreateIndex
CREATE INDEX "policies_createdById_idx" ON "public"."policies"("createdById");

-- CreateIndex
CREATE INDEX "policies_status_expiryDate_idx" ON "public"."policies"("status", "expiryDate");

-- CreateIndex
CREATE INDEX "policies_quotationId_idx" ON "public"."policies"("quotationId");

-- CreateIndex
CREATE INDEX "policies_updatedById_idx" ON "public"."policies"("updatedById");

-- CreateIndex
CREATE INDEX "policies_proposalId_idx" ON "public"."policies"("proposalId");

-- CreateIndex
CREATE INDEX "policies_vehicleId_idx" ON "public"."policies"("vehicleId");

-- CreateIndex
CREATE INDEX "policy_members_policyId_idx" ON "public"."policy_members"("policyId");

-- CreateIndex
CREATE INDEX "policy_nominees_policyId_idx" ON "public"."policy_nominees"("policyId");

-- CreateIndex
CREATE INDEX "policy_renewals_policyId_idx" ON "public"."policy_renewals"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "policy_renewals_policyId_renewalNumber_key" ON "public"."policy_renewals"("policyId", "renewalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "policy_payments_transactionId_key" ON "public"."policy_payments"("transactionId");

-- CreateIndex
CREATE INDEX "policy_payments_policyId_idx" ON "public"."policy_payments"("policyId");

-- CreateIndex
CREATE INDEX "policy_payments_transactionId_idx" ON "public"."policy_payments"("transactionId");

-- CreateIndex
CREATE INDEX "policy_documents_policyId_idx" ON "public"."policy_documents"("policyId");

-- CreateIndex
CREATE INDEX "policy_histories_policyId_idx" ON "public"."policy_histories"("policyId");

-- CreateIndex
CREATE INDEX "policy_histories_createdById_idx" ON "public"."policy_histories"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "claims_claimNumber_key" ON "public"."claims"("claimNumber");

-- CreateIndex
CREATE INDEX "claims_claimNumber_idx" ON "public"."claims"("claimNumber");

-- CreateIndex
CREATE INDEX "claims_status_idx" ON "public"."claims"("status");

-- CreateIndex
CREATE INDEX "claims_policyId_idx" ON "public"."claims"("policyId");

-- CreateIndex
CREATE INDEX "claims_contactId_idx" ON "public"."claims"("contactId");

-- CreateIndex
CREATE INDEX "claims_incidentDate_idx" ON "public"."claims"("incidentDate");

-- CreateIndex
CREATE INDEX "claims_accountId_idx" ON "public"."claims"("accountId");

-- CreateIndex
CREATE INDEX "claims_deletedAt_idx" ON "public"."claims"("deletedAt");

-- CreateIndex
CREATE INDEX "claims_createdById_idx" ON "public"."claims"("createdById");

-- CreateIndex
CREATE INDEX "claims_updatedById_idx" ON "public"."claims"("updatedById");

-- CreateIndex
CREATE INDEX "claim_documents_claimId_idx" ON "public"."claim_documents"("claimId");

-- CreateIndex
CREATE INDEX "claim_documents_uploadedById_idx" ON "public"."claim_documents"("uploadedById");

-- CreateIndex
CREATE INDEX "claim_histories_claimId_idx" ON "public"."claim_histories"("claimId");

-- CreateIndex
CREATE INDEX "claim_histories_createdById_idx" ON "public"."claim_histories"("createdById");

-- CreateIndex
CREATE INDEX "claim_communications_claimId_idx" ON "public"."claim_communications"("claimId");

-- CreateIndex
CREATE INDEX "claim_communications_senderId_idx" ON "public"."claim_communications"("senderId");

-- CreateIndex
CREATE INDEX "notifications_userId_idx" ON "public"."notifications"("userId");

-- CreateIndex
CREATE INDEX "notifications_isRead_idx" ON "public"."notifications"("isRead");

-- CreateIndex
CREATE INDEX "notifications_userId_isRead_idx" ON "public"."notifications"("userId", "isRead");

-- CreateIndex
CREATE INDEX "notifications_createdAt_idx" ON "public"."notifications"("createdAt");

-- CreateIndex
CREATE INDEX "notifications_entityId_idx" ON "public"."notifications"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "notification_templates_name_key" ON "public"."notification_templates"("name");

-- CreateIndex
CREATE UNIQUE INDEX "notification_preferences_userId_key" ON "public"."notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "notification_preferences_userId_idx" ON "public"."notification_preferences"("userId");

-- CreateIndex
CREATE INDEX "notification_histories_notificationId_idx" ON "public"."notification_histories"("notificationId");

-- CreateIndex
CREATE INDEX "renewal_tasks_policyId_idx" ON "public"."renewal_tasks"("policyId");

-- CreateIndex
CREATE INDEX "renewal_tasks_agentId_idx" ON "public"."renewal_tasks"("agentId");

-- CreateIndex
CREATE INDEX "renewal_tasks_status_idx" ON "public"."renewal_tasks"("status");

-- CreateIndex
CREATE INDEX "renewal_tasks_dueDate_idx" ON "public"."renewal_tasks"("dueDate");

-- CreateIndex
CREATE INDEX "renewal_tasks_agentId_status_idx" ON "public"."renewal_tasks"("agentId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "documents_documentNumber_key" ON "public"."documents"("documentNumber");

-- CreateIndex
CREATE INDEX "documents_entityType_entityId_idx" ON "public"."documents"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "documents_uploadedById_idx" ON "public"."documents"("uploadedById");

-- CreateIndex
CREATE INDEX "documents_documentNumber_idx" ON "public"."documents"("documentNumber");

-- CreateIndex
CREATE INDEX "documents_entityId_idx" ON "public"."documents"("entityId");

-- CreateIndex
CREATE INDEX "documents_deletedAt_idx" ON "public"."documents"("deletedAt");

-- CreateIndex
CREATE INDEX "document_versions_documentId_idx" ON "public"."document_versions"("documentId");

-- CreateIndex
CREATE UNIQUE INDEX "document_versions_documentId_version_key" ON "public"."document_versions"("documentId", "version");

-- CreateIndex
CREATE INDEX "document_access_logs_documentId_idx" ON "public"."document_access_logs"("documentId");

-- CreateIndex
CREATE INDEX "document_access_logs_userId_idx" ON "public"."document_access_logs"("userId");

-- CreateIndex
CREATE INDEX "vehicle_category_documents_vehicleType_idx" ON "public"."vehicle_category_documents"("vehicleType");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_manufacturers_name_key" ON "public"."vehicle_manufacturers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_manufacturers_code_key" ON "public"."vehicle_manufacturers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_models_code_key" ON "public"."vehicle_models"("code");

-- CreateIndex
CREATE INDEX "vehicle_models_manufacturerId_idx" ON "public"."vehicle_models"("manufacturerId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicle_variants_code_key" ON "public"."vehicle_variants"("code");

-- CreateIndex
CREATE INDEX "vehicle_variants_modelId_idx" ON "public"."vehicle_variants"("modelId");

-- CreateIndex
CREATE UNIQUE INDEX "rto_masters_code_key" ON "public"."rto_masters"("code");

-- CreateIndex
CREATE INDEX "rto_masters_code_idx" ON "public"."rto_masters"("code");

-- CreateIndex
CREATE INDEX "rto_masters_state_idx" ON "public"."rto_masters"("state");

-- CreateIndex
CREATE UNIQUE INDEX "insurers_name_key" ON "public"."insurers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "insurers_code_key" ON "public"."insurers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "insurance_products_code_key" ON "public"."insurance_products"("code");

-- CreateIndex
CREATE INDEX "insurance_products_insurerId_idx" ON "public"."insurance_products"("insurerId");

-- CreateIndex
CREATE INDEX "discount_rules_insurerId_idx" ON "public"."discount_rules"("insurerId");

-- CreateIndex
CREATE INDEX "commission_matrices_insurerId_idx" ON "public"."commission_matrices"("insurerId");

-- CreateIndex
CREATE INDEX "underwriting_questions_insurerId_idx" ON "public"."underwriting_questions"("insurerId");

-- CreateIndex
CREATE INDEX "add_on_rules_insurerId_idx" ON "public"."add_on_rules"("insurerId");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "public"."products"("code");

-- CreateIndex
CREATE INDEX "rating_rules_productId_idx" ON "public"."rating_rules"("productId");

-- CreateIndex
CREATE INDEX "rating_rules_insurerId_idx" ON "public"."rating_rules"("insurerId");

-- CreateIndex
CREATE INDEX "rating_rules_productId_insurerId_isActive_idx" ON "public"."rating_rules"("productId", "insurerId", "isActive");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_proposalNumber_key" ON "public"."proposals"("proposalNumber");

-- CreateIndex
CREATE UNIQUE INDEX "proposals_quotationId_key" ON "public"."proposals"("quotationId");

-- CreateIndex
CREATE INDEX "proposals_quotationId_idx" ON "public"."proposals"("quotationId");

-- CreateIndex
CREATE INDEX "proposals_contactId_idx" ON "public"."proposals"("contactId");

-- CreateIndex
CREATE INDEX "proposals_submittedById_idx" ON "public"."proposals"("submittedById");

-- CreateIndex
CREATE INDEX "proposals_reviewedById_idx" ON "public"."proposals"("reviewedById");

-- CreateIndex
CREATE INDEX "proposals_approvedById_idx" ON "public"."proposals"("approvedById");

-- CreateIndex
CREATE INDEX "proposal_documents_proposalId_idx" ON "public"."proposal_documents"("proposalId");

-- CreateIndex
CREATE INDEX "proposal_documents_documentId_idx" ON "public"."proposal_documents"("documentId");

-- CreateIndex
CREATE INDEX "proposal_histories_proposalId_idx" ON "public"."proposal_histories"("proposalId");

-- CreateIndex
CREATE INDEX "proposal_histories_performedById_idx" ON "public"."proposal_histories"("performedById");

-- CreateIndex
CREATE UNIQUE INDEX "endorsements_endorsementNumber_key" ON "public"."endorsements"("endorsementNumber");

-- CreateIndex
CREATE INDEX "endorsements_policyId_idx" ON "public"."endorsements"("policyId");

-- CreateIndex
CREATE INDEX "endorsements_requestedById_idx" ON "public"."endorsements"("requestedById");

-- CreateIndex
CREATE INDEX "endorsements_approvedById_idx" ON "public"."endorsements"("approvedById");

-- CreateIndex
CREATE INDEX "endorsement_documents_endorsementId_idx" ON "public"."endorsement_documents"("endorsementId");

-- CreateIndex
CREATE INDEX "endorsement_documents_documentId_idx" ON "public"."endorsement_documents"("documentId");

-- CreateIndex
CREATE INDEX "endorsement_histories_endorsementId_idx" ON "public"."endorsement_histories"("endorsementId");

-- CreateIndex
CREATE INDEX "endorsement_histories_performedById_idx" ON "public"."endorsement_histories"("performedById");

-- CreateIndex
CREATE INDEX "saved_reports_createdById_idx" ON "public"."saved_reports"("createdById");

-- CreateIndex
CREATE INDEX "saved_reports_category_idx" ON "public"."saved_reports"("category");

-- CreateIndex
CREATE INDEX "report_runs_savedReportId_idx" ON "public"."report_runs"("savedReportId");

-- CreateIndex
CREATE INDEX "report_runs_status_idx" ON "public"."report_runs"("status");

-- CreateIndex
CREATE INDEX "report_runs_triggeredById_idx" ON "public"."report_runs"("triggeredById");

-- CreateIndex
CREATE UNIQUE INDEX "kpi_definitions_key_key" ON "public"."kpi_definitions"("key");

-- CreateIndex
CREATE INDEX "kpi_definitions_category_idx" ON "public"."kpi_definitions"("category");

-- CreateIndex
CREATE INDEX "kpi_definitions_createdById_idx" ON "public"."kpi_definitions"("createdById");

-- CreateIndex
CREATE UNIQUE INDEX "reports_code_key" ON "public"."reports"("code");

-- CreateIndex
CREATE INDEX "reports_parentId_idx" ON "public"."reports"("parentId");

-- CreateIndex
CREATE INDEX "reports_createdById_idx" ON "public"."reports"("createdById");

-- CreateIndex
CREATE INDEX "reports_updatedById_idx" ON "public"."reports"("updatedById");

-- CreateIndex
CREATE INDEX "reports_deletedAt_idx" ON "public"."reports"("deletedAt");

-- CreateIndex
CREATE INDEX "report_columns_reportId_idx" ON "public"."report_columns"("reportId");

-- CreateIndex
CREATE INDEX "report_filters_reportId_idx" ON "public"."report_filters"("reportId");

-- CreateIndex
CREATE INDEX "report_executions_reportId_idx" ON "public"."report_executions"("reportId");

-- CreateIndex
CREATE INDEX "report_executions_requestedById_idx" ON "public"."report_executions"("requestedById");

-- CreateIndex
CREATE INDEX "report_schedules_reportId_idx" ON "public"."report_schedules"("reportId");

-- CreateIndex
CREATE INDEX "saved_report_filters_reportId_idx" ON "public"."saved_report_filters"("reportId");

-- CreateIndex
CREATE INDEX "saved_report_filters_userId_idx" ON "public"."saved_report_filters"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "saved_report_filters_userId_name_reportId_key" ON "public"."saved_report_filters"("userId", "name", "reportId");

-- CreateIndex
CREATE INDEX "favorite_reports_userId_idx" ON "public"."favorite_reports"("userId");

-- CreateIndex
CREATE INDEX "favorite_reports_reportId_idx" ON "public"."favorite_reports"("reportId");

-- CreateIndex
CREATE UNIQUE INDEX "favorite_reports_userId_reportId_key" ON "public"."favorite_reports"("userId", "reportId");

-- CreateIndex
CREATE UNIQUE INDEX "workflows_code_key" ON "public"."workflows"("code");

-- CreateIndex
CREATE INDEX "workflows_deletedAt_idx" ON "public"."workflows"("deletedAt");

-- CreateIndex
CREATE INDEX "workflow_states_workflowId_idx" ON "public"."workflow_states"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_states_escalationRoleId_idx" ON "public"."workflow_states"("escalationRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "workflow_states_workflowId_code_key" ON "public"."workflow_states"("workflowId", "code");

-- CreateIndex
CREATE INDEX "workflow_transitions_workflowId_idx" ON "public"."workflow_transitions"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_transitions_fromStateId_idx" ON "public"."workflow_transitions"("fromStateId");

-- CreateIndex
CREATE INDEX "workflow_transitions_toStateId_idx" ON "public"."workflow_transitions"("toStateId");

-- CreateIndex
CREATE INDEX "workflow_actions_stateId_idx" ON "public"."workflow_actions"("stateId");

-- CreateIndex
CREATE INDEX "workflow_actions_transitionId_idx" ON "public"."workflow_actions"("transitionId");

-- CreateIndex
CREATE INDEX "workflow_assignments_stateId_idx" ON "public"."workflow_assignments"("stateId");

-- CreateIndex
CREATE INDEX "workflow_assignments_transitionId_idx" ON "public"."workflow_assignments"("transitionId");

-- CreateIndex
CREATE INDEX "workflow_assignments_roleId_idx" ON "public"."workflow_assignments"("roleId");

-- CreateIndex
CREATE INDEX "workflow_assignments_userId_idx" ON "public"."workflow_assignments"("userId");

-- CreateIndex
CREATE INDEX "workflow_assignments_departmentId_idx" ON "public"."workflow_assignments"("departmentId");

-- CreateIndex
CREATE INDEX "workflow_assignments_branchId_idx" ON "public"."workflow_assignments"("branchId");

-- CreateIndex
CREATE INDEX "workflow_histories_workflowId_idx" ON "public"."workflow_histories"("workflowId");

-- CreateIndex
CREATE INDEX "workflow_histories_entityId_idx" ON "public"."workflow_histories"("entityId");

-- CreateIndex
CREATE INDEX "workflow_histories_fromStateId_idx" ON "public"."workflow_histories"("fromStateId");

-- CreateIndex
CREATE INDEX "workflow_histories_toStateId_idx" ON "public"."workflow_histories"("toStateId");

-- CreateIndex
CREATE INDEX "workflow_histories_performedById_idx" ON "public"."workflow_histories"("performedById");

-- CreateIndex
CREATE UNIQUE INDEX "BackgroundJob_jobId_key" ON "public"."BackgroundJob"("jobId");

-- CreateIndex
CREATE INDEX "BackgroundJob_queue_status_idx" ON "public"."BackgroundJob"("queue", "status");

-- CreateIndex
CREATE INDEX "BackgroundJob_type_idx" ON "public"."BackgroundJob"("type");

-- CreateIndex
CREATE INDEX "BackgroundJob_jobId_idx" ON "public"."BackgroundJob"("jobId");

-- CreateIndex
CREATE INDEX "BackgroundJob_correlationId_idx" ON "public"."BackgroundJob"("correlationId");

-- CreateIndex
CREATE UNIQUE INDEX "Company_code_key" ON "public"."Company"("code");

-- CreateIndex
CREATE INDEX "Company_taxId_idx" ON "public"."Company"("taxId");

-- CreateIndex
CREATE UNIQUE INDEX "Region_code_key" ON "public"."Region"("code");

-- CreateIndex
CREATE INDEX "Region_companyId_idx" ON "public"."Region"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "Zone_code_key" ON "public"."Zone"("code");

-- CreateIndex
CREATE INDEX "Zone_regionId_idx" ON "public"."Zone"("regionId");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "public"."Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_zoneId_idx" ON "public"."Branch"("zoneId");

-- CreateIndex
CREATE UNIQUE INDEX "Department_code_key" ON "public"."Department"("code");

-- CreateIndex
CREATE INDEX "Department_branchId_idx" ON "public"."Department"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "JobRole_code_key" ON "public"."JobRole"("code");

-- CreateIndex
CREATE INDEX "JobRole_departmentId_idx" ON "public"."JobRole"("departmentId");

-- CreateIndex
CREATE INDEX "JobRole_parentRoleId_idx" ON "public"."JobRole"("parentRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "DashboardRegistry_dashboardCode_key" ON "public"."DashboardRegistry"("dashboardCode");

-- CreateIndex
CREATE INDEX "DashboardRegistry_jobRoleId_idx" ON "public"."DashboardRegistry"("jobRoleId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspacePreference_userId_key" ON "public"."WorkspacePreference"("userId");

-- CreateIndex
CREATE INDEX "WorkspacePreference_userId_idx" ON "public"."WorkspacePreference"("userId");

-- CreateIndex
CREATE INDEX "Team_departmentId_idx" ON "public"."Team"("departmentId");

-- CreateIndex
CREATE UNIQUE INDEX "Team_departmentId_code_key" ON "public"."Team"("departmentId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "LookupCategory_code_key" ON "public"."LookupCategory"("code");

-- CreateIndex
CREATE INDEX "LookupValue_categoryId_idx" ON "public"."LookupValue"("categoryId");

-- CreateIndex
CREATE INDEX "LookupValue_parentId_idx" ON "public"."LookupValue"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "LookupValue_categoryId_code_key" ON "public"."LookupValue"("categoryId", "code");

-- CreateIndex
CREATE INDEX "Holiday_branchId_idx" ON "public"."Holiday"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "Holiday_date_branchId_key" ON "public"."Holiday"("date", "branchId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkingHours_dayOfWeek_key" ON "public"."WorkingHours"("dayOfWeek");

-- CreateIndex
CREATE INDEX "LeadScoreLog_leadId_idx" ON "public"."LeadScoreLog"("leadId");

-- CreateIndex
CREATE INDEX "LeadScoreLog_ruleId_idx" ON "public"."LeadScoreLog"("ruleId");

-- CreateIndex
CREATE INDEX "AssignmentRule_queueId_idx" ON "public"."AssignmentRule"("queueId");

-- CreateIndex
CREATE INDEX "QueueMember_queueId_idx" ON "public"."QueueMember"("queueId");

-- CreateIndex
CREATE INDEX "QueueMember_userId_idx" ON "public"."QueueMember"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "QueueMember_queueId_userId_key" ON "public"."QueueMember"("queueId", "userId");

-- CreateIndex
CREATE INDEX "SlaViolation_entityType_entityId_idx" ON "public"."SlaViolation"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "SlaViolation_entityId_idx" ON "public"."SlaViolation"("entityId");

-- CreateIndex
CREATE INDEX "SlaViolation_policyId_idx" ON "public"."SlaViolation"("policyId");

-- CreateIndex
CREATE UNIQUE INDEX "ChartOfAccount_code_key" ON "public"."ChartOfAccount"("code");

-- CreateIndex
CREATE UNIQUE INDEX "JournalEntry_entryNumber_key" ON "public"."JournalEntry"("entryNumber");

-- CreateIndex
CREATE INDEX "JournalEntry_date_idx" ON "public"."JournalEntry"("date");

-- CreateIndex
CREATE INDEX "JournalEntry_referenceId_referenceType_idx" ON "public"."JournalEntry"("referenceId", "referenceType");

-- CreateIndex
CREATE INDEX "JournalEntry_referenceId_idx" ON "public"."JournalEntry"("referenceId");

-- CreateIndex
CREATE INDEX "JournalLine_journalEntryId_idx" ON "public"."JournalLine"("journalEntryId");

-- CreateIndex
CREATE INDEX "JournalLine_accountId_idx" ON "public"."JournalLine"("accountId");

-- CreateIndex
CREATE UNIQUE INDEX "Invoice_invoiceNum_key" ON "public"."Invoice"("invoiceNum");

-- CreateIndex
CREATE INDEX "Invoice_status_idx" ON "public"."Invoice"("status");

-- CreateIndex
CREATE INDEX "Invoice_entityId_entityType_idx" ON "public"."Invoice"("entityId", "entityType");

-- CreateIndex
CREATE INDEX "Invoice_entityId_idx" ON "public"."Invoice"("entityId");

-- CreateIndex
CREATE UNIQUE INDEX "Receipt_receiptNum_key" ON "public"."Receipt"("receiptNum");

-- CreateIndex
CREATE INDEX "Receipt_customerId_idx" ON "public"."Receipt"("customerId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_receiptId_idx" ON "public"."PaymentAllocation"("receiptId");

-- CreateIndex
CREATE INDEX "PaymentAllocation_invoiceId_idx" ON "public"."PaymentAllocation"("invoiceId");

-- CreateIndex
CREATE INDEX "Commission_policyId_idx" ON "public"."Commission"("policyId");

-- CreateIndex
CREATE INDEX "Commission_userId_idx" ON "public"."Commission"("userId");

-- CreateIndex
CREATE INDEX "Commission_status_idx" ON "public"."Commission"("status");

-- CreateIndex
CREATE INDEX "Commission_planId_idx" ON "public"."Commission"("planId");

-- CreateIndex
CREATE UNIQUE INDEX "Settlement_batchNumber_key" ON "public"."Settlement"("batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerAnalytics_contactId_key" ON "public"."CustomerAnalytics"("contactId");

-- CreateIndex
CREATE INDEX "CustomerAnalytics_contactId_idx" ON "public"."CustomerAnalytics"("contactId");

-- CreateIndex
CREATE INDEX "CommunicationLog_contactId_idx" ON "public"."CommunicationLog"("contactId");

-- CreateIndex
CREATE INDEX "CommunicationLog_entityId_entityType_idx" ON "public"."CommunicationLog"("entityId", "entityType");

-- CreateIndex
CREATE INDEX "CommunicationLog_providerMessageId_idx" ON "public"."CommunicationLog"("providerMessageId");

-- CreateIndex
CREATE INDEX "CommunicationLog_entityId_idx" ON "public"."CommunicationLog"("entityId");

-- CreateIndex
CREATE INDEX "CommunicationLog_templateId_idx" ON "public"."CommunicationLog"("templateId");

-- CreateIndex
CREATE INDEX "CommunicationLog_correlationId_idx" ON "public"."CommunicationLog"("correlationId");

-- CreateIndex
CREATE INDEX "FamilyMember_contactId_idx" ON "public"."FamilyMember"("contactId");

-- CreateIndex
CREATE INDEX "DimAgent_branchId_idx" ON "public"."DimAgent"("branchId");

-- CreateIndex
CREATE INDEX "DimDate_dateId_idx" ON "public"."DimDate"("dateId");

-- CreateIndex
CREATE INDEX "FactPolicy_dateId_idx" ON "public"."FactPolicy"("dateId");

-- CreateIndex
CREATE INDEX "FactPolicy_branchId_idx" ON "public"."FactPolicy"("branchId");

-- CreateIndex
CREATE INDEX "FactPolicy_agentId_idx" ON "public"."FactPolicy"("agentId");

-- CreateIndex
CREATE INDEX "FactPolicy_customerId_idx" ON "public"."FactPolicy"("customerId");

-- CreateIndex
CREATE INDEX "FactPolicy_productId_idx" ON "public"."FactPolicy"("productId");

-- CreateIndex
CREATE INDEX "FactClaim_dateId_idx" ON "public"."FactClaim"("dateId");

-- CreateIndex
CREATE INDEX "FactClaim_policyId_idx" ON "public"."FactClaim"("policyId");

-- CreateIndex
CREATE INDEX "FactClaim_branchId_idx" ON "public"."FactClaim"("branchId");

-- CreateIndex
CREATE INDEX "FactClaim_customerId_idx" ON "public"."FactClaim"("customerId");

-- CreateIndex
CREATE INDEX "FactRevenue_dateId_idx" ON "public"."FactRevenue"("dateId");

-- CreateIndex
CREATE INDEX "FactRevenue_branchId_idx" ON "public"."FactRevenue"("branchId");

-- CreateIndex
CREATE INDEX "FactRevenue_agentId_idx" ON "public"."FactRevenue"("agentId");

-- CreateIndex
CREATE INDEX "FactRevenue_customerId_idx" ON "public"."FactRevenue"("customerId");

-- CreateIndex
CREATE INDEX "DashboardWidget_dashboardId_idx" ON "public"."DashboardWidget"("dashboardId");

-- CreateIndex
CREATE INDEX "DashboardWidget_widgetId_idx" ON "public"."DashboardWidget"("widgetId");

-- CreateIndex
CREATE INDEX "ForecastResult_branchId_idx" ON "public"."ForecastResult"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "WebhookAuditLog_providerEventId_key" ON "public"."WebhookAuditLog"("providerEventId");

-- CreateIndex
CREATE INDEX "WebhookAuditLog_providerEventId_idx" ON "public"."WebhookAuditLog"("providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "vehicles_vehicleCode_key" ON "public"."vehicles"("vehicleCode");

-- CreateIndex
CREATE INDEX "vehicles_registrationNumber_idx" ON "public"."vehicles"("registrationNumber");

-- CreateIndex
CREATE INDEX "vehicles_contactId_idx" ON "public"."vehicles"("contactId");

-- CreateIndex
CREATE INDEX "vehicles_category_idx" ON "public"."vehicles"("category");

-- CreateIndex
CREATE INDEX "vehicles_vehicleCode_idx" ON "public"."vehicles"("vehicleCode");

-- CreateIndex
CREATE INDEX "vehicles_deletedAt_idx" ON "public"."vehicles"("deletedAt");

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "public"."permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_teamId_fkey" FOREIGN KEY ("teamId") REFERENCES "public"."Team"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "public"."JobRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."users" ADD CONSTRAINT "users_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."refresh_tokens" ADD CONSTRAINT "refresh_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."audit_logs" ADD CONSTRAINT "audit_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."contacts" ADD CONSTRAINT "contacts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."accounts" ADD CONSTRAINT "accounts_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_duplicateOfId_fkey" FOREIGN KEY ("duplicateOfId") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_assignedManagerId_fkey" FOREIGN KEY ("assignedManagerId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_stage_history" ADD CONSTRAINT "lead_stage_history_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_stage_history" ADD CONSTRAINT "lead_stage_history_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_assignments" ADD CONSTRAINT "lead_assignments_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_assignments" ADD CONSTRAINT "lead_assignments_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."lead_assignments" ADD CONSTRAINT "lead_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_sourceLeadId_fkey" FOREIGN KEY ("sourceLeadId") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_createdLeadId_fkey" FOREIGN KEY ("createdLeadId") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."referrals" ADD CONSTRAINT "referrals_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_targets" ADD CONSTRAINT "sales_targets_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."sales_performance" ADD CONSTRAINT "sales_performance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."call_logs" ADD CONSTRAINT "call_logs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."call_logs" ADD CONSTRAINT "call_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meeting_logs" ADD CONSTRAINT "meeting_logs_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."meeting_logs" ADD CONSTRAINT "meeting_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notes" ADD CONSTRAINT "notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."activities" ADD CONSTRAINT "activities_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."quotations" ADD CONSTRAINT "quotations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "public"."proposals"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_members" ADD CONSTRAINT "policy_members_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_nominees" ADD CONSTRAINT "policy_nominees_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_renewals" ADD CONSTRAINT "policy_renewals_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_payments" ADD CONSTRAINT "policy_payments_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_documents" ADD CONSTRAINT "policy_documents_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_histories" ADD CONSTRAINT "policy_histories_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."policy_histories" ADD CONSTRAINT "policy_histories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

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
ALTER TABLE "public"."claim_histories" ADD CONSTRAINT "claim_histories_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_histories" ADD CONSTRAINT "claim_histories_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_communications" ADD CONSTRAINT "claim_communications_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."claim_communications" ADD CONSTRAINT "claim_communications_senderId_fkey" FOREIGN KEY ("senderId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."notification_histories" ADD CONSTRAINT "notification_histories_notificationId_fkey" FOREIGN KEY ("notificationId") REFERENCES "public"."notifications"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."renewal_tasks" ADD CONSTRAINT "renewal_tasks_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."renewal_tasks" ADD CONSTRAINT "renewal_tasks_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."documents" ADD CONSTRAINT "documents_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_versions" ADD CONSTRAINT "document_versions_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_access_logs" ADD CONSTRAINT "document_access_logs_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."document_access_logs" ADD CONSTRAINT "document_access_logs_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehicle_models" ADD CONSTRAINT "vehicle_models_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "public"."vehicle_manufacturers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehicle_variants" ADD CONSTRAINT "vehicle_variants_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "public"."vehicle_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."insurance_products" ADD CONSTRAINT "insurance_products_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "public"."insurers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."discount_rules" ADD CONSTRAINT "discount_rules_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "public"."insurers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."commission_matrices" ADD CONSTRAINT "commission_matrices_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "public"."insurers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."underwriting_questions" ADD CONSTRAINT "underwriting_questions_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "public"."insurers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."add_on_rules" ADD CONSTRAINT "add_on_rules_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "public"."insurers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rating_rules" ADD CONSTRAINT "rating_rules_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rating_rules" ADD CONSTRAINT "rating_rules_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "public"."insurers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposals" ADD CONSTRAINT "proposals_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "public"."quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposals" ADD CONSTRAINT "proposals_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposals" ADD CONSTRAINT "proposals_submittedById_fkey" FOREIGN KEY ("submittedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposals" ADD CONSTRAINT "proposals_reviewedById_fkey" FOREIGN KEY ("reviewedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposals" ADD CONSTRAINT "proposals_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposal_documents" ADD CONSTRAINT "proposal_documents_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "public"."proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposal_documents" ADD CONSTRAINT "proposal_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposal_histories" ADD CONSTRAINT "proposal_histories_proposalId_fkey" FOREIGN KEY ("proposalId") REFERENCES "public"."proposals"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."proposal_histories" ADD CONSTRAINT "proposal_histories_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsements" ADD CONSTRAINT "endorsements_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsements" ADD CONSTRAINT "endorsements_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsements" ADD CONSTRAINT "endorsements_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsement_documents" ADD CONSTRAINT "endorsement_documents_endorsementId_fkey" FOREIGN KEY ("endorsementId") REFERENCES "public"."endorsements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsement_documents" ADD CONSTRAINT "endorsement_documents_documentId_fkey" FOREIGN KEY ("documentId") REFERENCES "public"."documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsement_histories" ADD CONSTRAINT "endorsement_histories_endorsementId_fkey" FOREIGN KEY ("endorsementId") REFERENCES "public"."endorsements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."endorsement_histories" ADD CONSTRAINT "endorsement_histories_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_reports" ADD CONSTRAINT "saved_reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_runs" ADD CONSTRAINT "report_runs_savedReportId_fkey" FOREIGN KEY ("savedReportId") REFERENCES "public"."saved_reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_runs" ADD CONSTRAINT "report_runs_triggeredById_fkey" FOREIGN KEY ("triggeredById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."kpi_definitions" ADD CONSTRAINT "kpi_definitions_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."reports"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."reports" ADD CONSTRAINT "reports_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_columns" ADD CONSTRAINT "report_columns_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_filters" ADD CONSTRAINT "report_filters_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_executions" ADD CONSTRAINT "report_executions_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_executions" ADD CONSTRAINT "report_executions_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."report_schedules" ADD CONSTRAINT "report_schedules_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_report_filters" ADD CONSTRAINT "saved_report_filters_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."saved_report_filters" ADD CONSTRAINT "saved_report_filters_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."favorite_reports" ADD CONSTRAINT "favorite_reports_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."favorite_reports" ADD CONSTRAINT "favorite_reports_reportId_fkey" FOREIGN KEY ("reportId") REFERENCES "public"."reports"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_states" ADD CONSTRAINT "workflow_states_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_transitions" ADD CONSTRAINT "workflow_transitions_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_transitions" ADD CONSTRAINT "workflow_transitions_fromStateId_fkey" FOREIGN KEY ("fromStateId") REFERENCES "public"."workflow_states"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_transitions" ADD CONSTRAINT "workflow_transitions_toStateId_fkey" FOREIGN KEY ("toStateId") REFERENCES "public"."workflow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_actions" ADD CONSTRAINT "workflow_actions_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."workflow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_actions" ADD CONSTRAINT "workflow_actions_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "public"."workflow_transitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_assignments" ADD CONSTRAINT "workflow_assignments_stateId_fkey" FOREIGN KEY ("stateId") REFERENCES "public"."workflow_states"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_assignments" ADD CONSTRAINT "workflow_assignments_transitionId_fkey" FOREIGN KEY ("transitionId") REFERENCES "public"."workflow_transitions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_assignments" ADD CONSTRAINT "workflow_assignments_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "public"."roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_assignments" ADD CONSTRAINT "workflow_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_histories" ADD CONSTRAINT "workflow_histories_workflowId_fkey" FOREIGN KEY ("workflowId") REFERENCES "public"."workflows"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."workflow_histories" ADD CONSTRAINT "workflow_histories_performedById_fkey" FOREIGN KEY ("performedById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Region" ADD CONSTRAINT "Region_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "public"."Company"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Zone" ADD CONSTRAINT "Zone_regionId_fkey" FOREIGN KEY ("regionId") REFERENCES "public"."Region"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Branch" ADD CONSTRAINT "Branch_zoneId_fkey" FOREIGN KEY ("zoneId") REFERENCES "public"."Zone"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Department" ADD CONSTRAINT "Department_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "public"."Branch"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobRole" ADD CONSTRAINT "JobRole_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JobRole" ADD CONSTRAINT "JobRole_parentRoleId_fkey" FOREIGN KEY ("parentRoleId") REFERENCES "public"."JobRole"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DashboardRegistry" ADD CONSTRAINT "DashboardRegistry_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "public"."JobRole"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."WorkspacePreference" ADD CONSTRAINT "WorkspacePreference_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Team" ADD CONSTRAINT "Team_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "public"."Department"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LookupValue" ADD CONSTRAINT "LookupValue_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "public"."LookupCategory"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."LookupValue" ADD CONSTRAINT "LookupValue_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "public"."LookupValue"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QueueMember" ADD CONSTRAINT "QueueMember_queueId_fkey" FOREIGN KEY ("queueId") REFERENCES "public"."RoutingQueue"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."QueueMember" ADD CONSTRAINT "QueueMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalLine" ADD CONSTRAINT "JournalLine_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "public"."JournalEntry"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."JournalLine" ADD CONSTRAINT "JournalLine_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "public"."ChartOfAccount"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_receiptId_fkey" FOREIGN KEY ("receiptId") REFERENCES "public"."Receipt"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "public"."Invoice"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."Commission" ADD CONSTRAINT "Commission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CustomerAnalytics" ADD CONSTRAINT "CustomerAnalytics_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."CommunicationLog" ADD CONSTRAINT "CommunicationLog_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."FamilyMember" ADD CONSTRAINT "FamilyMember_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DashboardWidget" ADD CONSTRAINT "DashboardWidget_dashboardId_fkey" FOREIGN KEY ("dashboardId") REFERENCES "public"."Dashboard"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."DashboardWidget" ADD CONSTRAINT "DashboardWidget_widgetId_fkey" FOREIGN KEY ("widgetId") REFERENCES "public"."Widget"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
