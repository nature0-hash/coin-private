import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
(async () => {
  // Find pending withdrawal holds whose wallet reserved balance does not
  // reflect the hold (data inconsistency from the pre-fix ledger bug).
  const holds = await db.ledgerTransaction.findMany({
    where: { status: 'POSTED', meta: { contains: '"hold":true' } },
    include: { entries: true },
  });
  for (const h of holds) {
    for (const e of h.entries) {
      if (!e.walletId) continue;
      const w = await db.wallet.findUnique({ where: { id: e.walletId } });
      if (!w) continue;
      const expectedReserved = w.reserved;
      void expectedReserved;
      // The hold moved amount out of available; ensure reserved carries it.
      if (w.reserved < e.amount) {
        await db.wallet.update({ where: { id: w.id }, data: { reserved: w.reserved + e.amount } });
        console.log(`reconciled ${w.assetSymbol} wallet ${w.id}: reserved ${w.reserved} -> ${w.reserved + e.amount}`);
      }
    }
  }
  await db.$disconnect();
})();
