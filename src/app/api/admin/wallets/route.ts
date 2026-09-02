import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok } from '@/lib/api';
import { getPriceSnapshot } from '@/lib/prices';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);
  const snap = await getPriceSnapshot();

  const wallets = await db.wallet.findMany({
    include: { user: { select: { id: true, name: true, email: true, status: true } }, asset: true },
    orderBy: { updatedAt: 'desc' },
    take: 500,
  });

  return ok({
    wallets: wallets.map((w) => {
      const price = snap.quotes[w.assetSymbol]?.price ?? w.asset.priceUsd;
      return {
        id: w.id, userId: w.userId, userName: w.user.name, userEmail: w.user.email,
        userStatus: w.user.status, symbol: w.assetSymbol, assetName: w.asset.name,
        color: w.asset.color, available: w.available, reserved: w.reserved,
        total: w.available + w.reserved, price, valueUsd: (w.available + w.reserved) * price,
        address: w.address, updatedAt: w.updatedAt,
      };
    }),
  });
});

export const runtime = 'nodejs';
