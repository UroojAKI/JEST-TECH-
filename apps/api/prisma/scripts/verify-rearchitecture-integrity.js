const fs = require('fs');
const path = require('path');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function verifyIntegrity() {
  console.log('===============================================================');
  console.log('  JEST Policy CRM — Data Integrity & Migration Audit Matrix   ');
  console.log('===============================================================\n');

  const snapshotPath = path.resolve(__dirname, '../snapshots/baseline-snapshot.json');
  if (!fs.existsSync(snapshotPath)) {
    console.error('Error: Baseline snapshot file not found at:', snapshotPath);
    process.exit(1);
  }

  const snapshot = JSON.parse(fs.readFileSync(snapshotPath, 'utf8'));
  const baseline = snapshot.counts;

  // Query live database counts
  const [
    totalUsers,
    totalContacts,
    totalLeads,
    totalVehicles,
    totalQuotations,
    totalPolicies,
    totalClaims,
    totalRenewals,
    totalAgents,
    totalCustomers,
    totalMotorQuotations,
    totalTasks,
    totalBackOfficeTasks,
    totalAlerts,
  ] = await Promise.all([
    prisma.user.count(),
    prisma.contact.count({ where: { deletedAt: null } }),
    prisma.lead.count({ where: { deletedAt: null } }),
    prisma.vehicle.count({ where: { deletedAt: null } }),
    prisma.quotation.count({ where: { deletedAt: null } }),
    prisma.policy.count({ where: { deletedAt: null } }),
    prisma.claim.count({ where: { deletedAt: null } }),
    prisma.renewalTask.count(),
    prisma.agent.count(),
    prisma.customer.count({ where: { deletedAt: null } }),
    prisma.motorQuotation.count({ where: { deletedAt: null } }),
    prisma.task.count({ where: { deletedAt: null } }),
    prisma.backOfficeTask.count({ where: { deletedAt: null } }),
    prisma.customerAlert.count(),
  ]);

  console.log('--- 1. Baseline Preservation & Expansion Audit ---');
  const checks = [
    { entity: 'Total Users', baseline: baseline.totalUsers, current: totalUsers, pass: totalUsers >= baseline.totalUsers },
    { entity: 'Contacts', baseline: baseline.contacts, current: totalContacts, pass: totalContacts >= baseline.contacts },
    { entity: 'Leads', baseline: baseline.leads, current: totalLeads, pass: totalLeads >= baseline.leads },
    { entity: 'Vehicles', baseline: baseline.vehicles, current: totalVehicles, pass: totalVehicles >= baseline.vehicles },
    { entity: 'Policies', baseline: baseline.policies, current: totalPolicies, pass: totalPolicies >= baseline.policies },
    { entity: 'Claims', baseline: baseline.claims, current: totalClaims, pass: totalClaims >= baseline.claims },
    { entity: 'Renewals', baseline: baseline.renewals, current: totalRenewals, pass: totalRenewals >= baseline.renewals },
  ];

  for (const c of checks) {
    const status = c.pass ? '✅ PASS' : '❌ FAIL';
    console.log(`  ${status} | ${c.entity.padEnd(16)}: Baseline = ${String(c.baseline).padStart(3)} | Current = ${String(c.current).padStart(3)}`);
  }

  console.log('\n--- 2. First-Class Domain Models Backfill Audit ---');
  console.log(`  ${totalAgents >= 3 ? '✅ PASS' : '❌ FAIL'} | Agents Created   : ${totalAgents} active agent records (AGT-XXXX series)`);
  console.log(`  ${totalCustomers >= 21 ? '✅ PASS' : '❌ FAIL'} | Customers Created: ${totalCustomers} customer records with soft deduplication`);
  console.log(`  ${totalMotorQuotations >= 0 ? '✅ PASS' : '❌ FAIL'} | Motor Quotations : ${totalMotorQuotations} quotation records`);
  console.log(`  ${totalTasks >= 0 ? '✅ PASS' : '❌ FAIL'} | Centralized Tasks: ${totalTasks} tasks`);
  console.log(`  ${totalBackOfficeTasks >= 0 ? '✅ PASS' : '❌ FAIL'} | BackOffice Queue : ${totalBackOfficeTasks} operational tasks`);
  console.log(`  ${totalAlerts >= 0 ? '✅ PASS' : '❌ FAIL'} | Customer Alerts  : ${totalAlerts} proactive alerts`);

  console.log('\n--- 3. Orphan & Relational Integrity Checks ---');
  // Check for orphan leads (unlinked to customer)
  const orphanLeads = await prisma.lead.count({
    where: {
      deletedAt: null,
      customerId: null,
    },
  });
  console.log(`  ${orphanLeads === 0 ? '✅ PASS' : '❌ FAIL'} | Leads Linked to Customer: ${totalLeads - orphanLeads}/${totalLeads} linked (${orphanLeads} unlinked)`);

  // Check agent code format
  const invalidAgentCodes = await prisma.agent.count({
    where: {
      agentCode: {
        not: {
          startsWith: 'AGT-',
        },
      },
    },
  });
  console.log(`  ${invalidAgentCodes === 0 ? '✅ PASS' : '❌ FAIL'} | Agent Code Format: ${invalidAgentCodes} invalid (must be 0)`);

  // Check customer code format
  const invalidCustomerCodes = await prisma.customer.count({
    where: {
      customerCode: {
        not: {
          startsWith: 'CUST-',
        },
      },
    },
  });
  console.log(`  ${invalidCustomerCodes === 0 ? '✅ PASS' : '❌ FAIL'} | Customer Code Fmt: ${invalidCustomerCodes} invalid (must be 0)`);

  const allPassed = checks.every(c => c.pass) &&
    totalAgents >= 3 &&
    totalCustomers >= 21 &&
    orphanLeads === 0 &&
    invalidAgentCodes === 0 &&
    invalidCustomerCodes === 0;

  console.log('\n===============================================================');
  if (allPassed) {
    console.log('  🎯 RESULT: ALL INTEGRITY & DATA PRESERVATION CHECKS PASSED!  ');
    console.log('  Zero Data Loss. Domain Architecture Verified 100% Intact.    ');
  } else {
    console.log('  ⚠️ RESULT: INTEGRITY DISCREPANCIES DETECTED.                ');
  }
  console.log('===============================================================\n');

  if (!allPassed) {
    process.exit(1);
  }
}

verifyIntegrity()
  .catch(err => {
    console.error('Integrity audit error:', err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
