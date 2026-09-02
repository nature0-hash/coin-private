import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok, readJson } from '@/lib/api';
import { audit } from '@/lib/notify';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);
  const assets = await db.asset.findMany({ orderBy: { sortOrder: 'asc' } });
  const walletCounts = await db.wallet.groupBy({ by: ['assetSymbol'], _count: { _all: true } });
  const counts: Record<string, number> = {};
  for (const c of walletCounts) counts[c.assetSymbol] = c._count._all;
  return ok({ assets: assets.map((a) => ({ ...a, walletCount: counts[a.symbol] ?? 0 })) });
});

// POST: create asset
export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body = await readJson<{
    symbol?: string; name?: string; kind?: string; color?: string;
    decimals?: number; network?: string; priceUsd?: number; tradeable?: boolean;
  }>(req);

  const symbol = (body.symbol ?? '').toUpperCase().trim();
  const name = (body.name ?? '').trim();
  if (!/^[A-Z0-9]{2,10}$/.test(symbol)) return ok({ error: 'Symbol must be 2-10 letters/digits' }, { status: 422 });
  if (!name) return ok({ error: 'Name required' }, { status: 422 });

  const exists = await db.asset.findUnique({ where: { symbol } });
  if (exists) return ok({ error: 'Asset already exists' }, { status: 409 });

  const maxSort = await db.asset.aggregate({ _max: { sortOrder: true } });
  const asset = await db.asset.create({
    data: {
      symbol, name,
      kind: body.kind === 'FIAT' ? 'FIAT' : 'CRYPTO',
      color: body.color ?? '#8A8F98',
      decimals: body.decimals ?? 8,
      network: body.network ?? null,
      priceUsd: body.priceUsd ?? 0,
      tradeable: body.tradeable ?? true,
      sortOrder: (maxSort._max.sortOrder ?? 0) + 1,
    },
  });
  await audit(admin.id, admin.email, 'ADMIN_ASSET_CREATE', `Listed ${symbol} (${name})`);
  return ok({ success: true, asset });
});

// PATCH: update asset (status, tradeable, price override, etc.)
export const PATCH = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body = await readJson<{
    symbol?: string; status?: string; tradeable?: boolean;
    priceUsd?: number; name?: string; color?: string; sortOrder?: number;
  }>(req);
  if (!body.symbol) return ok({ error: 'Symbol required' }, { status: 422 });

  const data: Record<string, string | number | boolean> = {};
  if (body.status && ['LISTED', 'DELISTED'].includes(body.status)) data.status = body.status;
  if (typeof body.tradeable === 'boolean') data.tradeable = body.tradeable;
  if (typeof body.priceUsd === 'number' && body.priceUsd >= 0) data.priceUsd = body.priceUsd;
  if (body.name) data.name = body.name;
  if (body.color) data.color = body.color;
  if (typeof body.sortOrder === 'number') data.sortOrder = body.sortOrder;
  if (!Object.keys(data).length) return ok({ error: 'Nothing to update' }, { status: 422 });

  const asset = await db.asset.update({ where: { symbol: body.symbol }, data });
  await audit(admin.id, admin.email, 'ADMIN_ASSET_UPDATE', `${body.symbol}: ${JSON.stringify(data)}`);
  return ok({ success: true, asset });
});

export const runtime = 'nodejs';
