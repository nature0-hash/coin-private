import { NextRequest } from 'next/server';
import { requireAuth, handler, ok, readJson } from '@/lib/api';
import { createOrder, TradeError } from '@/lib/trade';
import { audit } from '@/lib/notify';
import { getBool } from '@/lib/settings';

export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  if (await getBool('platform.maintenance')) {
    return ok({ error: 'Trading is paused for maintenance. Your funds are safe.' }, { status: 503 });
  }
  const body = await readJson<{
    side?: 'BUY' | 'SELL' | 'CONVERT';
    baseSymbol?: string;
    quoteSymbol?: string;
    sourceSymbol?: string;
    amount?: number;
    amountMode?: 'QUOTE' | 'BASE';
    promoCode?: string;
  }>(req);

  const side = body.side ?? 'BUY';
  if (!['BUY', 'SELL', 'CONVERT'].includes(side)) return ok({ error: 'Invalid order side' }, { status: 422 });
  if (!body.baseSymbol) return ok({ error: 'Choose an asset' }, { status: 422 });
  if (side === 'CONVERT' && !body.sourceSymbol) return ok({ error: 'Choose a source asset' }, { status: 422 });

  try {
    const result = await createOrder({
      userId: user.id,
      side,
      baseSymbol: body.baseSymbol,
      quoteSymbol: body.quoteSymbol ?? 'USD',
      sourceSymbol: body.sourceSymbol,
      amount: body.amount ?? 0,
      amountMode: body.amountMode ?? (side === 'CONVERT' ? 'BASE' : 'QUOTE'),
      promoCode: body.promoCode ?? null,
    });
    await audit(user.id, user.email, side, `${result.status === 'EXECUTED' ? 'Executed' : 'Queued'} ${side} ${body.baseSymbol}`);
    return ok(result);
  } catch (e) {
    if (e instanceof TradeError) return ok({ error: e.message }, { status: e.status });
    throw e;
  }
});

export const runtime = 'nodejs';
