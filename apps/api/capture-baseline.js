const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('./node_modules/@prisma/client');
const prisma = new PrismaClient();

async function createBaselineSnapshot() {
  console.log('=== Capturing JEST Policy CRM Baseline Data Snapshot ===');
  
  const snapshotDir = path.resolve(__dirname, 'prisma/snapshots');
  if (!fs.existsSync(snapshotDir)) {
    fs.mkdirSync(snapshotDir, { recursive: true });
  }

  const [
    users,
    contacts,
    leads,
    vehicles,
    quotations,
    quotationVersions,
    policies,
    claims,
    renewals,
    inspections,
    workflowAssignments,
    queueMembers
  ] = await Promise.all([
    prisma.user.findMany({
      include: { role: true, branch: true }
    }),
    prisma.contact.findMany({
      include: { branch: true }
    }),
    prisma.lead.findMany({
      include: { assignedTo: true, contact: true }
    }),
    prisma.vehicle.findMany(),
    prisma.quotation.findMany({
      include: { versions: true }
    }),
    prisma.quotationVersion.findMany(),
    prisma.policy.findMany({
      include: { contact: true, createdBy: true }
    }),
    prisma.claim.findMany({
      include: { policy: true, histories: true }
    }),
    prisma.renewalTask.findMany({
      include: { policy: true }
    }),
    prisma.motorInspection.findMany(),
    prisma.workflowAssignment.findMany(),
    prisma.queueMember.findMany()
  ]);

  const agents = users.filter(u => u.role?.code === 'AGENT');
  const backOfficeUsers = users.filter(u => u.role?.code === 'BACK_OFFICE');
  const adminUsers = users.filter(u => u.role?.code === 'ADMIN');

  const snapshot = {
    metadata: {
      generatedAt: new Date().toISOString(),
      gitBranch: 'feature/motor-crm-rearchitecture',
      version: '1.0.0',
      description: 'Phase 0 Baseline Data Snapshot before Motor CRM Domain Rearchitecture'
    },
    counts: {
      totalUsers: users.length,
      agents: agents.length,
      backOfficeUsers: backOfficeUsers.length,
      adminUsers: adminUsers.length,
      contacts: contacts.length,
      leads: leads.length,
      vehicles: vehicles.length,
      quotations: quotations.length,
      quotationVersions: quotationVersions.length,
      policies: policies.length,
      claims: claims.length,
      renewals: renewals.length,
      inspections: inspections.length,
      workflowAssignments: workflowAssignments.length,
      queueMembers: queueMembers.length
    },
    data: {
      agents: agents.map(a => ({
        id: a.id,
        email: a.email,
        firstName: a.firstName,
        lastName: a.lastName,
        employeeCode: a.employeeCode,
        branchId: a.branchId,
        branchName: a.branch?.name,
        status: a.status
      })),
      contacts: contacts.map(c => ({
        id: c.id,
        contactCode: c.contactCode,
        firstName: c.firstName,
        lastName: c.lastName,
        phone: c.phone,
        email: c.email,
        type: c.type,
        status: c.status,
        branchId: c.branchId,
        agentCode: c.agentCode,
        createdAt: c.createdAt
      })),
      leads: leads.map(l => ({
        id: l.id,
        leadCode: l.leadCode,
        firstName: l.firstName,
        lastName: l.lastName,
        phone: l.phone,
        email: l.email,
        status: l.status,
        contactId: l.contactId,
        assignedAgentId: l.assignedAgentId,
        assignedAgentName: l.assignedAgentName,
        expectedPremium: l.expectedPremium,
        productInterest: l.productInterest,
        createdAt: l.createdAt
      })),
      vehicles: vehicles.map(v => ({
        id: v.id,
        registrationNumber: v.registrationNumber,
        make: v.make,
        model: v.model,
        variant: v.variant,
        year: v.year,
        fuelType: v.fuelType,
        policyId: v.policyId
      })),
      quotations: quotations.map(q => ({
        id: q.id,
        quotationNumber: q.quotationNumber,
        contactId: q.contactId,
        leadId: q.leadId,
        status: q.status,
        createdAt: q.createdAt,
        versionsCount: q.versions?.length || 0
      })),
      policies: policies.map(p => ({
        id: p.id,
        policyNumber: p.policyNumber,
        contactId: p.contactId,
        agentId: p.agentId,
        agentCode: p.agentCode,
        status: p.status,
        totalPremium: p.totalPremium,
        policyType: p.policyType,
        policyStartDate: p.policyStartDate,
        policyEndDate: p.policyEndDate,
        createdAt: p.createdAt
      })),
      claims: claims.map(c => ({
        id: c.id,
        claimNumber: c.claimNumber,
        policyId: c.policyId,
        status: c.status,
        estimatedLoss: c.estimatedLoss,
        claimType: c.claimType,
        createdAt: c.createdAt
      })),
      renewals: renewals.map(r => ({
        id: r.id,
        policyId: r.policyId,
        status: r.status,
        dueDate: r.dueDate,
        assignedToId: r.assignedToId
      })),
      inspections: inspections.map(i => ({
        id: i.id,
        vehicleId: i.vehicleId,
        leadId: i.leadId,
        status: i.status,
        conductedBy: i.conductedBy,
        createdAt: i.createdAt
      }))
    }
  };

  const snapshotFile = path.join(snapshotDir, 'baseline-snapshot.json');
  fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2), 'utf-8');
  console.log(`✅ Baseline snapshot written successfully to: ${snapshotFile}`);
  console.log('Summary of baseline counts:', JSON.stringify(snapshot.counts, null, 2));

  // Also write a markdown summary for developers and auditors
  const summaryMarkdown = `# JEST Policy CRM — Phase 0 Baseline Data Snapshot

**Captured At:** ${snapshot.metadata.generatedAt}
**Branch:** \`${snapshot.metadata.gitBranch}\`
**Database:** PostgreSQL (Production / Development instance)

---

## Entity Counts Summary

| Domain Entity | Baseline Count | Migration Target | Notes |
| :--- | :---: | :--- | :--- |
| **Total Users** | **${snapshot.counts.totalUsers}** | System Users | All roles included |
| **Agents** | **${snapshot.counts.agents}** | First-class \`Agent\` model | Will link to \`User\` via \`userId\` with unique \`agentCode\` |
| **Back Office Users** | **${snapshot.counts.backOfficeUsers}** | Operational Queue | Tasks will be assigned to these users |
| **Admin Users** | **${snapshot.counts.adminUsers}** | System Administrators | Unrestricted governance |
| **Contacts** | **${snapshot.counts.contacts}** | \`Customer\` permanent model | Deduplication shifted to signals, identity to Customer ID |
| **Leads** | **${snapshot.counts.leads}** | \`Lead\` opportunity model | Linked to \`customerId\` & \`agentId\` with strict state transitions |
| **Vehicles** | **${snapshot.counts.vehicles}** | \`Vehicle\` 8-category domain | Normalized registration numbers (uppercase, trimmed) |
| **Quotations** | **${snapshot.counts.quotations}** | \`MotorQuotation\` engine | Multiple quotes per vehicle, snapshot of agent code |
| **Policies** | **${snapshot.counts.policies}** | \`Policy\` lifecycle | Derived from post-payment completed quotation |
| **Claims** | **${snapshot.counts.claims}** | Enforceable Claim FSM | Full state transition audit logging |
| **Renewals** | **${snapshot.counts.renewals}** | \`RenewalSchedule\` & Tasks | Policy → Renewal Schedule → Task → Quote |
| **Inspections** | **${snapshot.counts.inspections}** | \`Inspection\` domain | 7-photo evidence, break-in/SAOD triggers |
| **Workflow Assignments** | **${snapshot.counts.workflowAssignments}** | \`BackOfficeTask\` | Queue-oriented operational tasks |

---

## Agent Registry at Snapshot

${snapshot.data.agents.map(a => `- **${a.firstName} ${a.lastName}** (${a.email}): Employee Code \`${a.employeeCode || 'PENDING'}\`, Branch: ${a.branchName || 'Unassigned'}`).join('\n')}

---

## Next Steps

1. Review and approve the detailed 20-Epic Implementation Plan.
2. Proceed to **EPIC 01 — Domain/Data Rearchitecture** (Prisma Schema expansion for \`Agent\`, \`Customer\`, \`Vehicle\`, \`MotorQuotation\`, etc.).
`;

  const summaryFile = path.join(snapshotDir, 'baseline-summary.md');
  fs.writeFileSync(summaryFile, summaryMarkdown, 'utf-8');
  console.log(`✅ Baseline summary markdown written to: ${summaryFile}`);
}

createBaselineSnapshot()
  .catch(err => {
    console.error('Error creating baseline snapshot:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
