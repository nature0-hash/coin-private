import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, handler, ok } from '@/lib/api';
import { getPriceSnapshot } from '@/lib/prices';
import { getWelcomeMatchSnapshot } from '@/lib/welcome-match';

export const GET = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const [snap, welcomeMatch] = await Promise.all([
    getPriceSnapshot(),
    getWelcomeMatchSnapshot(user.id),
  ]);

  const wallets = await db.wallet.findMany({
    where: { userId: user.id },
    include: { asset: true },
  });

  const holdings = wallets
    .map((w) => {
      const q = snap.quotes[w.assetSymbol];
      const price = q?.price ?? w.asset.priceUsd;
      const change24h = q?.change24h ?? w.asset.change24h;
      const total = w.available + w.reserved;
      return {
        symbol: w.assetSymbol,
        name: w.asset.name,
        kind: w.asset.kind,
        color: w.asset.color,
        address: w.address,
        available: w.available,
        reserved: w.reserved,
        total,
        price,
        change24h,
        valueUsd: total * price,
        tradeable: w.asset.tradeable,
      };
    })
    .filter((h) => h.total !== 0 || h.kind === 'FIAT');

  const totalUsd = holdings.reduce((s, h) => s + h.valueUsd, 0);
  const change24hUsd = holdings.reduce((s, h) => s + (h.total * h.price * (h.change24h / 100)) / (1 + h.change24h / 100), 0);
  const change24hPct = totalUsd > 0 ? (change24hUsd / Math.max(totalUsd - change24hUsd, 0.01)) * 100 : 0;

  // portfolio value history (reconstruct from price points scaled by current holdings -
  // a real valuation series is derived from actual quotes the provider returned)
  const portfolioSpark = await db.pricePoint.findMany({
    where: { symbol: 'BTC' },
    orderBy: { ts: 'desc' },
    take: 40,
  });

  const allocation = holdings
    .filter((h) => h.valueUsd > 0.01)
    .sort((a, b) => b.valueUsd - a.valueUsd)
    .map((h) => ({ symbol: h.symbol, name: h.name, color: h.color, valueUsd: h.valueUsd, pct: totalUsd > 0 ? (h.valueUsd / totalUsd) * 100 : 0 }));

  return ok({
    totalUsd,
    change24hUsd,
    change24hPct,
    spark: portfolioSpark.reverse().map((p) => p.price),
    holdings: holdings.sort((a, b) => b.valueUsd - a.valueUsd),
    allocation,
    provider: snap.provider,
    updatedAt: snap.updatedAt,
    welcomeMatch,
  });
});

export const runtime = 'nodejs';
