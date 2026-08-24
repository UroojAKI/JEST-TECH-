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
      // Enterprise Brokerage SOP Roles (SDP Volume 2)
      { name: "Managing Director & CEO", code: "MD_CEO", type: RoleType.MD_CEO, isSystem: true },
      { name: "Chief Finance Officer", code: "CHIEF_FINANCE_OFFICER", type: RoleType.CHIEF_FINANCE_OFFICER, isSystem: true },
      { name: "Sales Manager", code: "SALES_MANAGER", type: RoleType.SALES_MANAGER, isSystem: false },
      { name: "Sales Executive", code: "SALES_EXECUTIVE", type: RoleType.SALES_EXECUTIVE, isSystem: false },
      { name: "Policy Issuance Executive", code: "POLICY_ISSUANCE_EXECUTIVE", type: RoleType.POLICY_ISSUANCE_EXECUTIVE, isSystem: false },
      { name: "Renewal Executive", code: "RENEWAL_EXECUTIVE", type: RoleType.RENEWAL_EXECUTIVE, isSystem: false },
      { name: "Customer Service Executive", code: "CUSTOMER_SERVICE_EXECUTIVE", type: RoleType.CUSTOMER_SERVICE_EXECUTIVE, isSystem: false },
      { name: "Finance Accounts Executive", code: "FINANCE_ACCOUNTS_EXECUTIVE", type: RoleType.FINANCE_ACCOUNTS_EXECUTIVE, isSystem: false },
      { name: "System Administrator", code: "SYSTEM_ADMINISTRATOR", type: RoleType.SYSTEM_ADMINISTRATOR, isSystem: true },
      { name: "POSP Advisor", code: "POSP_ADVISOR", type: RoleType.POSP_ADVISOR, isSystem: false },
      { name: "Agent Manager", code: "AGENT_MANAGER", type: RoleType.AGENT_MANAGER, isSystem: false },
      { name: "Marketing Director", code: "MARKETING_DIRECTOR", type: RoleType.MARKETING_DIRECTOR, isSystem: false },
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
    // 4. SEED DEPARTMENTS & JOB ROLES & DASHBOARDS
    // -------------------------------------------------------------------------
    const departments = [
      { code: "EXEC", name: "Executive Office" },
      { code: "SALES", name: "Sales & Distribution" },
      { code: "RENEWAL", name: "Retention & Renewals" },
      { code: "AGENT", name: "Agent Management" },
      { code: "CUSTOMER", name: "Customer Service" },
      { code: "OPS", name: "Back Office Operations" },
      { code: "FINANCE", name: "Accounts & Finance" },
      { code: "MARKETING", name: "Marketing" },
      { code: "IT", name: "Technology & Admin" }
    ];

    const seededDepts: Record<string, any> = {};
    for (const d of departments) {
      seededDepts[d.code] = await tx.department.upsert({
        where: { code: d.code }, update: {}, create: d,
      });
    }

    const jobRoles = [
      { code: "CEO", name: "Managing Director", dept: "EXEC", role: "MD_CEO", dbCode: "executive-dashboard", wsCode: "executive", title: "Executive Strategy Command Center" },
      { code: "SM", name: "Sales Manager", dept: "SALES", role: "SALES_MANAGER", dbCode: "branch-dashboard", wsCode: "sales", title: "Branch Management Command Center" },
      { code: "AGENT", name: "POSP Advisor", dept: "SALES", role: "POSP_ADVISOR", dbCode: "sales-dashboard", wsCode: "sales", title: "POSP Advisor & Sales Workspace" },
      { code: "RENEWAL", name: "Renewal Executive", dept: "RENEWAL", role: "RENEWAL_EXECUTIVE", dbCode: "renewal-dashboard", wsCode: "renewal", title: "Renewals & Retention Workspace" },
      { code: "CRE", name: "Customer Relationship Executive", dept: "CUSTOMER", role: "CUSTOMER_SERVICE_EXECUTIVE", dbCode: "customer-dashboard", wsCode: "customer", title: "Customer Support & Service Workspace" },
      { code: "ARM", name: "Agent Relationship Manager", dept: "AGENT", role: "AGENT_MANAGER", dbCode: "agent-dashboard", wsCode: "agent", title: "Agent & POSP Management Workspace" },
      { code: "OPS", name: "Policy Issuance Executive", dept: "OPS", role: "POLICY_ISSUANCE_EXECUTIVE", dbCode: "operations-dashboard", wsCode: "operations", title: "Operations & Underwriting Workspace" },
      { code: "FIN", name: "Accounts Executive", dept: "FINANCE", role: "FINANCE_ACCOUNTS_EXECUTIVE", dbCode: "finance-dashboard", wsCode: "finance", title: "Finance & Accounting Workspace" },
      { code: "MKTG", name: "Marketing Executive", dept: "MARKETING", role: "MARKETING_DIRECTOR", dbCode: "marketing-dashboard", wsCode: "marketing", title: "Marketing & Campaigns Workspace" },
      { code: "ADMIN", name: "CRM Administrator", dept: "IT", role: "SYSTEM_ADMINISTRATOR", dbCode: "admin-dashboard", wsCode: "admin", title: "Administrator Command Center" }
    ];

    const seededJobRoles: Record<string, any> = {};
    for (const jr of jobRoles) {
      const dbJr = await tx.jobRole.upsert({
        where: { code: jr.code },
        update: {},
        create: {
          code: jr.code,
          name: jr.name,
          departmentId: seededDepts[jr.dept].id,
          defaultRoleType: jr.role as RoleType,
        },
      });
      seededJobRoles[jr.code] = dbJr;

      // Seed Dashboard Registry for this JobRole
      await tx.dashboardRegistry.upsert({
        where: { dashboardCode: jr.dbCode },
        update: { jobRoleId: dbJr.id, workspaceCode: jr.wsCode, title: jr.title },
        create: {
          jobRoleId: dbJr.id,
          dashboardCode: jr.dbCode,
          workspaceCode: jr.wsCode,
          title: jr.title,
          layout: [],
          navigation: [],
          widgets: [],
          quickActions: [],
          permissions: [],
        },
      });
    }

    // -------------------------------------------------------------------------
    // 5. SEED USERS FOR 10 ROLES
    // -------------------------------------------------------------------------
    const passwordHash = await argon2.hash("Password@123");
    
    const users = [
      { email: "md@jest.com", fn: "Executive", ln: "Managing Director", role: "MD_CEO", jr: "CEO" },
      { email: "sm@jest.com", fn: "Regional", ln: "Sales Manager", role: "SALES_MANAGER", jr: "SM" },
      { email: "agent@jest.com", fn: "Rajesh", ln: "Sharma", role: "POSP_ADVISOR", jr: "AGENT" },
      { email: "renewal@jest.com", fn: "Retention", ln: "Renewal Executive", role: "RENEWAL_EXECUTIVE", jr: "RENEWAL" },
      { email: "cre@jest.com", fn: "Support", ln: "Customer Exec", role: "CUSTOMER_SERVICE_EXECUTIVE", jr: "CRE" },
      { email: "arm@jest.com", fn: "Network", ln: "Agent Manager", role: "AGENT_MANAGER", jr: "ARM" },
      { backoffice: true, email: "backoffice@jest.com", fn: "Backend", ln: "Issuance Officer", role: "POLICY_ISSUANCE_EXECUTIVE", jr: "OPS" },
      { email: "accounts@jest.com", fn: "Priya", ln: "Finance", role: "FINANCE_ACCOUNTS_EXECUTIVE", jr: "FIN" },
      { email: "marketing@jest.com", fn: "Digital", ln: "Marketing", role: "MARKETING_DIRECTOR", jr: "MKTG" },
      { email: "admin@jest.com", fn: "System", ln: "Administrator", role: "SYSTEM_ADMINISTRATOR", jr: "ADMIN" }
    ];

    let empCounter = Math.floor(Date.now() / 1000);
    for (const u of users) {
      const r = seededRoles[u.role];
      if (r) {
        await tx.user.upsert({
          where: { email: u.email },
          update: { roleId: r.id, jobRoleId: seededJobRoles[u.jr].id, departmentId: seededJobRoles[u.jr].departmentId },
          create: {
            email: u.email,
            firstName: u.fn,
            lastName: u.ln,
            passwordHash,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            roleId: r.id,
            jobRoleId: seededJobRoles[u.jr].id,
            departmentId: seededJobRoles[u.jr].departmentId,
            employeeCode: `EMP-${String(empCounter++).padStart(6, '0')}`,
          }
        });
      }
    }
    console.log("- Seeded 10 organizational job roles, dashboards, and demo users.");

    // -------------------------------------------------------------------------
    // 5. SEED VEHICLE MASTER DATA
    // -------------------------------------------------------------------------
    const manufacturers = [
      { name: "Maruti Suzuki", code: "MSIL" },
      { name: "Hyundai Motors", code: "HYUN" },
      { name: "Honda Cars", code: "HOND" },
      { name: "Tata Motors EV", code: "TATA_EV" },
      { name: "Royal Enfield", code: "ROYAL_ENFIELD" },
      { name: "Ashok Leyland Commercial", code: "ASHOK_LEYLAND" },
    ];

    for (const m of manufacturers) {
      const dbMfg = await tx.vehicleManufacturer.upsert({
        where: { code: m.code },
        update: {},
        create: m,
      });

      // Add a default model for each mfg utilizing 8-Category Taxonomy
      if (m.code === "MSIL") {
        await tx.vehicleModel.upsert({
          where: { code: "SWIFT" },
          update: {},
          create: {
            name: "Swift Hatchback 1.2",
            code: "SWIFT",
            vehicleType: "FOUR_WHEELER" as any,
            manufacturerId: dbMfg.id,
          },
        });
      } else if (m.code === "HYUN") {
        await tx.vehicleModel.upsert({
          where: { code: "CRETA" },
          update: {},
          create: {
            name: "Creta SX Diesel",
            code: "CRETA",
            vehicleType: "FOUR_WHEELER" as any,
            manufacturerId: dbMfg.id,
          },
        });
      } else if (m.code === "TATA_EV") {
        await tx.vehicleModel.upsert({
          where: { code: "NEXON_EV" },
          update: {},
          create: {
            name: "Nexon EV Max",
            code: "NEXON_EV",
            vehicleType: "FOUR_WHEELER" as any,
            manufacturerId: dbMfg.id,
          },
        });
      } else if (m.code === "ROYAL_ENFIELD") {
        await tx.vehicleModel.upsert({
          where: { code: "CLASSIC_350" },
          update: {},
          create: {
            name: "Classic 350 Bullet",
            code: "CLASSIC_350",
            vehicleType: "TWO_WHEELER" as any,
            manufacturerId: dbMfg.id,
          },
        });
      } else if (m.code === "ASHOK_LEYLAND") {
        await tx.vehicleModel.upsert({
          where: { code: "DOST_PLUS" },
          update: {},
          create: {
            name: "Dost+ Commercial Truck",
            code: "DOST_PLUS",
            vehicleType: "COMMERCIAL_GCV" as any,
            manufacturerId: dbMfg.id,
          },
        });
      }
    }
    console.log("- Seeded master vehicle manufacturers & models across 8-category statutory taxonomy.");

    // -------------------------------------------------------------------------
    // 5.5. SEED DOCUMENT CHECKLIST ITEMS
    // -------------------------------------------------------------------------
    const checklistItems = [
      // BIKE
      { category: 'BIKE', documentName: 'Copy of Registration Certificate (RC)', isMandatory: true },
      { category: 'BIKE', documentName: 'Previous Policy Copy', isMandatory: false },
      { category: 'BIKE', documentName: 'Valid Driving License', isMandatory: true },
      { category: 'BIKE', documentName: 'Vehicle Inspection Report / Photographs', isMandatory: false, condition: 'break-in or SAOD cases' },
      { category: 'BIKE', documentName: 'KYC - PAN Card', isMandatory: true },
      { category: 'BIKE', documentName: 'KYC - Address Proof', isMandatory: true },
      { category: 'BIKE', documentName: 'Invoice & Form 21/22', isMandatory: false, condition: 'new vehicle' },
      // PRIVATE_CAR
      { category: 'PRIVATE_CAR', documentName: 'Copy of Registration Certificate (RC)', isMandatory: true },
      { category: 'PRIVATE_CAR', documentName: 'Previous Policy Copy', isMandatory: false },
      { category: 'PRIVATE_CAR', documentName: 'Valid Driving License', isMandatory: true },
      { category: 'PRIVATE_CAR', documentName: 'Vehicle Inspection Report / Photographs', isMandatory: false, condition: 'break-in or SAOD cases' },
      { category: 'PRIVATE_CAR', documentName: 'KYC - PAN Card', isMandatory: true },
      { category: 'PRIVATE_CAR', documentName: 'KYC - Address Proof', isMandatory: true },
      { category: 'PRIVATE_CAR', documentName: 'Invoice & Form 21/22', isMandatory: false, condition: 'new vehicle' },
      { category: 'PRIVATE_CAR', documentName: 'Hypothecation / NOC Letter', isMandatory: false, condition: 'if vehicle is financed' },
      // GCV
      { category: 'GCV', documentName: 'Copy of Registration Certificate (RC)', isMandatory: true },
      { category: 'GCV', documentName: 'Previous Policy Copy', isMandatory: false },
      { category: 'GCV', documentName: 'Valid Driving License', isMandatory: true },
      { category: 'GCV', documentName: 'Vehicle Inspection Report / Photographs', isMandatory: false, condition: 'break-in or SAOD cases' },
      { category: 'GCV', documentName: 'KYC - PAN Card', isMandatory: true },
      { category: 'GCV', documentName: 'KYC - Address Proof', isMandatory: true },
      { category: 'GCV', documentName: 'Route Permit Copy', isMandatory: true },
      { category: 'GCV', documentName: 'Fitness Certificate', isMandatory: true },
      { category: 'GCV', documentName: 'National Permit', isMandatory: false, condition: 'if applicable' },
      { category: 'GCV', documentName: 'Pollution Under Control (PUC) Certificate', isMandatory: true },
      { category: 'GCV', documentName: 'Goods Carrying Permit', isMandatory: true },
      // TRACTOR
      { category: 'TRACTOR', documentName: 'Copy of Registration Certificate (RC)', isMandatory: true },
      { category: 'TRACTOR', documentName: 'Previous Policy Copy', isMandatory: false },
      { category: 'TRACTOR', documentName: 'Valid Driving License', isMandatory: true },
      { category: 'TRACTOR', documentName: 'Vehicle Inspection Report / Photographs', isMandatory: false, condition: 'break-in or SAOD cases' },
      { category: 'TRACTOR', documentName: 'KYC - PAN Card', isMandatory: true },
      { category: 'TRACTOR', documentName: 'KYC - Address Proof', isMandatory: true },
      { category: 'TRACTOR', documentName: 'Agricultural Usage Certificate', isMandatory: false, condition: 'if claiming agri tariff' },
      // AUTO
      { category: 'AUTO', documentName: 'Copy of Registration Certificate (RC)', isMandatory: true },
      { category: 'AUTO', documentName: 'Previous Policy Copy', isMandatory: false },
      { category: 'AUTO', documentName: 'Valid Driving License', isMandatory: true },
      { category: 'AUTO', documentName: 'Vehicle Inspection Report / Photographs', isMandatory: false, condition: 'break-in or SAOD cases' },
      { category: 'AUTO', documentName: 'KYC - PAN Card', isMandatory: true },
      { category: 'AUTO', documentName: 'KYC - Address Proof', isMandatory: true },
      { category: 'AUTO', documentName: 'Permit Copy', isMandatory: true },
      { category: 'AUTO', documentName: 'Pollution Under Control (PUC) Certificate', isMandatory: true },
      // TAXI
      { category: 'TAXI', documentName: 'Copy of Registration Certificate (RC)', isMandatory: true },
      { category: 'TAXI', documentName: 'Previous Policy Copy', isMandatory: false },
      { category: 'TAXI', documentName: 'Valid Driving License', isMandatory: true },
      { category: 'TAXI', documentName: 'Vehicle Inspection Report / Photographs', isMandatory: false, condition: 'break-in or SAOD cases' },
      { category: 'TAXI', documentName: 'KYC - PAN Card', isMandatory: true },
      { category: 'TAXI', documentName: 'KYC - Address Proof', isMandatory: true },
      { category: 'TAXI', documentName: 'Permit Copy (Contract Carriage / Tourist)', isMandatory: true },
      { category: 'TAXI', documentName: 'Aggregator Agreement', isMandatory: false, condition: 'if applicable' },
      { category: 'TAXI', documentName: 'Pollution Under Control (PUC) Certificate', isMandatory: true },
      { category: 'TAXI', documentName: 'Commercial (Badge) Driving License', isMandatory: true },
      // BUS_COACH
      { category: 'BUS_COACH', documentName: 'Copy of Registration Certificate (RC)', isMandatory: true },
      { category: 'BUS_COACH', documentName: 'Previous Policy Copy', isMandatory: false },
      { category: 'BUS_COACH', documentName: 'Valid Driving License', isMandatory: true },
      { category: 'BUS_COACH', documentName: 'Vehicle Inspection Report / Photographs', isMandatory: false, condition: 'break-in or SAOD cases' },
      { category: 'BUS_COACH', documentName: 'KYC - PAN Card', isMandatory: true },
      { category: 'BUS_COACH', documentName: 'KYC - Address Proof', isMandatory: true },
      { category: 'BUS_COACH', documentName: 'Route Permit Copy', isMandatory: true },
      { category: 'BUS_COACH', documentName: 'Fitness Certificate', isMandatory: true },
      { category: 'BUS_COACH', documentName: 'School Bus Compliance Certificate', isMandatory: false, condition: 'mandatory for school bus subtype' },
      { category: 'BUS_COACH', documentName: 'Pollution Under Control (PUC) Certificate', isMandatory: true },
      // MISC_CLASS_D
      { category: 'MISC_CLASS_D', documentName: 'Copy of Registration Certificate (RC)', isMandatory: true },
      { category: 'MISC_CLASS_D', documentName: 'Previous Policy Copy', isMandatory: false },
      { category: 'MISC_CLASS_D', documentName: 'Valid Driving License', isMandatory: true },
      { category: 'MISC_CLASS_D', documentName: 'Vehicle Inspection Report / Photographs', isMandatory: false, condition: 'break-in or SAOD cases' },
      { category: 'MISC_CLASS_D', documentName: 'KYC - PAN Card', isMandatory: true },
      { category: 'MISC_CLASS_D', documentName: 'KYC - Address Proof', isMandatory: true },
      { category: 'MISC_CLASS_D', documentName: 'Purpose-Specific Operating Certification', isMandatory: true },
      { category: 'MISC_CLASS_D', documentName: 'Fitness Certificate', isMandatory: true },
    ];

    // DocumentChecklistItem has no unique constraint on (category, documentName),
    // so use createMany with skipDuplicates to safely re-run the seed.
    await tx.documentChecklistItem.createMany({
      data: checklistItems.map((item) => ({
        category: item.category as any,
        documentName: item.documentName,
        isMandatory: item.isMandatory,
        condition: (item as any).condition ?? null,
      })),
      skipDuplicates: true,
    });
    console.log(`✅ DocumentChecklistItem seeded: ${checklistItems.length} items across 8 vehicle categories`);

    // ── Renewal Configuration ─────────────────────────────────────────────────
    const existingRenewalConfig = await tx.renewalConfiguration.findFirst({
      where: { isActive: true },
    });
    if (!existingRenewalConfig) {
      await tx.renewalConfiguration.create({
        data: {
          name: 'Default Motor Renewal Configuration',
          policyType: 'MOTOR',
          vehicleCategory: null,
          lookAheadDays: 60,
          reminderOffsets: [30, 7, 1],
          escalationDays: 3,
          isActive: true,
        },
      });
    }
    console.log('✅ RenewalConfiguration seeded');

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