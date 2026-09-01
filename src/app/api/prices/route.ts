import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { handler, ok } from '@/lib/api';
import { getPriceSnapshot } from '@/lib/prices';
import { ensureSeeded } from '@/lib/bootstrap';

export const GET = handler(async (_req: NextRequest) => {
  await ensureSeeded(); // first-boot provisioning on fresh deploys
  const snap = await getPriceSnapshot();
  const assets = await db.asset.findMany({ where: { status: 'LISTED' }, orderBy: { sortOrder: 'asc' } });
  const quotes = assets
    .map((a) => {
      const q = snap.quotes[a.symbol];
      return {
        symbol: a.symbol,
        name: a.name,
        kind: a.kind,
        color: a.color,
        price: q?.price ?? a.priceUsd,
        change24h: q?.change24h ?? a.change24h,
        tradeable: a.tradeable,
        network: a.network,
      };
    })
    .filter((q) => q.price > 0);

  return ok({ quotes, updatedAt: snap.updatedAt, provider: snap.provider });
});

export const runtime = 'nodejs';
