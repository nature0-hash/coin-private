import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, handler, ok, readJson } from '@/lib/api';
import { postLedger } from '@/lib/ledger';
import { genReference } from '@/lib/session';
import { audit, notifyAdmins, notifyUser } from '@/lib/notify';
import { getNumber } from '@/lib/settings';
import { round8 } from '@/lib/ledger';

// POST /api/deposits
// BANK / CARD → instant settlement posted through the atomic ledger
// (clearly labeled "instant demo rail"). CRYPTO → pending admin
// approval (real pending state: no fake confirmations).
export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await readJson<{ symbol?: string; amount?: number; method?: string }>(req);

  const symbol = (body.symbol ?? 'USD').toUpperCase();
  const amount = Number(body.amount ?? 0);
  const method = (body.method ?? 'BANK').toUpperCase();
  if (!(amount > 0)) return ok({ error: 'Enter an amount' }, { status: 422 });
  if (!['BANK', 'CARD', 'CRYPTO'].includes(method)) return ok({ error: 'Choose a deposit method' }, { status: 422 });

  const asset = await db.asset.findUnique({ where: { symbol } });
  if (!asset) return ok({ error: 'Unknown asset' }, { status: 422 });

  const wallet = await db.wallet.findUnique({ where: { userId_assetSymbol: { userId: user.id, assetSymbol: symbol } } });
  if (!wallet) return ok({ error: `Missing ${symbol} wallet` }, { status: 422 });

  const minDeposit = await getNumber('deposit.minUsd', 10);
  if (amount * (asset.priceUsd || 1) < minDeposit) return ok({ error: `Minimum deposit is $${minDeposit.toFixed(2)}` }, { status: 422 });

  const reference = genReference(method === 'CRYPTO' ? 'DEPC' : 'DEP');

  if (method === 'CRYPTO') {
    const deposit = await db.depositRequest.create({
      data: { userId: user.id, reference, assetSymbol: symbol, amount, method, status: 'PENDING' },
    });
    await db.approval.create({
      data: {
        type: 'DEPOSIT', reference, userId: user.id, amount, assetSymbol: symbol,
        payload: JSON.stringify({ depositId: deposit.id, method }),
        requestedBy: user.id,
      },
    });
    await notifyAdmins('DEPOSIT', 'Crypto deposit pending', `${user.name} requested a ${amount} ${symbol} deposit: approval required.`);
    await audit(user.id, user.email, 'DEPOSIT', `Requested ${amount} ${symbol} crypto deposit`);
    return ok({ deposit, message: 'Deposit submitted: it will credit after approval (typically minutes).', pending: true });
  }

  // BANK / CARD: instant demo rail, posted atomically
  const result = await postLedger({
    type: 'DEPOSIT',
    userId: user.id,
    reference,
    description: `${method === 'BANK' ? 'Bank transfer' : 'Card'} deposit (instant rail)`,
    meta: { method },
    lines: [{ walletId: wallet.id, direction: 'CREDIT', amount, memo: `${method} deposit` }],
  });
  const deposit = await db.depositRequest.create({
    data: { userId: user.id, reference, assetSymbol: symbol, amount, method, status: 'APPROVED', decidedBy: 'system:auto-rail', decidedAt: new Date(), ledgerTxId: result.ledgerTxId },
  });
  await notifyUser(user.id, 'DEPOSIT', 'Deposit credited', `$${amount.toFixed(2)} deposited via ${method === 'BANK' ? 'bank transfer' : 'card'}: available now.`);
  await audit(user.id, user.email, 'DEPOSIT', `${method} deposit $${amount}`);
  return ok({ deposit, message: `$${amount.toFixed(2)} credited to your ${symbol} balance`, pending: false });
});

// GET /api/deposits: user's deposit history
export const GET = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const deposits = await db.depositRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 50 });
  return ok({ deposits });
});

export const runtime = 'nodejs';
void round8; void notifyUser;
