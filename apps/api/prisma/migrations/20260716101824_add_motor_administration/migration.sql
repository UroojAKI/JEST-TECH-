-- CreateEnum
CREATE TYPE "public"."VehicleType" AS ENUM ('TWO_WHEELER', 'FOUR_WHEELER', 'COMMERCIAL');

-- CreateEnum
CREATE TYPE "public"."FuelType" AS ENUM ('PETROL', 'DIESEL', 'CNG', 'ELECTRIC', 'HYBRID');

-- CreateEnum
CREATE TYPE "public"."TransmissionType" AS ENUM ('MANUAL', 'AUTOMATIC');

-- CreateEnum
CREATE TYPE "public"."RatingRuleType" AS ENUM ('BASE_RATE', 'AGE_LOADING', 'NCB_DISCOUNT', 'OD_DISCOUNT', 'ADDON_RATE', 'TAX_RATE');

-- CreateEnum
CREATE TYPE "public"."ProductType" AS ENUM ('THIRD_PARTY', 'COMPREHENSIVE', 'ZERO_DEP', 'OWN_DAMAGE', 'COMMERCIAL');

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
CREATE TABLE "public"."insurers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "rating" DECIMAL(65,30),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "contactDetails" JSONB,
    "logoUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurers_pkey" PRIMARY KEY ("id")
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
CREATE UNIQUE INDEX "insurers_name_key" ON "public"."insurers"("name");

-- CreateIndex
CREATE UNIQUE INDEX "insurers_code_key" ON "public"."insurers"("code");

-- CreateIndex
CREATE UNIQUE INDEX "products_code_key" ON "public"."products"("code");

-- CreateIndex
CREATE INDEX "rating_rules_productId_idx" ON "public"."rating_rules"("productId");

-- CreateIndex
CREATE INDEX "rating_rules_insurerId_idx" ON "public"."rating_rules"("insurerId");

-- AddForeignKey
ALTER TABLE "public"."vehicle_models" ADD CONSTRAINT "vehicle_models_manufacturerId_fkey" FOREIGN KEY ("manufacturerId") REFERENCES "public"."vehicle_manufacturers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."vehicle_variants" ADD CONSTRAINT "vehicle_variants_modelId_fkey" FOREIGN KEY ("modelId") REFERENCES "public"."vehicle_models"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rating_rules" ADD CONSTRAINT "rating_rules_productId_fkey" FOREIGN KEY ("productId") REFERENCES "public"."products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "public"."rating_rules" ADD CONSTRAINT "rating_rules_insurerId_fkey" FOREIGN KEY ("insurerId") REFERENCES "public"."insurers"("id") ON DELETE CASCADE ON UPDATE CASCADE;
