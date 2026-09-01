import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, handler, ok } from '@/lib/api';

// GET /api/activity: unified activity feed for the signed-in user.
// Merges orders, transfers, deposits, withdrawals and ledger entries.
export const GET = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const url = new URL(req.url);
  const filter = url.searchParams.get('filter') ?? 'all';

  const [orders, transfers, deposits, withdrawals, ledgerTxs] = await Promise.all([
    filter === 'all' || filter === 'trades'
      ? db.order.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 60 })
      : Promise.resolve([]),
    filter === 'all' || filter === 'transfers'
      ? db.transfer.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 60 })
      : Promise.resolve([]),
    filter === 'all' || filter === 'deposits'
      ? db.depositRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 60 })
      : Promise.resolve([]),
    filter === 'all' || filter === 'withdrawals'
      ? db.withdrawalRequest.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 60 })
      : Promise.resolve([]),
    filter === 'ledger'
      ? db.ledgerTransaction.findMany({ where: { userId: user.id }, orderBy: { createdAt: 'desc' }, take: 100, include: { entries: true } })
      : Promise.resolve([]),
  ]);

  type Item = {
    id: string; kind: 'ORDER' | 'TRANSFER' | 'DEPOSIT' | 'WITHDRAWAL' | 'LEDGER';
    reference: string; title: string; subtitle: string; amount: number; symbol: string;
    status: string; type: string; createdAt: string; meta?: Record<string, unknown>;
  };

  const items: Item[] = [];

  for (const o of orders) {
    const isBuy = o.side === 'BUY';
    const isConvert = o.side === 'CONVERT';
    items.push({
      id: `ord-${o.id}`, kind: 'ORDER', reference: o.reference,
      title: isConvert ? `Converted to ${o.baseSymbol}` : isBuy ? `Bought ${o.baseSymbol}` : `Sold ${o.baseSymbol}`,
      subtitle: isConvert
        ? `via ${o.sourceSymbol ?? 'USD'} · @ $${o.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
        : `${o.amountBase} ${o.baseSymbol} @ $${o.price.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
      amount: isBuy || isConvert ? o.amountBase : o.amountQuote,
      symbol: isBuy || isConvert ? o.baseSymbol : 'USD',
      status: o.status === 'PENDING' ? 'PENDING' : o.status === 'FAILED' ? 'REJECTED' : 'COMPLETED',
      type: o.side, createdAt: o.createdAt.toISOString(),
      meta: { fee: o.fee, ledgerTxId: o.ledgerTxId },
    });
  }
  for (const t of transfers) {
    items.push({
      id: `trf-${t.id}`, kind: 'TRANSFER', reference: t.reference,
      title: t.kind === 'INTERNAL' ? 'Sent (internal)' : 'Sent',
      subtitle: `${t.amount} ${t.assetSymbol} → ${t.toAddress.slice(0, 14)}…`,
      amount: t.amount, symbol: t.assetSymbol, status: t.status === 'POSTED' ? 'COMPLETED' : t.status,
      type: 'SEND', createdAt: t.createdAt.toISOString(),
      meta: { txHash: t.txHash, memo: t.memo },
    });
  }
  for (const d of deposits) {
    items.push({
      id: `dep-${d.id}`, kind: 'DEPOSIT', reference: d.reference,
      title: 'Deposit',
      subtitle: d.method === 'CRYPTO' ? 'Crypto transfer' : d.method === 'BANK' ? 'Bank transfer (instant rail)' : 'Card (instant rail)',
      amount: d.amount, symbol: d.assetSymbol,
      status: d.status === 'APPROVED' ? 'COMPLETED' : d.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
      type: 'DEPOSIT', createdAt: d.createdAt.toISOString(),
    });
  }
  for (const w of withdrawals) {
    items.push({
      id: `wdr-${w.id}`, kind: 'WITHDRAWAL', reference: w.reference,
      title: 'Withdrawal',
      subtitle: `${w.amount} ${w.assetSymbol} → ${w.address.slice(0, 14)}…`,
      amount: w.amount, symbol: w.assetSymbol,
      status: w.status === 'APPROVED' ? 'COMPLETED' : w.status === 'REJECTED' ? 'REJECTED' : 'PENDING',
      type: 'WITHDRAWAL', createdAt: w.createdAt.toISOString(),
    });
  }
  for (const l of ledgerTxs) {
    items.push({
      id: `ldg-${l.id}`, kind: 'LEDGER', reference: l.reference,
      title: `Ledger · ${l.type}`,
      subtitle: `${l.entries.length} entr${l.entries.length === 1 ? 'y' : 'ies'} · ${l.description}`,
      amount: l.entries[0]?.amount ?? 0, symbol: l.entries[0]?.assetSymbol ?? 'USD',
      status: l.status === 'POSTED' ? 'COMPLETED' : l.status, type: l.type,
      createdAt: l.createdAt.toISOString(),
      meta: { entries: l.entries.map((e) => ({ direction: e.direction, amount: e.amount, symbol: e.assetSymbol, before: e.balanceBefore, after: e.balanceAfter })) },
    });
  }

  items.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  return ok({ items: items.slice(0, 120) });
});

export const runtime = 'nodejs';
