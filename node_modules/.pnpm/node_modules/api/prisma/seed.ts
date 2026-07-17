import { PrismaClient, PermissionCategory, RoleType } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting database seed...");

  // -------------------------------
  // Roles
  // -------------------------------

  const roles = [
    {
      name: "Super Administrator",
      code: "SUPER_ADMIN",
      type: RoleType.SUPER_ADMIN,
      isSystem: true,
    },
    {
      name: "Administrator",
      code: "ADMIN",
      type: RoleType.ADMIN,
      isSystem: true,
    },
    {
      name: "Branch Manager",
      code: "BRANCH_MANAGER",
      type: RoleType.BRANCH_MANAGER,
    },
    {
      name: "Team Leader",
      code: "TEAM_LEADER",
      type: RoleType.TEAM_LEADER,
    },
    {
      name: "Sales Agent",
      code: "SALES_AGENT",
      type: RoleType.SALES_AGENT,
    },
    {
      name: "Operations",
      code: "OPERATIONS",
      type: RoleType.OPERATIONS,
    },
    {
      name: "Underwriter",
      code: "UNDERWRITER",
      type: RoleType.UNDERWRITER,
    },
    {
      name: "Claims Officer",
      code: "CLAIMS_OFFICER",
      type: RoleType.CLAIMS_OFFICER,
    },
    {
      name: "Finance",
      code: "FINANCE",
      type: RoleType.FINANCE,
    },
    {
      name: "Support",
      code: "SUPPORT",
      type: RoleType.SUPPORT,
    },
    {
      name: "Customer",
      code: "CUSTOMER",
      type: RoleType.CUSTOMER,
    },
  ];

  for (const role of roles) {
    await prisma.role.upsert({
      where: { code: role.code },
      update: {},
      create: role,
    });
  }

  // -------------------------------
  // Permissions
  // -------------------------------

  const permissions = [
    ["Create User", "user:create", PermissionCategory.USER],
    ["Update User", "user:update", PermissionCategory.USER],
    ["Delete User", "user:delete", PermissionCategory.USER],
    ["View User", "user:view", PermissionCategory.USER],

    ["Create Lead", "lead:create", PermissionCategory.LEAD],
    ["Update Lead", "lead:update", PermissionCategory.LEAD],
    ["Delete Lead", "lead:delete", PermissionCategory.LEAD],
    ["View Lead", "lead:view", PermissionCategory.LEAD],

    ["Create Quotation", "quotation:create", PermissionCategory.QUOTATION],
    ["Approve Quotation", "quotation:approve", PermissionCategory.QUOTATION],

    ["Create Policy", "policy:create", PermissionCategory.POLICY],
    ["Approve Policy", "policy:approve", PermissionCategory.POLICY],

    ["Create Claim", "claim:create", PermissionCategory.CLAIM],
    ["Approve Claim", "claim:approve", PermissionCategory.CLAIM],

    ["View Dashboard", "dashboard:view", PermissionCategory.DASHBOARD],
    ["View Reports", "report:view", PermissionCategory.REPORT],
  ];

  for (const permission of permissions) {
    await prisma.permission.upsert({
      where: { code: permission[1] as string },
      update: {},
      create: {
        name: permission[0] as string,
        code: permission[1] as string,
        category: permission[2] as PermissionCategory,
      },
    });
  }

  console.log("✅ Database seeded successfully.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
  