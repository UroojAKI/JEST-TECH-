import { defineConfig } from 'prisma/config';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env' });

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
});
