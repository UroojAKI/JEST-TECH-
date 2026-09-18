const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  console.log('--- STARTING RE-ARCHITECTURE DATA BACKFILL ---');

  // 1. Backfill Agents
  const agentUsers = await prisma.user.findMany({
    where: { role: { code: 'AGENT' } },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`Found ${agentUsers.length} agent users to backfill.`);

  for (let i = 0; i < agentUsers.length; i++) {
    const u = agentUsers[i];
    const existing = await prisma.agent.findUnique({ where: { userId: u.id } });
    if (!existing) {
      const agentCode = `AGT-${String(i + 1).padStart(4, '0')}`;
      const name = `${u.firstName || ''} ${u.lastName || ''}`.trim();
      const agent = await prisma.agent.create({
        data: {
          userId: u.id,
          agentCode,
          agencyName: name ? `${name} Agency` : `Agency ${agentCode}`,
          commissionTier: 'STANDARD',
          isActive: true
        }
      });
      console.log(`Created Agent: ${agent.agentCode} for user ${u.email}`);
    } else {
      console.log(`Agent already exists for user ${u.email}: ${existing.agentCode}`);
    }
  }

  // Map of userId -> agentId
  const allAgents = await prisma.agent.findMany();
  const userAgentMap = new Map(allAgents.map(a => [a.userId, a.id]));

  // 2. Backfill Customers from Contacts
  const contacts = await prisma.contact.findMany({
    include: { customer: true },
    orderBy: { createdAt: 'asc' }
  });
  console.log(`Found ${contacts.length} contacts to backfill into Customers.`);

  for (let i = 0; i < contacts.length; i++) {
    const c = contacts[i];
    if (!c.customer) {
      const customerCode = `CUST-${String(i + 1).padStart(6, '0')}`;
      const customer = await prisma.customer.create({
        data: {
          customerCode,
          firstName: c.firstName || 'Customer',
          lastName: c.lastName || '',
          mobile: c.phone || '9999999999',
          email: c.email || null,
          panNumber: c.panNumber || null,
          aadhaarNumber: c.aadhaarNumber || null,
          contactId: c.id,
          createdById: c.createdById || null
        }
      });
      console.log(`Created Customer: ${customer.customerCode} for contact ${c.contactCode}`);
    }
  }

  // Map of contactId -> customerId
  const allCustomers = await prisma.customer.findMany();
  const contactCustomerMap = new Map(allCustomers.filter(c => c.contactId).map(c => [c.contactId, c.id]));

  // 3. Link Leads
  const leads = await prisma.lead.findMany();
  console.log(`Processing ${leads.length} leads...`);
  let updatedLeads = 0;
  for (const lead of leads) {
    const updates = {};
    if (!lead.customerId && lead.contactId && contactCustomerMap.has(lead.contactId)) {
      updates.customerId = contactCustomerMap.get(lead.contactId);
    }
    if (!lead.agentId && lead.assignedToId && userAgentMap.has(lead.assignedToId)) {
      updates.agentId = userAgentMap.get(lead.assignedToId);
    }
    if (Object.keys(updates).length > 0) {
      await prisma.lead.update({
        where: { id: lead.id },
        data: updates
      });
      updatedLeads++;
    }
  }
  console.log(`Updated ${updatedLeads} leads with customerId / agentId.`);

  // 4. Link & Parse Vehicles
  const vehicles = await prisma.vehicle.findMany();
  console.log(`Processing ${vehicles.length} vehicles...`);
  let updatedVehicles = 0;
  for (const v of vehicles) {
    const updates = {};
    if (!v.customerId && v.contactId && contactCustomerMap.has(v.contactId)) {
      updates.customerId = contactCustomerMap.get(v.contactId);
    }
    if (!v.make && v.makeModel) {
      const parts = v.makeModel.split(' ');
      if (parts[0] === 'Maruti' && parts[1] === 'Suzuki') {
        updates.make = 'Maruti Suzuki';
        updates.model = parts[2] || '';
        updates.variant = parts.slice(3).join(' ') || null;
      } else {
        updates.make = parts[0] || '';
        updates.model = parts[1] || '';
        updates.variant = parts.slice(2).join(' ') || null;
      }
    }
    if (!v.manufactureYear && v.manufactureYearMonth) {
      const ym = v.manufactureYearMonth.split('/');
      if (ym.length === 2) {
        updates.manufactureMonth = parseInt(ym[0], 10) || null;
        updates.manufactureYear = parseInt(ym[1], 10) || null;
      }
    }
    if (Object.keys(updates).length > 0) {
      await prisma.vehicle.update({
        where: { id: v.id },
        data: updates
      });
      updatedVehicles++;
    }
  }
  console.log(`Updated ${updatedVehicles} vehicles.`);

  // 5. Link Policies
  const policies = await prisma.policy.findMany();
  console.log(`Processing ${policies.length} policies...`);
  let updatedPolicies = 0;
  for (const pol of policies) {
    if (!pol.customerId && pol.contactId && contactCustomerMap.has(pol.contactId)) {
      await prisma.policy.update({
        where: { id: pol.id },
        data: { customerId: contactCustomerMap.get(pol.contactId) }
      });
      updatedPolicies++;
    }
  }
  console.log(`Updated ${updatedPolicies} policies with customerId.`);

  // 6. Link Claims
  const claims = await prisma.claim.findMany();
  console.log(`Processing ${claims.length} claims...`);
  let updatedClaims = 0;
  for (const cl of claims) {
    if (!cl.customerId && cl.contactId && contactCustomerMap.has(cl.contactId)) {
      await prisma.claim.update({
        where: { id: cl.id },
        data: { customerId: contactCustomerMap.get(cl.contactId) }
      });
      updatedClaims++;
    }
  }
  console.log(`Updated ${updatedClaims} claims with customerId.`);

  console.log('--- RE-ARCHITECTURE DATA BACKFILL COMPLETE ---');
  await prisma.$disconnect();
}

backfill().catch(e => {
  console.error('Backfill error:', e);
  process.exit(1);
});
