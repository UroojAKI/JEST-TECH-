const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const agents = await prisma.agent.findMany();
  console.log('Agents count:', agents.length);
  console.log('Agents company ids:', agents.map(a => a.companyId).join(', '));
}

main().finally(() => prisma.$disconnect());
