import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, handler, ok, readJson } from '@/lib/api';
import { postLedger, LedgerError } from '@/lib/ledger';
import { genReference } from '@/lib/session';
import { getNumber } from '@/lib/settings';
import { audit, notifyUser } from '@/lib/notify';
import { getPriceSnapshot } from '@/lib/prices';
import { round8 } from '@/lib/ledger';

// POST /api/send: send crypto to an external address or another
// Coin Private user (detected by wallet address → instant internal credit).
export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await readJson<{ symbol?: string; amount?: number; toAddress?: string; memo?: string }>(req);

  const symbol = (body.symbol ?? '').toUpperCase();
  const amount = Number(body.amount ?? 0);
  const toAddress = (body.toAddress ?? '').trim();
  if (!symbol) return ok({ error: 'Choose an asset to send' }, { status: 422 });
  if (!(amount > 0)) return ok({ error: 'Enter an amount' }, { status: 422 });
  if (toAddress.length < 8) return ok({ error: 'Enter a valid destination address' }, { status: 422 });

  const asset = await db.asset.findUnique({ where: { symbol } });
  if (!asset || asset.kind !== 'CRYPTO') return ok({ error: 'Only crypto assets can be sent' }, { status: 422 });

  const wallet = await db.wallet.findUnique({ where: { userId_assetSymbol: { userId: user.id, assetSymbol: symbol } } });
  if (!wallet) return ok({ error: `You need a ${symbol} wallet` }, { status: 422 });

  const sendFeePct = await getNumber('transfer.sendFeePercent', 0.1);
  const snap = await getPriceSnapshot();
  const price = snap.quotes[symbol]?.price ?? asset.priceUsd;
  const feePctValue = round8(amount * (sendFeePct / 100));
  const totalDebit = round8(amount + feePctValue);
  const usdValue = round8(amount * price);

  if (wallet.available + 1e-9 < totalDebit) {
    return ok({ error: `Insufficient ${symbol} balance (amount + network fee)` }, { status: 422 });
  }

  // fee wallet (USD) if fee is charged in USD units: we charge in the sent asset here
  const reference = genReference('SND');

  // Internal transfer? destination wallet exists on-platform
  const destWallet = await db.wallet.findUnique({ where: { address: toAddress }, include: { user: true } });

  try {
    if (destWallet && destWallet.userId !== user.id) {
      // INTERNAL: one atomic ledger tx: debit sender, credit recipient
      const result = await postLedger({
        type: 'SEND',
        userId: user.id,
        reference,
        description: `Sent ${amount} ${symbol} to ${destWallet.user.name}`,
        meta: { toAddress, internal: true, destUserId: destWallet.userId, memo: body.memo ?? null },
        lines: [
          { walletId: wallet.id, direction: 'DEBIT', amount: totalDebit, memo: `Send ${symbol}` },
          { walletId: destWallet.id, direction: 'CREDIT', amount, memo: `Receive ${symbol} from ${user.name}` },
        ],
      });
      const transfer = await db.transfer.create({
        data: {
          userId: user.id, reference, kind: 'INTERNAL', assetSymbol: symbol,
          amount, fee: feePctValue, toAddress, toUserId: destWallet.userId,
          memo: body.memo ?? null, status: 'POSTED', ledgerTxId: result.ledgerTxId,
        },
      });
      await notifyUser(destWallet.userId, 'RECEIVE', `Received ${amount} ${symbol}`, `${user.name} sent you ${amount} ${symbol}. It's available in your wallet now.`);
      await audit(user.id, user.email, 'SEND', `Internal send ${amount} ${symbol} → ${destWallet.user.email}`);
      return ok({ transfer, message: `Sent ${amount} ${symbol} to ${destWallet.user.name}` });
    }

    // Do not debit a customer or invent a network hash when no blockchain
    // connector is configured. On-platform wallet transfers remain available.
    void usdValue;
    return ok({ error: 'External sends are unavailable until a blockchain network connector is configured' }, { status: 422 });
  } catch (e) {
    if (e instanceof LedgerError && e.code === 'INSUFFICIENT_FUNDS') {
      return ok({ error: 'Insufficient balance' }, { status: 422 });
    }
    throw e;
  }
});

// GET /api/send: recent transfers for the send screen
export const GET = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const transfers = await db.transfer.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return ok({ transfers });
});

export const runtime = 'nodejs';
