import { PrismaClient, PermissionCategory, RoleType, NotificationType, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Starting atomic database seeding...");

  await prisma.$transaction(async (tx) => {
    // -------------------------------------------------------------------------
    // 1. SEED ROLES
    // -------------------------------------------------------------------------
    const roles = [
      { name: "Super Administrator", code: "SUPER_ADMIN", type: RoleType.SUPER_ADMIN, isSystem: true },
      { name: "Administrator", code: "ADMIN", type: RoleType.ADMIN, isSystem: true },
      { name: "Branch Manager", code: "BRANCH_MANAGER", type: RoleType.BRANCH_MANAGER, isSystem: false },
      { name: "Team Leader", code: "TEAM_LEADER", type: RoleType.TEAM_LEADER, isSystem: false },
      { name: "Sales Agent", code: "SALES_AGENT", type: RoleType.SALES_AGENT, isSystem: false },
      { name: "Operations", code: "OPERATIONS", type: RoleType.OPERATIONS, isSystem: false },
      { name: "Underwriter", code: "UNDERWRITER", type: RoleType.UNDERWRITER, isSystem: false },
      { name: "Claims Officer", code: "CLAIMS_OFFICER", type: RoleType.CLAIMS_OFFICER, isSystem: false },
      { name: "Finance", code: "FINANCE", type: RoleType.FINANCE, isSystem: false },
      { name: "Support", code: "SUPPORT", type: RoleType.SUPPORT, isSystem: false },
      { name: "Customer", code: "CUSTOMER", type: RoleType.CUSTOMER, isSystem: false },
    ];

    const seededRoles: Record<string, any> = {};
    for (const r of roles) {
      const dbRole = await tx.role.upsert({
        where: { code: r.code },
        update: {},
        create: r,
      });
      seededRoles[r.code] = dbRole;
    }
    console.log(`- Seeded ${roles.length} roles.`);

    // -------------------------------------------------------------------------
    // 2. SEED PERMISSIONS
    // -------------------------------------------------------------------------
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
      ["View Reports", "REPORT_VIEW", PermissionCategory.REPORT],
      ["Create Reports", "REPORT_CREATE", PermissionCategory.REPORT],
      ["Execute Reports", "REPORT_EXECUTE", PermissionCategory.REPORT],
      ["Export Reports", "REPORT_EXPORT", PermissionCategory.REPORT],
      ["Schedule Reports", "REPORT_SCHEDULE", PermissionCategory.REPORT],
      ["View Workflows", "WORKFLOW_VIEW", PermissionCategory.WORKFLOW],
      ["Edit Workflows", "WORKFLOW_EDIT", PermissionCategory.WORKFLOW],
      ["Execute Workflows", "WORKFLOW_EXECUTE", PermissionCategory.WORKFLOW],
      ["Approve Workflows", "WORKFLOW_APPROVE", PermissionCategory.WORKFLOW],
    ];

    const seededPermissions: any[] = [];
    for (const p of permissions) {
      const dbPerm = await tx.permission.upsert({
        where: { code: p[1] as string },
        update: {},
        create: {
          name: p[0] as string,
          code: p[1] as string,
          category: p[2] as PermissionCategory,
        },
      });
      seededPermissions.push(dbPerm);
    }
    console.log(`- Seeded ${permissions.length} permissions.`);

    // -------------------------------------------------------------------------
    // 3. MAP PERMISSIONS TO ROLES
    // -------------------------------------------------------------------------
    // Assign all permissions to SUPER_ADMIN and ADMIN
    for (const roleCode of ["SUPER_ADMIN", "ADMIN"]) {
      const roleObj = seededRoles[roleCode];
      for (const permObj of seededPermissions) {
        await tx.rolePermission.upsert({
          where: {
            roleId_permissionId: {
              roleId: roleObj.id,
              permissionId: permObj.id,
            },
          },
          update: {},
          create: {
            roleId: roleObj.id,
            permissionId: permObj.id,
          },
        });
      }
    }
    console.log("- Mapped permissions to system administrative roles.");

    // -------------------------------------------------------------------------
    // 4. SEED SUPER ADMIN AND ADMIN USERS
    // -------------------------------------------------------------------------
    const passwordHash = await argon2.hash("Password@123");

    // Super Admin user
    const superAdminRole = seededRoles["SUPER_ADMIN"];
    await tx.user.upsert({
      where: { email: "superadmin@jest.com" },
      update: {},
      create: {
        email: "superadmin@jest.com",
        firstName: "System",
        lastName: "SuperAdmin",
        passwordHash,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        roleId: superAdminRole.id,
        employeeCode: "EMP-000001",
      },
    });

    // Admin user
    const adminRole = seededRoles["ADMIN"];
    await tx.user.upsert({
      where: { email: "admin@jest.com" },
      update: {},
      create: {
        email: "admin@jest.com",
        firstName: "System",
        lastName: "Administrator",
        passwordHash,
        status: UserStatus.ACTIVE,
        isEmailVerified: true,
        roleId: adminRole.id,
        employeeCode: "EMP-000002",
      },
    });
    console.log("- Seeded default administration user accounts.");

    // -------------------------------------------------------------------------
    // 5. SEED VEHICLE MASTER DATA
    // -------------------------------------------------------------------------
    const manufacturers = [
      { name: "Maruti Suzuki", code: "MSIL" },
      { name: "Hyundai Motors", code: "HYUN" },
      { name: "Honda Cars", code: "HOND" },
    ];

    for (const m of manufacturers) {
      const dbMfg = await tx.vehicleManufacturer.upsert({
        where: { code: m.code },
        update: {},
        create: m,
      });

      // Add a default model for each mfg
      if (m.code === "MSIL") {
        await tx.vehicleModel.upsert({
          where: { code: "SWIFT" },
          update: {},
          create: {
            name: "Swift Hatchback",
            code: "SWIFT",
            vehicleType: "FOUR_WHEELER",
            manufacturerId: dbMfg.id,
          },
        });
      } else if (m.code === "HYUN") {
        await tx.vehicleModel.upsert({
          where: { code: "I20" },
          update: {},
          create: {
            name: "i20 Elite",
            code: "I20",
            vehicleType: "FOUR_WHEELER",
            manufacturerId: dbMfg.id,
          },
        });
      } else if (m.code === "HOND") {
        await tx.vehicleModel.upsert({
          where: { code: "CITY" },
          update: {},
          create: {
            name: "City Sedan",
            code: "CITY",
            vehicleType: "FOUR_WHEELER",
            manufacturerId: dbMfg.id,
          },
        });
      }
    }
    console.log("- Seeded master vehicle manufacturers & models.");

    // -------------------------------------------------------------------------
    // 6. SEED NOTIFICATION TEMPLATES
    // -------------------------------------------------------------------------
    const templates = [
      {
        name: "Policy Issued Alert",
        type: NotificationType.POLICY_ISSUED,
        channel: "IN_APP",
        subject: "Your policy is active",
        body: "Hello, your JEST Policy #{policyNumber} is successfully issued. Welcome aboard!",
        variables: ["policyNumber"],
      },
      {
        name: "Claim Registered Alert",
        type: NotificationType.CLAIM_REGISTERED,
        channel: "IN_APP",
        subject: "Claim registration notice",
        body: "Claim Reference #{claimNumber} has been registered for Policy #{policyNumber}.",
        variables: ["claimNumber", "policyNumber"],
      },
      {
        name: "Lead Assigned Alert",
        type: NotificationType.LEAD_ASSIGNED,
        channel: "IN_APP",
        subject: "New Lead assigned to you",
        body: "Lead #{leadCode} has been assigned to you for contact review.",
        variables: ["leadCode"],
      },
    ];

    for (const t of templates) {
      await tx.notificationTemplate.upsert({
        where: { name: t.name },
        update: {},
        create: {
          name: t.name,
          type: t.type,
          channel: t.channel,
          subject: t.subject,
          body: t.body,
          variables: t.variables,
        },
      });
    }
    console.log("- Seeded standard notification templates.");

    // -------------------------------------------------------------------------
    // 7. SEED SYSTEM DEFAULT REPORTS
    // -------------------------------------------------------------------------
    const systemReports = [
      {
        name: "Lead Summary",
        code: "LEAD_SUMMARY",
        description: "Standard summary of CRM leads by stage and source",
        category: "CRM",
        module: "LEADS",
        type: "TABULAR",
        status: "ACTIVE",
        isSystem: true,
        shared: true,
        columns: [
          { field: "leadCode", label: "Lead Code", type: "STRING", order: 0 },
          { field: "contactName", label: "Contact Name", type: "STRING", order: 1 },
          { field: "status", label: "Status", type: "STRING", order: 2 },
          { field: "source", label: "Source", type: "STRING", order: 3 },
          { field: "createdAt", label: "Created At", type: "DATE", order: 4 },
        ],
        filters: [
          { field: "status", operator: "EQUALS", required: false },
        ],
      },
      {
        name: "Policy Expiry",
        code: "POLICY_EXPIRY",
        description: "Pipeline of policies expiring and pending renewals",
        category: "POLICY",
        module: "POLICIES",
        type: "TABULAR",
        status: "ACTIVE",
        isSystem: true,
        shared: true,
        columns: [
          { field: "policyNumber", label: "Policy Number", type: "STRING", order: 0 },
          { field: "contactName", label: "Customer Name", type: "STRING", order: 1 },
          { field: "insurerName", label: "Insurer", type: "STRING", order: 2 },
          { field: "premiumAmount", label: "Premium Amount", type: "NUMBER", order: 3 },
          { field: "expiryDate", label: "Expiry Date", type: "DATE", order: 4 },
        ],
        filters: [
          { field: "expiryDate", operator: "BETWEEN", required: false },
        ],
      },
      {
        name: "Revenue Report",
        code: "REVENUE_REPORT",
        description: "Overview of premium collections and payments",
        category: "FINANCE",
        module: "REPORTS",
        type: "TABULAR",
        status: "ACTIVE",
        isSystem: true,
        shared: true,
        columns: [
          { field: "policyNumber", label: "Policy Number", type: "STRING", order: 0 },
          { field: "insurerName", label: "Insurer Name", type: "STRING", order: 1 },
          { field: "premiumAmount", label: "Premium Amount", type: "NUMBER", order: 2 },
          { field: "paymentStatus", label: "Payment Status", type: "STRING", order: 3 },
          { field: "paymentDate", label: "Payment Date", type: "DATE", order: 4 },
        ],
        filters: [
          { field: "paymentDate", operator: "BETWEEN", required: false },
        ],
      },
      {
        name: "Claims Report",
        code: "CLAIMS_REPORT",
        description: "Registered claims status and aging overview",
        category: "CLAIMS",
        module: "CLAIMS",
        type: "TABULAR",
        status: "ACTIVE",
        isSystem: true,
        shared: true,
        columns: [
          { field: "claimNumber", label: "Claim Number", type: "STRING", order: 0 },
          { field: "policyNumber", label: "Policy Number", type: "STRING", order: 1 },
          { field: "claimAmount", label: "Claim Amount", type: "NUMBER", order: 2 },
          { field: "status", label: "Status", type: "STRING", order: 3 },
          { field: "reportedAt", label: "Reported At", type: "DATE", order: 4 },
        ],
        filters: [
          { field: "status", operator: "EQUALS", required: false },
        ],
      },
      {
        name: "Audit Logs",
        code: "AUDIT_LOGS",
        description: "Full security and access audit trail logs",
        category: "AUDIT",
        module: "REPORTS",
        type: "TABULAR",
        status: "ACTIVE",
        isSystem: true,
        shared: true,
        columns: [
          { field: "id", label: "Log ID", type: "STRING", order: 0 },
          { field: "action", label: "Action", type: "STRING", order: 1 },
          { field: "module", label: "Module", type: "STRING", order: 2 },
          { field: "createdAt", label: "Timestamp", type: "DATE", order: 3 },
        ],
        filters: [
          { field: "createdAt", operator: "BETWEEN", required: false },
        ],
      },
    ];

    for (const sr of systemReports) {
      const existingReport = await tx.report.findUnique({
        where: { code: sr.code },
      });

      if (!existingReport) {
        await tx.report.create({
          data: {
            name: sr.name,
            code: sr.code,
            description: sr.description,
            category: sr.category as any,
            module: sr.module as any,
            type: sr.type as any,
            status: sr.status as any,
            isSystem: sr.isSystem,
            shared: sr.shared,
            columns: {
              create: sr.columns,
            },
            filters: {
              create: sr.filters as any,
            },
          },
        });
      }
    }
    console.log("- Seeded system default reports.");

    // -------------------------------------------------------------------------
    // 8. SEED SYSTEM WORKFLOWS
    // -------------------------------------------------------------------------
    const existingWorkflow = await tx.workflow.findUnique({
      where: { code: "PROPOSAL_WORKFLOW" },
    });
    if (!existingWorkflow) {
      const workflow = await tx.workflow.create({
        data: {
          name: "Standard Proposal Workflow",
          code: "PROPOSAL_WORKFLOW",
          module: "PROPOSALS",
          isSystem: true,
        },
      });

      // Create States
      const states = [
        { code: "DRAFT", name: "Draft", isInitial: true, isTerminal: false },
        { code: "SUBMITTED", name: "Submitted", isInitial: false, isTerminal: false, slaMinutes: 1440 },
        { code: "UNDER_REVIEW", name: "Under Review", isInitial: false, isTerminal: false, slaMinutes: 2880 },
        { code: "APPROVED", name: "Approved", isInitial: false, isTerminal: true },
        { code: "REJECTED", name: "Rejected", isInitial: false, isTerminal: true },
      ];

      const seededStates: Record<string, any> = {};
      for (const state of states) {
        const dbState = await tx.workflowState.create({
          data: {
            workflowId: workflow.id,
            ...state,
          },
        });
        seededStates[state.code] = dbState;
      }

      // Create Transitions
      const transitions = [
        { name: "Submit Proposal", triggerType: "MANUAL", fromCode: "DRAFT", toCode: "SUBMITTED" },
        { name: "Start Review", triggerType: "MANUAL", fromCode: "SUBMITTED", toCode: "UNDER_REVIEW" },
        { name: "Approve Proposal", triggerType: "MANUAL", fromCode: "UNDER_REVIEW", toCode: "APPROVED", conditions: { logic: "AND", rules: [{ field: "premiumAmount", operator: "lte", value: 50000 }] } },
        { name: "Approve High Premium", triggerType: "MANUAL", fromCode: "UNDER_REVIEW", toCode: "APPROVED", conditions: { logic: "AND", rules: [{ field: "premiumAmount", operator: "gt", value: 50000 }] } },
        { name: "Reject Proposal", triggerType: "MANUAL", fromCode: "UNDER_REVIEW", toCode: "REJECTED" },
      ];

      for (const t of transitions) {
        const fromStateId = t.fromCode ? seededStates[t.fromCode].id : null;
        const toStateId = seededStates[t.toCode].id;
        const dbTrans = await tx.workflowTransition.create({
          data: {
            workflowId: workflow.id,
            name: t.name,
            triggerType: t.triggerType,
            fromStateId,
            toStateId,
            conditions: t.conditions ? (t.conditions as any) : undefined,
          },
        });

        // If High Premium, add assignment for Underwriter role
        if (t.fromCode === "UNDER_REVIEW" && t.toCode === "APPROVED" && t.name.includes("High Premium")) {
          const underwriterRole = seededRoles["UNDERWRITER"];
          if (underwriterRole) {
            await tx.workflowAssignment.create({
              data: {
                transitionId: dbTrans.id,
                roleId: underwriterRole.id,
                required: true,
                approvalType: "ANY",
              },
            });
          }
        }
      }
      console.log("- Seeded system default proposal workflow.");
    }
  });

  console.log("✅ Database seeded successfully.");
}

main()
  .catch((error) => {
    console.error("❌ Seed process failed:");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });