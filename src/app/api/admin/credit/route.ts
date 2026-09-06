import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok, readJson } from '@/lib/api';
import { postLedger } from '@/lib/ledger';
import { genReference } from '@/lib/session';
import { audit, notifyUser } from '@/lib/notify';

// POST /api/admin/credit: post a manual adjustment through the atomic ledger.
// The customer-facing label describes the real direction of the wallet change;
// management identity remains in the private audit trail.
export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body = await readJson<{ userId?: string; symbol?: string; amount?: number; direction?: 'CREDIT' | 'DEBIT'; reason?: string; customerLabel?: string }>(req);

  const userId = body.userId ?? '';
  const symbol = (body.symbol ?? '').toUpperCase();
  const amount = Number(body.amount ?? 0);
  const direction = body.direction === 'DEBIT' ? 'DEBIT' : 'CREDIT';
  const reason = (body.reason ?? '').trim();
  const requestedLabel = (body.customerLabel ?? '').trim().toUpperCase();
  const allowedLabels = direction === 'CREDIT'
    ? ['RECEIVED', 'WALLET_CREDIT', 'BONUS_CREDIT']
    : ['WALLET_DEBIT', 'SERVICE_FEE'];
  const customerLabel = requestedLabel || (direction === 'CREDIT' ? 'RECEIVED' : 'WALLET_DEBIT');
  if (!userId) return ok({ error: 'User required' }, { status: 422 });
  if (!symbol) return ok({ error: 'Asset required' }, { status: 422 });
  if (!(amount > 0)) return ok({ error: 'Amount must be positive' }, { status: 422 });
  if (reason.length < 3) return ok({ error: 'A reason is required' }, { status: 422 });
  if (!allowedLabels.includes(customerLabel)) return ok({ error: 'Choose a label that matches the credit or debit' }, { status: 422 });

  const wallet = await db.wallet.findUnique({ where: { userId_assetSymbol: { userId, assetSymbol: symbol } } });
  if (!wallet) return ok({ error: `User has no ${symbol} wallet` }, { status: 422 });

  if (direction === 'DEBIT' && wallet.available + 1e-9 < amount) {
    return ok({ error: 'User has insufficient available balance for this debit' }, { status: 422 });
  }

  const result = await postLedger({
    type: 'ADJUSTMENT',
    userId,
    reference: genReference('ADJ'),
    description: `${labelText(customerLabel)} ${symbol}`,
    meta: { by: admin.email, reason, customerLabel },
    lines: [{ walletId: wallet.id, direction, amount, memo: reason }],
  });

  await notifyUser(userId, 'SYSTEM', labelText(customerLabel), `${amount} ${symbol} was ${direction === 'CREDIT' ? 'added to' : 'removed from'} your wallet. Reason: ${reason}`);
  await audit(admin.id, admin.email, 'ADMIN_ADJUSTMENT', `${direction} ${amount} ${symbol} for user ${userId}: ${reason}`);

  return ok({ success: true, ledgerTxId: result.ledgerTxId, message: `${labelText(customerLabel)} ${amount} ${symbol}` });
});

function labelText(label: string): string {
  return label === 'RECEIVED' ? 'Received'
    : label === 'WALLET_CREDIT' ? 'Wallet credit'
      : label === 'BONUS_CREDIT' ? 'Bonus credit'
        : label === 'SERVICE_FEE' ? 'Service fee'
          : 'Wallet debit';
}

export const runtime = 'nodejs';
