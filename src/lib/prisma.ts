import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { env } from '../config/env';

/**
 * Prisma 7 no longer reads the connection URL from schema.prisma. The runtime
 * connection is supplied via a driver adapter. We point the pg adapter at
 * DATABASE_URL (the transaction-mode pooler for app queries).
 *
 * A global instance in non-production avoids exhausting the connection pool
 * across hot-reloads (ts-node-dev).
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

function createClient(): PrismaClient {
  const adapter = new PrismaPg({ connectionString: env.databaseUrl });
  return new PrismaClient({ adapter, log: ['warn', 'error'] });
}

export const prisma = globalForPrisma.prisma ?? createClient();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
