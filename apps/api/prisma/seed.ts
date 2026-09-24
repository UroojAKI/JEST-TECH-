import { PrismaClient, PermissionCategory, RoleType, AccessScope, NotificationType, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PRODUCTION_SEED) {
    throw new Error('FATAL: Seed execution prohibited in production environment (AUTH-004).');
  }

  console.log("🌱 Starting atomic database seeding...");

  await prisma.$transaction(async (tx) => {
    // -------------------------------------------------------------------------
    // 1. SEED CANONICAL ROLES (Exactly 3 CRM Application Roles)
    // -------------------------------------------------------------------------
    const roles = [
      { name: "Administrator", code: "ADMIN", type: RoleType.ADMIN, description: "Unrestricted administration and system governance", isSystem: true, isActive: true },
      { name: "Back Office Operations", code: "BACK_OFFICE", type: RoleType.BACK_OFFICE, description: "Organization operations, underwriting, claims, finance, renewals", isSystem: true, isActive: true },
      { name: "Insurance Agent", code: "AGENT", type: RoleType.AGENT, description: "Customer-facing sales, lead acquisition, and field work", isSystem: true, isActive: true },
    ];

    const seededRoles: Record<string, any> = {};
    for (const r of roles) {
      const dbRole = await tx.role.upsert({
        where: { code: r.code },
        update: { name: r.name, description: r.description, isSystem: r.isSystem, isActive: r.isActive },
        create: r,
      });
      seededRoles[r.code] = dbRole;
    }
    console.log(`- Seeded ${roles.length} canonical roles (ADMIN, BACK_OFFICE, AGENT).`);

    // -------------------------------------------------------------------------
    // 2. SEED AUTHORITATIVE CANONICAL PERMISSIONS (56 Permissions)
    // -------------------------------------------------------------------------
    const permissions: Array<[string, string, PermissionCategory]> = [
      ["Read Leads", "lead:read", PermissionCategory.LEAD],
      ["Create Leads", "lead:create", PermissionCategory.LEAD],
      ["Update Leads", "lead:update", PermissionCategory.LEAD],
      ["Delete Leads", "lead:delete", PermissionCategory.LEAD],
      ["Assign Leads", "lead:assign", PermissionCategory.LEAD],
      ["Merge Leads", "lead:merge", PermissionCategory.LEAD],
      ["Export Leads", "lead:export", PermissionCategory.LEAD],

      ["Read Contacts", "contact:read", PermissionCategory.CONTACT],
      ["Create Contacts", "contact:create", PermissionCategory.CONTACT],
      ["Update Contacts", "contact:update", PermissionCategory.CONTACT],
      ["Delete Contacts", "contact:delete", PermissionCategory.CONTACT],
      ["Export Contacts", "contact:export", PermissionCategory.CONTACT],

      ["Read Opportunities", "opportunity:read", PermissionCategory.LEAD],
      ["Create Opportunities", "opportunity:create", PermissionCategory.LEAD],
      ["Update Opportunities", "opportunity:update", PermissionCategory.LEAD],
      ["Manage Opportunity Pipeline", "opportunity:pipeline", PermissionCategory.LEAD],

      ["Read Quotations", "quotation:read", PermissionCategory.QUOTATION],
      ["Create Quotations", "quotation:create", PermissionCategory.QUOTATION],
      ["Update Quotations", "quotation:update", PermissionCategory.QUOTATION],
      ["Approve Quotations", "quotation:approve", PermissionCategory.QUOTATION],
      ["Reject Quotations", "quotation:reject", PermissionCategory.QUOTATION],
      ["Export Quotations", "quotation:export", PermissionCategory.QUOTATION],

      ["Read Policies", "policy:read", PermissionCategory.POLICY],
      ["Create Policies", "policy:create", PermissionCategory.POLICY],
      ["Update Policies", "policy:update", PermissionCategory.POLICY],
      ["Issue Policies", "policy:issue", PermissionCategory.POLICY],
      ["Cancel Policies", "policy:cancel", PermissionCategory.POLICY],
      ["Export Policies", "policy:export", PermissionCategory.POLICY],

      ["Read Claims", "claim:read", PermissionCategory.CLAIM],
      ["Create Claims", "claim:create", PermissionCategory.CLAIM],
      ["Update Claims", "claim:update", PermissionCategory.CLAIM],
      ["Approve Claims", "claim:approve", PermissionCategory.CLAIM],
      ["Reject Claims", "claim:reject", PermissionCategory.CLAIM],
      ["Settle Claims", "claim:settle", PermissionCategory.CLAIM],
      ["Export Claims", "claim:export", PermissionCategory.CLAIM],

      ["Read Renewals", "renewal:read", PermissionCategory.POLICY],
      ["Update Renewals", "renewal:update", PermissionCategory.POLICY],
      ["Process Renewals", "renewal:process", PermissionCategory.POLICY],
      ["Export Renewals", "renewal:export", PermissionCategory.POLICY],

      ["Read Documents", "document:read", PermissionCategory.DOCUMENT],
      ["Upload Documents", "document:upload", PermissionCategory.DOCUMENT],
      ["Delete Documents", "document:delete", PermissionCategory.DOCUMENT],

      ["Read Commissions", "commission:read", PermissionCategory.ACCOUNT],
      ["Process Commissions", "commission:process", PermissionCategory.ACCOUNT],
      ["Configure Commissions", "commission:configure", PermissionCategory.ACCOUNT],
      ["Export Commissions", "commission:export", PermissionCategory.ACCOUNT],

      ["Read Reports", "report:read", PermissionCategory.REPORT],
      ["Create Reports", "report:create", PermissionCategory.REPORT],
      ["Export Reports", "report:export", PermissionCategory.REPORT],

      ["Read Users", "user:read", PermissionCategory.USER],
      ["Create Users", "user:create", PermissionCategory.USER],
      ["Update Users", "user:update", PermissionCategory.USER],
      ["Delete Users", "user:delete", PermissionCategory.USER],
      ["Deactivate Users", "user:deactivate", PermissionCategory.USER],

      ["Manage System Settings", "system:manage", PermissionCategory.SYSTEM],
      ["Read Audit Logs", "audit:read", PermissionCategory.SYSTEM],
    ];

    const seededPermissions: any[] = [];
    for (const p of permissions) {
      const dbPerm = await tx.permission.upsert({
        where: { code: p[1] },
        update: {
          name: p[0],
          category: p[2],
        },
        create: {
          name: p[0],
          code: p[1],
          category: p[2],
        },
      });
      seededPermissions.push(dbPerm);
    }
    console.log(`- Seeded ${permissions.length} canonical permissions.`);

    // -------------------------------------------------------------------------
    // 3. MAP PERMISSIONS TO ROLES WITH EXPLICIT SCOPES
    // -------------------------------------------------------------------------
    await tx.rolePermission.deleteMany({});

    // ADMIN: All 56 permissions with ALL scope
    const adminRole = seededRoles["ADMIN"];
    for (const permObj of seededPermissions) {
      await tx.rolePermission.create({
        data: {
          roleId: adminRole.id,
          permissionId: permObj.id,
          scope: AccessScope.ALL,
        },
      });
    }

    // BACK_OFFICE: Operational permissions with ORGANIZATION scope
    // Excludes user management, system:manage, audit:read, commission:configure, and lead:delete
    const boRole = seededRoles["BACK_OFFICE"];
    const boExcluded = new Set([
      "user:create", "user:delete", "user:deactivate",
      "system:manage", "audit:read", "commission:configure",
      "lead:delete",
    ]);
    for (const permObj of seededPermissions) {
      if (!boExcluded.has(permObj.code)) {
        await tx.rolePermission.create({
          data: {
            roleId: boRole.id,
            permissionId: permObj.id,
            scope: AccessScope.ORGANIZATION,
          },
        });
      }
    }

    // AGENT: Field sales with OWN and ASSIGNED scopes
    const agentRole = seededRoles["AGENT"];
    const agentOwnCodes = new Set([
      "lead:read", "lead:create", "lead:update",
      "opportunity:read", "opportunity:create", "opportunity:update",
      "renewal:read", "renewal:update",
      "contact:read", "contact:create", "contact:update",
      "quotation:read", "quotation:create", "quotation:update",
      "policy:read", "policy:create", "policy:update",
      "claim:read", "claim:create",
      "document:read", "document:upload",
      "commission:read",
    ]);
    const agentAssignedCodes = new Set([
      "lead:read", "lead:update",
      "opportunity:read", "opportunity:update",
      "renewal:read", "renewal:update",
    ]);

    for (const permObj of seededPermissions) {
      if (agentOwnCodes.has(permObj.code)) {
        await tx.rolePermission.create({
          data: {
            roleId: agentRole.id,
            permissionId: permObj.id,
            scope: AccessScope.OWN,
          },
        });
      }
      if (agentAssignedCodes.has(permObj.code)) {
        await tx.rolePermission.create({
          data: {
            roleId: agentRole.id,
            permissionId: permObj.id,
            scope: AccessScope.ASSIGNED,
          },
        });
      }
    }
    console.log("- Mapped canonical permissions and scopes to ADMIN, BACK_OFFICE, and AGENT.");

    // -------------------------------------------------------------------------
    // 4. SEED DEPARTMENTS & JOB ROLES & CANONICAL DASHBOARDS
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
      { code: "CEO", name: "Managing Director", dept: "EXEC" },
      { code: "SM", name: "Sales Manager", dept: "SALES" },
      { code: "AGENT", name: "POSP Advisor", dept: "SALES" },
      { code: "RENEWAL", name: "Renewal Executive", dept: "RENEWAL" },
      { code: "CRE", name: "Customer Relationship Executive", dept: "CUSTOMER" },
      { code: "ARM", name: "Agent Relationship Manager", dept: "AGENT" },
      { code: "OPS", name: "Policy Issuance Executive", dept: "OPS" },
      { code: "FIN", name: "Accounts Executive", dept: "FINANCE" },
      { code: "MKTG", name: "Marketing Executive", dept: "MARKETING" },
      { code: "ADMIN", name: "CRM Administrator", dept: "IT" }
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
        },
      });
      seededJobRoles[jr.code] = dbJr;
    }

    // Seed exactly 3 Canonical Dashboard Registries mapped by roleId
    await tx.dashboardRegistry.deleteMany({});
    await tx.dashboardRegistry.createMany({
      data: [
        {
          roleId: adminRole.id,
          dashboardCode: "admin-dashboard",
          workspaceCode: "admin",
          title: "Administrator Command Center",
          subtitle: "Executive and administrative oversight",
          layout: [],
          navigation: [],
          widgets: [],
          quickActions: [],
          permissions: ["system:manage", "user:read", "audit:read"],
        },
        {
          roleId: boRole.id,
          dashboardCode: "back-office-dashboard",
          workspaceCode: "operations",
          title: "Operations & Processing Workspace",
          subtitle: "Policy issuance, underwriting, claims, finance, and renewals",
          layout: [],
          navigation: [],
          widgets: [],
          quickActions: [],
          permissions: ["policy:read", "claim:read", "lead:assign", "quotation:approve"],
        },
        {
          roleId: agentRole.id,
          dashboardCode: "agent-dashboard",
          workspaceCode: "sales",
          title: "Agent Sales Workspace",
          subtitle: "Customer acquisition, quotations, and active policy portfolio",
          layout: [],
          navigation: [],
          widgets: [],
          quickActions: [],
          permissions: ["lead:read", "lead:create", "quotation:create", "policy:read"],
        },
      ],
    });
    console.log("- Seeded 10 organizational job roles and 3 canonical dashboard registries.");

    // -------------------------------------------------------------------------
    // 4b. SEED COMPANY, REGION, ZONE, AND BRANCHES
    // -------------------------------------------------------------------------
    const company = await tx.company.upsert({
      where: { code: "JEST_INDIA" },
      update: {},
      create: {
        code: "JEST_INDIA",
        name: "JEST Insurance Brokers Pvt Ltd",
        isActive: true,
      },
    });

    const region = await tx.region.upsert({
      where: { code: "WEST" },
      update: {},
      create: {
        code: "WEST",
        name: "Western Region",
        companyId: company.id,
        isActive: true,
      },
    });

    const zone = await tx.zone.upsert({
      where: { code: "MAH" },
      update: {},
      create: {
        code: "MAH",
        name: "Maharashtra Zone",
        regionId: region.id,
        isActive: true,
      },
    });

    const branchBkc = await tx.branch.upsert({
      where: { code: "GG-CHK" },
      update: {
        name: "Global Guru Chickodi",
        city: "Chickodi",
        state: "Karnataka",
        isActive: true,
      },
      create: {
        code: "GG-CHK",
        name: "Global Guru Chickodi",
        city: "Chickodi",
        state: "Karnataka",
        zoneId: zone.id,
        isActive: true,
      },
    });

    await tx.branch.upsert({
      where: { code: "PUN-SHV" },
      update: { isActive: false },
      create: {
        code: "PUN-SHV",
        name: "Pune Shivajinagar Branch",
        city: "Pune",
        state: "Maharashtra",
        zoneId: zone.id,
        isActive: false,
      },
    });

    await tx.branch.upsert({
      where: { code: "BLR-IND" },
      update: { isActive: false },
      create: {
        code: "BLR-IND",
        name: "Bengaluru Indiranagar Branch",
        city: "Bengaluru",
        state: "Karnataka",
        zoneId: zone.id,
        isActive: false,
      },
    });

    await tx.branch.upsert({
      where: { code: "DEL-CP" },
      update: { isActive: false },
      create: {
        code: "DEL-CP",
        name: "Delhi Connaught Place Branch",
        city: "New Delhi",
        state: "Delhi",
        zoneId: zone.id,
        isActive: false,
      },
    });

    // -------------------------------------------------------------------------
    // 5. SEED USERS FOR CANONICAL PERSONAS
    // -------------------------------------------------------------------------
    const passwordHash = await argon2.hash("Password@123");
    
    const users = [
      { email: "superadmin@jest.com", fn: "Super", ln: "Administrator", role: "ADMIN", jr: "ADMIN" },
      { email: "admin@jest.com", fn: "System", ln: "Administrator", role: "ADMIN", jr: "ADMIN" },
      { email: "manager@jest.com", fn: "Sunil", ln: "Verma", role: "BACK_OFFICE", jr: "SM" },
      { email: "agent@jest.com", fn: "Rajesh", ln: "Sharma", role: "AGENT", jr: "AGENT" },
      { email: "underwriter@jest.com", fn: "Anjali", ln: "Deshmukh", role: "BACK_OFFICE", jr: "OPS" },
      { email: "claims@jest.com", fn: "Vikram", ln: "Mehta", role: "BACK_OFFICE", jr: "CRE" },
      { email: "finance@jest.com", fn: "Priya", ln: "Nair", role: "BACK_OFFICE", jr: "FIN" },
      { email: "md@jest.com", fn: "Executive", ln: "Managing Director", role: "ADMIN", jr: "CEO" },
      { email: "sm@jest.com", fn: "Regional", ln: "Sales Manager", role: "BACK_OFFICE", jr: "SM" },
      { email: "renewal@jest.com", fn: "Retention", ln: "Renewal Executive", role: "BACK_OFFICE", jr: "RENEWAL" },
      { email: "cre@jest.com", fn: "Support", ln: "Customer Exec", role: "BACK_OFFICE", jr: "CRE" },
      { email: "arm@jest.com", fn: "Network", ln: "Agent Manager", role: "BACK_OFFICE", jr: "ARM" },
      { backoffice: true, email: "backoffice@jest.com", fn: "Backend", ln: "Issuance Officer", role: "BACK_OFFICE", jr: "OPS" },
      { email: "accounts@jest.com", fn: "Priya", ln: "Finance", role: "BACK_OFFICE", jr: "FIN" },
      { email: "marketing@jest.com", fn: "Digital", ln: "Marketing", role: "BACK_OFFICE", jr: "MKTG" }
    ];

    let empCounter = Math.floor(Date.now() / 1000);
    for (const u of users) {
      const r = seededRoles[u.role];
      if (r) {
        await tx.user.upsert({
          where: { email: u.email },
          update: { 
            passwordHash,
            status: UserStatus.ACTIVE,
            roleId: r.id, 
            companyId: company.id,
            jobRoleId: seededJobRoles[u.jr].id, 
            departmentId: seededJobRoles[u.jr].departmentId,
            branchId: branchBkc.id,
          },
          create: {
            email: u.email,
            firstName: u.fn,
            lastName: u.ln,
            passwordHash,
            status: UserStatus.ACTIVE,
            isEmailVerified: true,
            roleId: r.id,
            companyId: company.id,
            jobRoleId: seededJobRoles[u.jr].id,
            departmentId: seededJobRoles[u.jr].departmentId,
            branchId: branchBkc.id,
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

        // If High Premium, add assignment for Back Office role
        if (t.fromCode === "UNDER_REVIEW" && t.toCode === "APPROVED" && t.name.includes("High Premium")) {
          const boRole = seededRoles["BACK_OFFICE"];
          if (boRole) {
            await tx.workflowAssignment.create({
              data: {
                transitionId: dbTrans.id,
                roleId: boRole.id,
                required: true,
                approvalType: "ANY",
              },
            });
          }
        }
      }
      console.log("- Seeded system default proposal workflow.");
    }
  }, { timeout: 30000 });
  
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