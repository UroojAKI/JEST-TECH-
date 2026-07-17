/*
  Warnings:

  - You are about to drop the `permissions` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `role_permissions` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[type]` on the table `roles` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `type` to the `roles` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "public"."RoleType" AS ENUM ('SUPER_ADMIN', 'ADMIN', 'BRANCH_MANAGER', 'TEAM_LEADER', 'SALES_AGENT', 'OPERATIONS', 'UNDERWRITER', 'CLAIMS_OFFICER', 'FINANCE', 'SUPPORT', 'CUSTOMER');

-- DropForeignKey
ALTER TABLE "public"."role_permissions" DROP CONSTRAINT "role_permissions_permissionId_fkey";

-- DropForeignKey
ALTER TABLE "public"."role_permissions" DROP CONSTRAINT "role_permissions_roleId_fkey";

-- AlterTable
ALTER TABLE "public"."roles" ADD COLUMN     "isActive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "type" "public"."RoleType" NOT NULL;

-- DropTable
DROP TABLE "public"."permissions";

-- DropTable
DROP TABLE "public"."role_permissions";

-- DropEnum
DROP TYPE "public"."PermissionCategory";

-- CreateIndex
CREATE UNIQUE INDEX "roles_type_key" ON "public"."roles"("type");

-- CreateIndex
CREATE INDEX "roles_name_idx" ON "public"."roles"("name");

-- CreateIndex
CREATE INDEX "roles_code_idx" ON "public"."roles"("code");
