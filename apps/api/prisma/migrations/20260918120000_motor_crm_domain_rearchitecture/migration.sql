-- Motor CRM Re-Architecture Migration
-- Safe, Non-Destructive Expand Phase

-- 1. Create Enums
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'MotorQuotationStatus') THEN
        CREATE TYPE "public"."MotorQuotationStatus" AS ENUM ('DRAFT', 'SHARED', 'ACCEPTED', 'REJECTED', 'EXPIRED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'BackOfficeTaskStatus') THEN
        CREATE TYPE "public"."BackOfficeTaskStatus" AS ENUM ('PENDING', 'IN_REVIEW', 'VERIFIED', 'REJECTED', 'COMPLETED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InspectionType') THEN
        CREATE TYPE "public"."InspectionType" AS ENUM ('SELF', 'SURVEYOR', 'AGENCY');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'InspectionState') THEN
        CREATE TYPE "public"."InspectionState" AS ENUM ('INITIATED', 'SCHEDULED', 'SUBMITTED', 'APPROVED', 'REJECTED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskPriority') THEN
        CREATE TYPE "public"."TaskPriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskStatus') THEN
        CREATE TYPE "public"."TaskStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'TaskType') THEN
        CREATE TYPE "public"."TaskType" AS ENUM ('FOLLOW_UP', 'CALL', 'MEETING', 'INSPECTION', 'COLLECTION', 'VERIFICATION', 'OTHER');
    END IF;
END $$;

-- 2. Alter Enum LeadStatus
ALTER TYPE "public"."LeadStatus" ADD VALUE IF NOT EXISTS 'QUOTATION';
ALTER TYPE "public"."LeadStatus" ADD VALUE IF NOT EXISTS 'CUSTOMER_ACCEPTED';
ALTER TYPE "public"."LeadStatus" ADD VALUE IF NOT EXISTS 'PAYMENT_PENDING';
ALTER TYPE "public"."LeadStatus" ADD VALUE IF NOT EXISTS 'POST_PAYMENT';
ALTER TYPE "public"."LeadStatus" ADD VALUE IF NOT EXISTS 'BACK_OFFICE';

-- 3. Alter Existing Tables
ALTER TABLE "public"."claims" ADD COLUMN IF NOT EXISTS "customerId" TEXT;

ALTER TABLE "public"."leads" 
    ADD COLUMN IF NOT EXISTS "agentId" TEXT,
    ADD COLUMN IF NOT EXISTS "customerId" TEXT;

ALTER TABLE "public"."policies" ADD COLUMN IF NOT EXISTS "customerId" TEXT;

ALTER TABLE "public"."vehicles" 
    ADD COLUMN IF NOT EXISTS "customerId" TEXT,
    ADD COLUMN IF NOT EXISTS "leadId" TEXT,
    ADD COLUMN IF NOT EXISTS "make" TEXT,
    ADD COLUMN IF NOT EXISTS "manufactureMonth" INTEGER,
    ADD COLUMN IF NOT EXISTS "manufactureYear" INTEGER,
    ADD COLUMN IF NOT EXISTS "model" TEXT,
    ADD COLUMN IF NOT EXISTS "variant" TEXT;

