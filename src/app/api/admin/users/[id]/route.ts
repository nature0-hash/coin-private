import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok } from '@/lib/api';
import { getPriceSnapshot } from '@/lib/prices';
import { getWelcomeMatchSnapshot } from '@/lib/welcome-match';

type Ctx = { params: Promise<{ id: string }> };

export const GET = handler<Ctx>(async (req: NextRequest, ctx) => {
  await requireAdmin(req);
  const { id } = await ctx.params;

  const user = await db.user.findUnique({
    where: { id },
    include: { wallets: { include: { asset: true } } },
  });
  if (!user) return ok({ error: 'User not found' }, { status: 404 });

  const [orders, transfers, deposits, withdrawals, ledgerTxs, securityEvents, redemptions, welcomeMatch, transactionEdits] = await Promise.all([
    db.order.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 25 }),
    db.transfer.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 25 }),
    db.depositRequest.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 25 }),
    db.withdrawalRequest.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 25 }),
    db.ledgerTransaction.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 40, include: { entries: true } }),
    db.securityEvent.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 20 }),
    db.promoRedemption.findMany({ where: { userId: id }, include: { promo: true } }),
    getWelcomeMatchSnapshot(id),
    db.transactionEditLog.findMany({ where: { userId: id }, orderBy: { createdAt: 'desc' }, take: 30 }),
  ]);

  const snap = await getPriceSnapshot();
  const wallets = user.wallets.map((w) => {
    const price = snap.quotes[w.assetSymbol]?.price ?? w.asset.priceUsd;
    return {
      id: w.id, symbol: w.assetSymbol, address: w.address, available: w.available,
      reserved: w.reserved, total: w.available + w.reserved, price,
      valueUsd: (w.available + w.reserved) * price, color: w.asset.color,
    };
  });

  const { passwordHash: _ph, ...safeUser } = user;
  void _ph;

  return ok({
    user: { ...safeUser, wallets },
    orders, transfers, deposits, withdrawals,
    ledgerTxs, securityEvents, transactionEdits,
    promos: redemptions.map((r) => ({ code: r.promo.code, title: r.promo.title, redeemedAt: r.createdAt })),
    welcomeMatch,
  });
});

export const runtime = 'nodejs';
