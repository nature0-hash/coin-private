import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { auth, handler, ok } from '@/lib/api';
import { getPriceSnapshot } from '@/lib/prices';
import { getSettings } from '@/lib/settings';
import { ensureSeeded } from '@/lib/bootstrap';

export const GET = handler(async (req: NextRequest) => {
  await ensureSeeded(); // first-boot provisioning on fresh deploys
  await auth(req); // optional auth: markets are viewable pre-login
  const snap = await getPriceSnapshot();
  const assets = await db.asset.findMany({ orderBy: { sortOrder: 'asc' } });
  const settings = await getSettings();

  const rows = await Promise.all(
    assets.map(async (a) => {
      const q = snap.quotes[a.symbol];
      const history = await db.pricePoint.findMany({
        where: { symbol: a.symbol },
        orderBy: { ts: 'desc' },
        take: 40,
      });
      return {
        symbol: a.symbol,
        name: a.name,
        kind: a.kind,
        color: a.color,
        network: a.network,
        status: a.status,
        tradeable: a.tradeable,
        price: q?.price ?? a.priceUsd,
        change24h: q?.change24h ?? a.change24h,
        spark: history.reverse().map((p) => p.price),
      };
    })
  );

  return ok({
    assets: rows,
    provider: snap.provider,
    updatedAt: snap.updatedAt,
    feePercent: parseFloat(settings['trade.feePercent'] ?? '0.35'),
  });
});

export const runtime = 'nodejs';
