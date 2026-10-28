const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
prisma.quotation.count()
  .then(c => console.log(`TOTAL_QUOTATIONS_FOUND: ${c}`))
  .catch(console.error)
  .finally(() => prisma.$disconnect());