-- 4. Create New Tables
CREATE TABLE IF NOT EXISTS "public"."agents" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "agentCode" TEXT NOT NULL,
    "agencyName" TEXT,
    "licenseNumber" TEXT,
    "commissionTier" TEXT DEFAULT 'STANDARD',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "agents_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."customers" (
    "id" TEXT NOT NULL,
    "customerCode" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT,
    "mobile" TEXT NOT NULL,
    "email" TEXT,
    "panNumber" TEXT,
    "aadhaarNumber" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "pincode" TEXT,
    "isVip" BOOLEAN NOT NULL DEFAULT false,
    "contactId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."motor_quotations" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "leadId" TEXT NOT NULL,
    "vehicleId" TEXT NOT NULL,
    "customerId" TEXT,
    "agentId" TEXT,
    "agentCodeSnapshot" TEXT,
    "insurerName" TEXT NOT NULL,
    "planName" TEXT,
    "policyType" "public"."MotorPolicyType" NOT NULL DEFAULT 'PACKAGE_COMPREHENSIVE',
    "status" "public"."MotorQuotationStatus" NOT NULL DEFAULT 'DRAFT',
    "idv" DECIMAL(12,2),
    "odPremium" DECIMAL(12,2),
    "tpPremium" DECIMAL(12,2),
    "addonPremium" DECIMAL(12,2),
    "ncbDiscount" DECIMAL(12,2),
    "otherDiscounts" DECIMAL(12,2),
    "netPremium" DECIMAL(12,2),
    "gstAmount" DECIMAL(12,2),
    "finalPremium" DECIMAL(12,2) NOT NULL,
    "breakup" JSONB,
    "addonsSelected" JSONB,
    "policyId" TEXT,
    "createdById" TEXT,
    "validUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "motor_quotations_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."tasks" (
    "id" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "type" "public"."TaskType" NOT NULL DEFAULT 'FOLLOW_UP',
    "priority" "public"."TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "status" "public"."TaskStatus" NOT NULL DEFAULT 'PENDING',
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "assignedToId" TEXT,
    "customerId" TEXT,
    "leadId" TEXT,
    "vehicleId" TEXT,
    "policyId" TEXT,
    "claimId" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."back_office_tasks" (
    "id" TEXT NOT NULL,
    "taskCode" TEXT NOT NULL,
    "taskType" TEXT NOT NULL,
    "status" "public"."BackOfficeTaskStatus" NOT NULL DEFAULT 'PENDING',
    "priority" "public"."TaskPriority" NOT NULL DEFAULT 'MEDIUM',
    "leadId" TEXT,
    "motorQuotationId" TEXT,
    "assignedToId" TEXT,
    "missingItems" JSONB,
    "checklistStatus" JSONB,
    "verificationNotes" TEXT,
    "rejectedReason" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "back_office_tasks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."inspections" (
    "id" TEXT NOT NULL,
    "inspectionCode" TEXT NOT NULL,
    "type" "public"."InspectionType" NOT NULL DEFAULT 'SELF',
    "status" "public"."InspectionState" NOT NULL DEFAULT 'INITIATED',
    "vehicleId" TEXT,
    "motorQuotationId" TEXT,
    "policyId" TEXT,
    "claimId" TEXT,
    "inspectorId" TEXT,
    "mediaUrls" JSONB,
    "breakinReason" TEXT,
    "inspectionDate" TIMESTAMP(3),
    "remarks" TEXT,
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deletedAt" TIMESTAMP(3),

    CONSTRAINT "inspections_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "public"."customer_alerts" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "alertType" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "actionUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_alerts_pkey" PRIMARY KEY ("id")
);

-- 5. Create Indexes
CREATE UNIQUE INDEX IF NOT EXISTS "agents_userId_key" ON "public"."agents"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "agents_agentCode_key" ON "public"."agents"("agentCode");
CREATE INDEX IF NOT EXISTS "agents_agentCode_idx" ON "public"."agents"("agentCode");
CREATE INDEX IF NOT EXISTS "agents_isActive_idx" ON "public"."agents"("isActive");
CREATE INDEX IF NOT EXISTS "agents_deletedAt_idx" ON "public"."agents"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "customers_customerCode_key" ON "public"."customers"("customerCode");
CREATE UNIQUE INDEX IF NOT EXISTS "customers_contactId_key" ON "public"."customers"("contactId");
CREATE INDEX IF NOT EXISTS "customers_mobile_idx" ON "public"."customers"("mobile");
CREATE INDEX IF NOT EXISTS "customers_email_idx" ON "public"."customers"("email");
CREATE INDEX IF NOT EXISTS "customers_customerCode_idx" ON "public"."customers"("customerCode");
CREATE INDEX IF NOT EXISTS "customers_deletedAt_idx" ON "public"."customers"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "motor_quotations_quotationNumber_key" ON "public"."motor_quotations"("quotationNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "motor_quotations_policyId_key" ON "public"."motor_quotations"("policyId");
CREATE INDEX IF NOT EXISTS "motor_quotations_leadId_idx" ON "public"."motor_quotations"("leadId");
CREATE INDEX IF NOT EXISTS "motor_quotations_vehicleId_idx" ON "public"."motor_quotations"("vehicleId");
CREATE INDEX IF NOT EXISTS "motor_quotations_customerId_idx" ON "public"."motor_quotations"("customerId");
CREATE INDEX IF NOT EXISTS "motor_quotations_agentId_idx" ON "public"."motor_quotations"("agentId");
CREATE INDEX IF NOT EXISTS "motor_quotations_status_idx" ON "public"."motor_quotations"("status");
CREATE INDEX IF NOT EXISTS "motor_quotations_quotationNumber_idx" ON "public"."motor_quotations"("quotationNumber");
CREATE INDEX IF NOT EXISTS "motor_quotations_deletedAt_idx" ON "public"."motor_quotations"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "tasks_taskCode_key" ON "public"."tasks"("taskCode");
CREATE INDEX IF NOT EXISTS "tasks_assignedToId_dueDate_status_idx" ON "public"."tasks"("assignedToId", "dueDate", "status");
CREATE INDEX IF NOT EXISTS "tasks_status_idx" ON "public"."tasks"("status");
CREATE INDEX IF NOT EXISTS "tasks_dueDate_idx" ON "public"."tasks"("dueDate");
CREATE INDEX IF NOT EXISTS "tasks_taskCode_idx" ON "public"."tasks"("taskCode");
CREATE INDEX IF NOT EXISTS "tasks_deletedAt_idx" ON "public"."tasks"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "back_office_tasks_taskCode_key" ON "public"."back_office_tasks"("taskCode");
CREATE INDEX IF NOT EXISTS "back_office_tasks_assignedToId_status_idx" ON "public"."back_office_tasks"("assignedToId", "status");
CREATE INDEX IF NOT EXISTS "back_office_tasks_status_idx" ON "public"."back_office_tasks"("status");
CREATE INDEX IF NOT EXISTS "back_office_tasks_leadId_idx" ON "public"."back_office_tasks"("leadId");
CREATE INDEX IF NOT EXISTS "back_office_tasks_motorQuotationId_idx" ON "public"."back_office_tasks"("motorQuotationId");
CREATE INDEX IF NOT EXISTS "back_office_tasks_taskCode_idx" ON "public"."back_office_tasks"("taskCode");
CREATE INDEX IF NOT EXISTS "back_office_tasks_deletedAt_idx" ON "public"."back_office_tasks"("deletedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "inspections_inspectionCode_key" ON "public"."inspections"("inspectionCode");
CREATE INDEX IF NOT EXISTS "inspections_vehicleId_idx" ON "public"."inspections"("vehicleId");
CREATE INDEX IF NOT EXISTS "inspections_motorQuotationId_idx" ON "public"."inspections"("motorQuotationId");
CREATE INDEX IF NOT EXISTS "inspections_status_idx" ON "public"."inspections"("status");
CREATE INDEX IF NOT EXISTS "inspections_inspectionCode_idx" ON "public"."inspections"("inspectionCode");
CREATE INDEX IF NOT EXISTS "inspections_deletedAt_idx" ON "public"."inspections"("deletedAt");

CREATE INDEX IF NOT EXISTS "customer_alerts_customerId_isRead_idx" ON "public"."customer_alerts"("customerId", "isRead");
CREATE INDEX IF NOT EXISTS "claims_customerId_idx" ON "public"."claims"("customerId");
CREATE INDEX IF NOT EXISTS "policies_customerId_idx" ON "public"."policies"("customerId");

-- 6. Add Foreign Keys safely
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_customerId_fkey') THEN
        ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'leads_agentId_fkey') THEN
        ALTER TABLE "public"."leads" ADD CONSTRAINT "leads_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'policies_customerId_fkey') THEN
        ALTER TABLE "public"."policies" ADD CONSTRAINT "policies_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'claims_customerId_fkey') THEN
        ALTER TABLE "public"."claims" ADD CONSTRAINT "claims_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_customerId_fkey') THEN
        ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'vehicles_leadId_fkey') THEN
        ALTER TABLE "public"."vehicles" ADD CONSTRAINT "vehicles_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'agents_userId_fkey') THEN
        ALTER TABLE "public"."agents" ADD CONSTRAINT "agents_userId_fkey" FOREIGN KEY ("userId") REFERENCES "public"."users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_contactId_fkey') THEN
        ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "public"."contacts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customers_createdById_fkey') THEN
        ALTER TABLE "public"."customers" ADD CONSTRAINT "customers_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotations_leadId_fkey') THEN
        ALTER TABLE "public"."motor_quotations" ADD CONSTRAINT "motor_quotations_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotations_vehicleId_fkey') THEN
        ALTER TABLE "public"."motor_quotations" ADD CONSTRAINT "motor_quotations_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."vehicles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotations_customerId_fkey') THEN
        ALTER TABLE "public"."motor_quotations" ADD CONSTRAINT "motor_quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotations_agentId_fkey') THEN
        ALTER TABLE "public"."motor_quotations" ADD CONSTRAINT "motor_quotations_agentId_fkey" FOREIGN KEY ("agentId") REFERENCES "public"."agents"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotations_policyId_fkey') THEN
        ALTER TABLE "public"."motor_quotations" ADD CONSTRAINT "motor_quotations_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'motor_quotations_createdById_fkey') THEN
        ALTER TABLE "public"."motor_quotations" ADD CONSTRAINT "motor_quotations_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_assignedToId_fkey') THEN
        ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_customerId_fkey') THEN
        ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_leadId_fkey') THEN
        ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_vehicleId_fkey') THEN
        ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_policyId_fkey') THEN
        ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_claimId_fkey') THEN
        ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tasks_createdById_fkey') THEN
        ALTER TABLE "public"."tasks" ADD CONSTRAINT "tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'back_office_tasks_leadId_fkey') THEN
        ALTER TABLE "public"."back_office_tasks" ADD CONSTRAINT "back_office_tasks_leadId_fkey" FOREIGN KEY ("leadId") REFERENCES "public"."leads"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'back_office_tasks_motorQuotationId_fkey') THEN
        ALTER TABLE "public"."back_office_tasks" ADD CONSTRAINT "back_office_tasks_motorQuotationId_fkey" FOREIGN KEY ("motorQuotationId") REFERENCES "public"."motor_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'back_office_tasks_assignedToId_fkey') THEN
        ALTER TABLE "public"."back_office_tasks" ADD CONSTRAINT "back_office_tasks_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'back_office_tasks_createdById_fkey') THEN
        ALTER TABLE "public"."back_office_tasks" ADD CONSTRAINT "back_office_tasks_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspections_vehicleId_fkey') THEN
        ALTER TABLE "public"."inspections" ADD CONSTRAINT "inspections_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "public"."vehicles"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspections_motorQuotationId_fkey') THEN
        ALTER TABLE "public"."inspections" ADD CONSTRAINT "inspections_motorQuotationId_fkey" FOREIGN KEY ("motorQuotationId") REFERENCES "public"."motor_quotations"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspections_policyId_fkey') THEN
        ALTER TABLE "public"."inspections" ADD CONSTRAINT "inspections_policyId_fkey" FOREIGN KEY ("policyId") REFERENCES "public"."policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspections_claimId_fkey') THEN
        ALTER TABLE "public"."inspections" ADD CONSTRAINT "inspections_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "public"."claims"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspections_inspectorId_fkey') THEN
        ALTER TABLE "public"."inspections" ADD CONSTRAINT "inspections_inspectorId_fkey" FOREIGN KEY ("inspectorId") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'inspections_createdById_fkey') THEN
        ALTER TABLE "public"."inspections" ADD CONSTRAINT "inspections_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "public"."users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'customer_alerts_customerId_fkey') THEN
        ALTER TABLE "public"."customer_alerts" ADD CONSTRAINT "customer_alerts_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "public"."customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
    END IF;
END $$;
