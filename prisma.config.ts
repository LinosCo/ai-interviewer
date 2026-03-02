import 'dotenv/config';
import { defineConfig } from 'prisma/config';

const databaseUrl = process.env.DATABASE_URL;
const directUrl = process.env.DIRECT_URL;

// DATABASE_URL is required at runtime but NOT during `prisma generate` (build time).
// prisma generate only reads schema structure — no DB connection is made.
// The runtime PrismaClient validates the URL separately in src/lib/prisma.ts.
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  ...(databaseUrl
    ? {
        datasource: {
          url: databaseUrl,
          ...(directUrl ? { directUrl } : {}),
        },
      }
    : {}),
});
