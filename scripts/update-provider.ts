// One-off: update seeded DB setting price.provider → coingecko
import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
const url = process.env.DATABASE_URL || 'file:../db/custom.db';
const p = new PrismaClient({ datasources: { db: { url } } });
const rows = [
  { key: 'price.provider', value: 'coingecko' },
];
for (const r of rows) {
  const existing = await p.setting.findUnique({ where: { key: r.key } });
  if (existing) {
    await p.setting.update({ where: { key: r.key }, data: { value: r.value } });
    console.log('updated', r.key, '→', r.value);
  } else {
    console.log('not found (fresh db will seed with coingecko):', r.key);
  }
}
await p.$disconnect();
await db.$disconnect();
