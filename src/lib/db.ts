import fs from 'node:fs';
import path from 'node:path';
import { PrismaClient } from '@prisma/client'

// ------------------------------------------------------------
// DATABASE_URL resolution (in order):
// 1. Explicit env var (local .env, Vercel project settings)
// 2. Vercel serverless → writable /tmp SQLite (zero-config demo)
// 3. Local → <project>/db/custom.db (absolute, built from cwd)
// The resolved URL is passed straight to the client via
// `datasourceUrl` so it works in bundled production builds too
// (a runtime `process.env` assignment alone can be lost there).
// ------------------------------------------------------------
function resolveDatabaseUrl(): string {
  let url: string;
  if (process.env.DATABASE_URL) {
    url = process.env.DATABASE_URL;
  } else if (process.env.VERCEL === '1') {
    // Serverless: the only writable location; provisioned + seeded on first boot.
    url = 'file:/tmp/coinprivate.db';
  } else {
    const dbDir = path.join(process.cwd(), 'db');
    try {
      fs.mkdirSync(dbDir, { recursive: true });
    } catch {
      // directory may already exist: safe to ignore
    }
    url = `file:${path.join(dbDir, 'custom.db')}`;
  }
  // Prisma defines relative file URLs from the schema directory. Resolve the
  // same way here so local scripts, Next.js, and bundled builds use one file.
  if (url.startsWith('file:') && !url.startsWith('file:/')) {
    const abs = path.resolve(process.cwd(), 'prisma', url.slice('file:'.length));
    try {
      fs.mkdirSync(path.dirname(abs), { recursive: true });
    } catch {
      // directory may already exist: safe to ignore
    }
    url = `file:${abs}`;
  }
  return url;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const databaseUrl = resolveDatabaseUrl();

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasourceUrl: databaseUrl,
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db
