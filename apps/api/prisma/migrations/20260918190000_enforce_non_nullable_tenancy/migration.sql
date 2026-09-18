-- AlterTable
ALTER TABLE "public"."agents" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."back_office_tasks" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."claims" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."customer_agent_histories" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."customers" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."leads" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."motor_quotations" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."policies" ALTER COLUMN "companyId" SET NOT NULL;

-- AlterTable
ALTER TABLE "public"."quotations" ALTER COLUMN "companyId" SET NOT NULL;
