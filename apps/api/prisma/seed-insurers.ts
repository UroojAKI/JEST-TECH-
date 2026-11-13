import * as dotenv from 'dotenv';
import * as path from 'path';
dotenv.config({ path: path.resolve(__dirname, '../.env') });
dotenv.config({ path: path.resolve(process.cwd(), 'apps/api/.env') });

import { PrismaClient } from '@prisma/client';
import { seedInsurers, CANONICAL_MOTOR_INSURERS } from '../src/common/seeds/seed-insurers';

export { seedInsurers, CANONICAL_MOTOR_INSURERS };

async function main() {
  const prisma = new PrismaClient();
  try {
    const count = await seedInsurers(prisma);
    console.log(`- Seeded ${count} canonical partner insurers successfully.`);
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
