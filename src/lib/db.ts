import { PrismaClient } from '@prisma/client';

function resolveDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim();
  if (!url) throw new Error('DATABASE_URL is required. Connect a PostgreSQL database to this deployment.');
  if (!url.startsWith('postgres://') && !url.startsWith('postgresql://')) {
    throw new Error('DATABASE_URL must be a PostgreSQL connection string.');
  }
  return url;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const databaseUrl = resolveDatabaseUrl();

export const db = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: databaseUrl,
});

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db;
