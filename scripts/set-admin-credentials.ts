// ============================================================
// Coin Private: one-off: migrate existing admin credentials
// Sets login ID = LUCIAN1975, password = PASSWORD@@1975 on the
// platform admin account of the CURRENT database.
// Run: bun scripts/set-admin-credentials.ts
// ============================================================
import bcrypt from 'bcryptjs';
import { PrismaClient } from '@prisma/client';

const url = process.env.DATABASE_URL || 'file:../db/custom.db';
const db = new PrismaClient({ datasources: { db: { url } } });

async function main() {
  const hash = await bcrypt.hash('PASSWORD@@1975', 10);
  const admin = await db.user.findFirst({ where: { role: 'ADMIN' } });
  if (!admin) {
    console.log('No admin user found: nothing to migrate.');
    return;
  }
  await db.user.update({
    where: { id: admin.id },
    data: { loginId: 'LUCIAN1975', passwordHash: hash },
  });
  console.log(`✓ Admin migrated: ${admin.email} → loginId LUCIAN1975, password updated`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
