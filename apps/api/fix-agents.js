const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { role: { code: 'AGENT' } },
  });

  console.log(`Found ${users.length} users with role AGENT.`);

  let created = 0;
  for (let i = 0; i < users.length; i++) {
    const user = users[i];
    
    // Check if agent exists
    const existing = await prisma.agent.findUnique({
      where: { userId: user.id }
    });

    if (!existing) {
      await prisma.agent.create({
        data: {
          userId: user.id,
          companyId: user.companyId,
          agentCode: `AGT-${Math.floor(100000 + Math.random() * 900000)}`,
          agencyName: `${user.firstName} ${user.lastName} Agency`,
          licenseNumber: `LIC-${Math.floor(100000 + Math.random() * 900000)}`,
          isActive: true,
          deletedAt: null,
        }
      });
      created++;
      console.log(`Created agent for user ${user.email}`);
    } else {
      // Ensure companyId is set if it was null
      if (!existing.companyId && user.companyId) {
        await prisma.agent.update({
          where: { id: existing.id },
          data: { companyId: user.companyId }
        });
        console.log(`Updated companyId for agent user ${user.email}`);
      }
    }
  }
  
  console.log(`Finished creating ${created} agents.`);
}

main().finally(() => prisma.$disconnect());
