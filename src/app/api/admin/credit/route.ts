import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok, readJson } from '@/lib/api';
import { postLedger } from '@/lib/ledger';
import { genReference } from '@/lib/session';
import { audit, notifyUser } from '@/lib/notify';

// POST /api/admin/credit: post a manual adjustment through the atomic
// ledger (this is the ONLY way admins move user funds; there is no
// "set balance" endpoint by design).
export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body = await readJson<{ userId?: string; symbol?: string; amount?: number; direction?: 'CREDIT' | 'DEBIT'; reason?: string }>(req);

  const userId = body.userId ?? '';
  const symbol = (body.symbol ?? '').toUpperCase();
  const amount = Number(body.amount ?? 0);
  const direction = body.direction === 'DEBIT' ? 'DEBIT' : 'CREDIT';
  const reason = (body.reason ?? '').trim();
  if (!userId) return ok({ error: 'User required' }, { status: 422 });
  if (!symbol) return ok({ error: 'Asset required' }, { status: 422 });
  if (!(amount > 0)) return ok({ error: 'Amount must be positive' }, { status: 422 });
  if (reason.length < 3) return ok({ error: 'A reason is required' }, { status: 422 });

  const wallet = await db.wallet.findUnique({ where: { userId_assetSymbol: { userId, assetSymbol: symbol } } });
  if (!wallet) return ok({ error: `User has no ${symbol} wallet` }, { status: 422 });

  if (direction === 'DEBIT' && wallet.available + 1e-9 < amount) {
    return ok({ error: 'User has insufficient available balance for this debit' }, { status: 422 });
  }

  const result = await postLedger({
    type: 'ADJUSTMENT',
    userId,
    reference: genReference('ADJ'),
    description: `Manual ${direction === 'CREDIT' ? 'credit' : 'debit'} by Management: ${reason}`,
    meta: { by: admin.email, reason },
    lines: [{ walletId: wallet.id, direction, amount, memo: reason }],
  });

  await notifyUser(userId, 'SYSTEM', direction === 'CREDIT' ? 'Funds credited' : 'Funds adjusted', `${amount} ${symbol} was ${direction === 'CREDIT' ? 'credited to' : 'debited from'} your wallet. Reason: ${reason}`);
  await audit(admin.id, admin.email, 'ADMIN_ADJUSTMENT', `${direction} ${amount} ${symbol} for user ${userId}: ${reason}`);

  return ok({ success: true, ledgerTxId: result.ledgerTxId, message: `${direction === 'CREDIT' ? 'Credited' : 'Debited'} ${amount} ${symbol}` });
});

export const runtime = 'nodejs';
