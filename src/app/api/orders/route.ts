import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, handler, ok } from '@/lib/api';

export const GET = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const url = new URL(req.url);
  const take = Math.min(parseInt(url.searchParams.get('take') ?? '50', 10) || 50, 200);

  const orders = await db.order.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take,
  });
  return ok({ orders });
});

export const runtime = 'nodejs';
