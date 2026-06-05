import 'dotenv/config';
import { defineConfig, env } from 'prisma/config';

/**
 * Prisma 7 moves connection configuration out of schema.prisma.
 * The CLI (migrate, db, studio) uses the datasource URL defined here.
 *
 * We use DIRECT_URL (session-mode pooler) for migrations because the
 * transaction-mode pooler (DATABASE_URL, pgbouncer) doesn't support the
 * operations migrations need. Runtime queries use DATABASE_URL via the
 * driver adapter in src/lib/prisma.ts.
 */
export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: {
    path: 'prisma/migrations',
  },
  datasource: {
    url: env('DIRECT_URL'),
  },
});
