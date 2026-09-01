import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok } from '@/lib/api';
import { getPriceSnapshot } from '@/lib/prices';
import { getSettings } from '@/lib/settings';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);

  const [users, orders, ledgerTxs, wallets, pendingApprovals, promos, deposits, withdrawals] = await Promise.all([
    db.user.findMany({ select: { id: true, status: true, kycStatus: true, createdAt: true } }),
    db.order.findMany({ orderBy: { createdAt: 'desc' }, take: 500 }),
    db.ledgerTransaction.findMany({ orderBy: { createdAt: 'desc' }, take: 800 }),
    db.wallet.findMany({ include: { asset: true } }),
    db.approval.findMany({ where: { status: 'PENDING' } }),
    db.promo.findMany(),
    db.depositRequest.findMany({ take: 500 }),
    db.withdrawalRequest.findMany({ take: 500 }),
  ]);

  const snap = await getPriceSnapshot();

  let platformAumUsd = 0;
  const perAsset: Record<string, number> = {};
  for (const w of wallets) {
    const price = snap.quotes[w.assetSymbol]?.price ?? w.asset.priceUsd;
    const value = (w.available + w.reserved) * price;
    platformAumUsd += value;
    perAsset[w.assetSymbol] = (perAsset[w.assetSymbol] ?? 0) + value;
  }

  const tradeVolume24h = orders
    .filter((o) => Date.now() - o.createdAt.getTime() < 24 * 3600 * 1000)
    .reduce((s, o) => s + o.amountQuote, 0);
  const fees24h = orders
    .filter((o) => Date.now() - o.createdAt.getTime() < 24 * 3600 * 1000)
    .reduce((s, o) => s + o.fee, 0);

  const settings = await getSettings();

  return ok({
    totals: {
      users: users.length,
      activeUsers: users.filter((u) => u.status === 'ACTIVE').length,
      frozenUsers: users.filter((u) => u.status === 'FROZEN').length,
      kycPending: users.filter((u) => u.kycStatus === 'PENDING').length,
      newUsers7d: users.filter((u) => Date.now() - u.createdAt.getTime() < 7 * 24 * 3600 * 1000).length,
      orders: orders.length,
      ledgerTxs: ledgerTxs.length,
      pendingApprovals: pendingApprovals.length,
      activePromos: promos.filter((p) => p.active).length,
      deposits: deposits.length,
      withdrawals: withdrawals.length,
    },
    aum: {
      totalUsd: platformAumUsd,
      perAsset: Object.entries(perAsset)
        .map(([symbol, valueUsd]) => ({ symbol, valueUsd }))
        .sort((a, b) => b.valueUsd - a.valueUsd),
    },
    activity: {
      tradeVolume24h,
      fees24h,
      recentLedger: ledgerTxs.slice(0, 12).map((t) => ({
        id: t.id, reference: t.reference, type: t.type, status: t.status,
        description: t.description, createdAt: t.createdAt,
      })),
      recentOrders: orders.slice(0, 10).map((o) => ({
        id: o.id, reference: o.reference, side: o.side, baseSymbol: o.baseSymbol,
        amountQuote: o.amountQuote, status: o.status, createdAt: o.createdAt,
      })),
    },
    settings,
  });
});

export const runtime = 'nodejs';
