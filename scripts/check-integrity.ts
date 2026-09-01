import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
(async () => {
  const withdrawals = await db.withdrawalRequest.findMany();
  const approvals = await db.approval.findMany({ where: { type: 'WITHDRAWAL' } });
  const holds = await db.ledgerTransaction.findMany({ where: { description: { contains: 'Withdrawal hold' } }, include: { entries: true } });
  const amber = await db.user.findUnique({ where: { email: 'amber@demo.coinprivate.com' } });
  const usdWallet = await db.wallet.findUnique({ where: { userId_assetSymbol: { userId: amber!.id, assetSymbol: 'USD' } } });
  console.log('withdrawalRequests:', withdrawals.length, withdrawals.map(w => `${w.reference}:${w.status}`));
  console.log('withdrawalApprovals:', approvals.length, approvals.map(a => `${a.reference}:${a.status}`));
  console.log('holdLedgerTxs:', holds.length, holds.map(h => `${h.reference}:${h.status}`));
  console.log('amber USD available:', usdWallet!.available, 'reserved:', usdWallet!.reserved);
  await db.$disconnect();
})();
