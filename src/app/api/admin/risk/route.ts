import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok } from '@/lib/api';
import { getPriceSnapshot } from '@/lib/prices';
import { getSettings } from '@/lib/settings';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);

  const settings = await getSettings();
  const snap = await getPriceSnapshot();

  // Risk signals
  const dayAgo = new Date(Date.now() - 24 * 3600 * 1000);
  const [recentOrders, failedLogins, frozenUsers, pendingRisk] = await Promise.all([
    db.order.findMany({ where: { createdAt: { gte: dayAgo } }, include: { user: { select: { id: true, name: true, email: true } } } }),
    db.securityEvent.findMany({ where: { type: 'LOGIN_FAILED', createdAt: { gte: dayAgo } } }),
    db.user.findMany({ where: { status: 'FROZEN' }, select: { id: true, name: true, email: true, status: true } }),
    db.approval.findMany({ where: { type: 'RISK_TRADE', status: 'PENDING' }, include: { user: { select: { name: true, email: true } } } }),
  ]);

  // velocity: users with > 10 trades/24h
  const byUser: Record<string, { name: string; email: string; count: number; volume: number }> = {};
  for (const o of recentOrders) {
    const key = o.user.id;
    byUser[key] ??= { name: o.user.name, email: o.user.email, count: 0, volume: 0 };
    byUser[key].count += 1;
    byUser[key].volume += o.amountQuote;
  }
  const velocityFlags = Object.values(byUser)
    .filter((u) => u.count > 10)
    .sort((a, b) => b.count - a.count)
    .slice(0, 20);

  // largest trades today vs threshold
  const threshold = parseFloat(settings['risk.flagThresholdUsd'] ?? '10000');
  const largeTrades = recentOrders
    .filter((o) => o.amountQuote > threshold)
    .sort((a, b) => b.amountQuote - a.amountQuote)
    .slice(0, 15)
    .map((o) => ({
      id: o.id, reference: o.reference, side: o.side, baseSymbol: o.baseSymbol,
      amountQuote: o.amountQuote, status: o.status, userName: o.user.name, userEmail: o.user.email,
      createdAt: o.createdAt,
    }));

  // failed-login hotspots
  const failedByActor: Record<string, number> = {};
  for (const f of failedLogins) {
    const key = f.detail ?? 'unknown';
    failedByActor[key] = (failedByActor[key] ?? 0) + 1;
  }

  return ok({
    thresholds: {
      flagThresholdUsd: threshold,
      maxOrderUsd: parseFloat(settings['trade.maxOrderUsd'] ?? '250000'),
      dailyWithdrawUsd: parseFloat(settings['withdraw.dailyLimitUsd'] ?? '100000'),
      minOrderUsd: parseFloat(settings['trade.minOrderUsd'] ?? '5'),
    },
    velocityFlags,
    largeTrades,
    frozenUsers,
    pendingRisk: pendingRisk.map((p) => ({
      id: p.id, reference: p.reference, amount: p.amount, assetSymbol: p.assetSymbol,
      userName: p.user?.name, userEmail: p.user?.email, createdAt: p.createdAt,
    })),
    failedLogins: Object.entries(failedByActor).map(([identifier, count]) => ({ identifier, count })).sort((a, b) => b.count - a.count).slice(0, 10),
    volume24h: recentOrders.reduce((s, o) => s + o.amountQuote, 0),
    provider: snap.provider,
  });
});

export const runtime = 'nodejs';
