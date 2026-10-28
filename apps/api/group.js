const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
async function run() {
  const byUser = await prisma.quotation.groupBy({
    by: ['createdById'],
    _count: { id: true },
  });
  console.log('By User:', byUser);
  
  const byStatus = await prisma.quotation.groupBy({
    by: ['status'],
    _count: { id: true },
  });
  console.log('By Status:', byStatus);
  
  const byProduct = await prisma.quotation.groupBy({
    by: ['productType'],
    _count: { id: true },
  });
  console.log('By Product:', byProduct);

  const deleted = await prisma.quotation.count({ where: { deletedAt: { not: null } } });
  console.log('Deleted:', deleted);
}
run().catch(console.error).finally(() => prisma.$disconnect());
