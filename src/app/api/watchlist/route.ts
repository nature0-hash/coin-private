import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, handler, ok, readJson } from '@/lib/api';

// POST /api/watchlist: toggle a symbol
export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { symbol } = await readJson<{ symbol?: string }>(req);
  const sym = (symbol ?? '').toUpperCase();
  if (!sym) return ok({ error: 'Symbol required' }, { status: 422 });

  const existing = await db.watchlistItem.findUnique({
    where: { userId_symbol: { userId: user.id, symbol: sym } },
  });
  if (existing) {
    await db.watchlistItem.delete({ where: { id: existing.id } });
    return ok({ watching: false });
  }
  await db.watchlistItem.create({ data: { userId: user.id, symbol: sym } });
  return ok({ watching: true });
});

// GET /api/watchlist
export const GET = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const items = await db.watchlistItem.findMany({ where: { userId: user.id } });
  return ok({ symbols: items.map((i) => i.symbol) });
});

export const runtime = 'nodejs';
