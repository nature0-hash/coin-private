import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
(async () => {
  const amber = await db.user.findUnique({ where: { email: 'amber@demo.coinprivate.com' } });
  const usdc = await db.wallet.findUnique({ where: { userId_assetSymbol: { userId: amber!.id, assetSymbol: 'USDC' } } });
  const deposit = await db.depositRequest.findFirst({ where: { method: 'CRYPTO' }, orderBy: { createdAt: 'desc' } });
  console.log('amber USDC available:', usdc!.available);
  console.log('crypto deposit status:', deposit!.status, deposit!.reference);
  await db.$disconnect();
})();
