import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
(async () => {
  // The rejected withdrawal's release posted under old code: available was
  // credited but reserved was not drained. Fix reserved now.
  const amber = await db.user.findUnique({ where: { email: 'amber@demo.coinprivate.com' } });
  const w = await db.wallet.findUnique({ where: { userId_assetSymbol: { userId: amber!.id, assetSymbol: 'USD' } } });
  const pendingWithdrawals = await db.withdrawalRequest.count({ where: { userId: amber!.id, status: 'PENDING' } });
  if (pendingWithdrawals === 0 && w!.reserved > 0) {
    await db.wallet.update({ where: { id: w!.id }, data: { reserved: 0 } });
    console.log(`reconciled: reserved ${w!.reserved} -> 0`);
  } else {
    console.log('no reconcile needed; pending:', pendingWithdrawals, 'reserved:', w!.reserved);
  }
  await db.$disconnect();
})();
