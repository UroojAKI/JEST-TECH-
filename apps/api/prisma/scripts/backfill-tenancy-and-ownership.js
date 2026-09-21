const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function backfill() {
  console.log('Starting Tenancy and Agent Ownership Backfill...');

  const company = await prisma.company.findFirst();
  if (!company) {
    throw new Error('No company found in database!');
  }
  const companyId = company.id;
  console.log(`Target company: ${company.name} (${companyId})`);

  // 1. Standardize agent codes to AGT-000001, AGT-000002, etc.
  const agents = await prisma.agent.findMany({ orderBy: { createdAt: 'asc' } });
  console.log(`Found ${agents.length} agents`);

  for (let i = 0; i < agents.length; i++) {
    const formattedCode = `AGT-${String(i + 1).padStart(6, '0')}`;
    await prisma.agent.update({
      where: { id: agents[i].id },
      data: {
        agentCode: formattedCode,
        companyId: companyId,
      },
    });
    console.log(`Agent ${agents[i].id} updated with code ${formattedCode} and companyId ${companyId}`);
  }

  // Refetch updated agents
  const defaultAgent = await prisma.agent.findFirst({
    where: { agentCode: 'AGT-000001' },
  });

  // 2. Backfill Customers
  const customers = await prisma.customer.findMany({
    include: {
      leads: true,
      createdBy: {
        include: {
          agentProfile: true,
        },
      },
    },
  });

  console.log(`Backfilling ${customers.length} customers...`);
  for (const cust of customers) {
    let assignedAgentId = cust.primaryAgentId;
    if (!assignedAgentId) {
      // Check if any lead has an agentId
      const leadWithAgent = cust.leads.find(l => l.agentId);
      if (leadWithAgent) {
        assignedAgentId = leadWithAgent.agentId;
      } else if (cust.createdBy?.agentProfile?.id) {
        assignedAgentId = cust.createdBy.agentProfile.id;
      } else {
        assignedAgentId = defaultAgent.id;
      }

      await prisma.customer.update({
        where: { id: cust.id },
        data: {
          companyId: companyId,
          primaryAgentId: assignedAgentId,
        },
      });

      // Check if an active CustomerAgentHistory already exists
      const existingHistory = await prisma.customerAgentHistory.findFirst({
        where: {
          customerId: cust.id,
          unassignedAt: null,
        },
      });

      if (!existingHistory) {
        await prisma.customerAgentHistory.create({
          data: {
            customerId: cust.id,
            agentId: assignedAgentId,
            companyId: companyId,
            reason: 'Baseline migration agent assignment',
            assignedAt: new Date(),
          },
        });
      }
    }
  }

  // 3. Backfill Leads
  const leads = await prisma.lead.findMany({
    include: {
      customer: true,
      assignedTo: {
        include: {
          agentProfile: true,
        },
      },
    },
  });
  console.log(`Backfilling ${leads.length} leads...`);
  for (const lead of leads) {
    let agentId = lead.agentId;
    if (!agentId) {
      if (lead.assignedTo?.agentProfile?.id) {
        agentId = lead.assignedTo.agentProfile.id;
      } else if (lead.customer?.primaryAgentId) {
        agentId = lead.customer.primaryAgentId;
      } else {
        agentId = defaultAgent.id;
      }
    }

    await prisma.lead.update({
      where: { id: lead.id },
      data: {
        companyId: companyId,
        agentId: agentId,
      },
    });
  }

  // 4. Backfill Quotations
  const quotations = await prisma.quotation.findMany({
    include: {
      lead: true,
    },
  });
  console.log(`Backfilling ${quotations.length} quotations...`);
  for (const q of quotations) {
    let agentId = q.agentId;
    if (!agentId) {
      agentId = q.lead?.agentId || defaultAgent.id;
    }
    await prisma.quotation.update({
      where: { id: q.id },
      data: {
        companyId: companyId,
        agentId: agentId,
      },
    });
  }

  // 5. Backfill Policies
  const policies = await prisma.policy.findMany({
    include: {
      quotation: true,
    },
  });
  console.log(`Backfilling ${policies.length} policies...`);
  for (const p of policies) {
    let agentId = p.agentId;
    if (!agentId) {
      agentId = p.quotation?.agentId || defaultAgent.id;
    }
    await prisma.policy.update({
      where: { id: p.id },
      data: {
        companyId: companyId,
        agentId: agentId,
      },
    });
  }

  // 6. Backfill MotorQuotations & BackOfficeTasks & Claims
  await prisma.motorQuotation.updateMany({
    data: { companyId: companyId },
  });
  await prisma.backOfficeTask.updateMany({
    data: { companyId: companyId },
  });
  await prisma.claim.updateMany({
    data: { companyId: companyId },
  });

  console.log('✅ Tenancy and Agent Ownership Backfill completed successfully!');
}

backfill()
  .catch((e) => {
    console.error('Backfill error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
