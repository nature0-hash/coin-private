import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { handler, ok, readJson, requireAdmin } from '@/lib/api';
import { postLedger, round8 } from '@/lib/ledger';
import { genReference } from '@/lib/session';
import { audit, notifyUser } from '@/lib/notify';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/admin/wallets/:id/set-balance
// Sets the requested wallet balances by posting the precise difference through
// the ledger. This preserves a complete client-visible audit trail rather
// than writing wallet amounts behind the ledger's back.
export const POST = handler<Ctx>(async (req: NextRequest, ctx) => {
  const manager = await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await readJson<{ available?: number; reserved?: number; reason?: string; fundingSource?: string }>(req);

  const wallet = await db.wallet.findUnique({ where: { id }, include: { user: true } });
  if (!wallet) return ok({ error: 'Wallet not found' }, { status: 404 });

  const available = Number(body.available);
  const reserved = body.reserved === undefined ? wallet.reserved : Number(body.reserved);
  const reason = (body.reason ?? '').trim();
  const fundingSource = (body.fundingSource ?? '').trim();
  if (!Number.isFinite(available) || available < 0) return ok({ error: 'Available balance must be zero or greater' }, { status: 422 });
  if (!Number.isFinite(reserved) || reserved < 0) return ok({ error: 'Reserved balance must be zero or greater' }, { status: 422 });
  if (reason.length < 3 || reason.length > 500) return ok({ error: 'A 3 to 500 character reason is required' }, { status: 422 });
  if (fundingSource.length > 240) return ok({ error: 'Funding source is too long' }, { status: 422 });

  const targetAvailable = round8(available);
  const targetReserved = round8(reserved);
  const availableDelta = round8(targetAvailable - wallet.available);
  const reservedDelta = round8(targetReserved - wallet.reserved);
  if (Math.abs(availableDelta) < 1e-9 && Math.abs(reservedDelta) < 1e-9) return ok({ error: 'The wallet already has those balances' }, { status: 422 });

  const lines = [] as Array<{ walletId: string; direction: 'DEBIT' | 'CREDIT'; amount: number; memo: string; from?: 'available' | 'reserved'; to?: 'available' | 'reserved' }>;
  if (Math.abs(availableDelta) >= 1e-9) {
    lines.push({
      walletId: wallet.id,
      direction: availableDelta > 0 ? 'CREDIT' : 'DEBIT',
      amount: Math.abs(availableDelta),
      ...(availableDelta > 0 ? { to: 'available' as const } : { from: 'available' as const }),
      memo: `Management set available balance to ${targetAvailable} ${wallet.assetSymbol}`,
    });
  }
  if (Math.abs(reservedDelta) >= 1e-9) {
    lines.push({
      walletId: wallet.id,
      direction: reservedDelta > 0 ? 'CREDIT' : 'DEBIT',
      amount: Math.abs(reservedDelta),
      ...(reservedDelta > 0 ? { to: 'reserved' as const } : { from: 'reserved' as const }),
      memo: `Management set reserved balance to ${targetReserved} ${wallet.assetSymbol}`,
    });
  }

  const sourceText = fundingSource ? ` Received from: ${fundingSource}.` : '';
  const result = await postLedger({
    type: 'ADJUSTMENT',
    userId: wallet.userId,
    reference: genReference('SET'),
    description: `Wallet balance set by Management for ${wallet.assetSymbol}.${sourceText}`,
    meta: {
      operation: 'BALANCE_SET', by: manager.email, reason, fundingSource: fundingSource || null,
      previous: { available: wallet.available, reserved: wallet.reserved },
      target: { available: targetAvailable, reserved: targetReserved },
    },
    lines,
  });

  const sourceNotice = fundingSource ? ` Credited by / source: ${fundingSource}.` : '';
  await notifyUser(wallet.userId, 'SYSTEM', 'Wallet balance updated', `${wallet.assetSymbol} balance was set by Management. Available: ${targetAvailable}; reserved: ${targetReserved}. Reason: ${reason}.${sourceNotice}`);
  await audit(manager.id, manager.email, 'MANAGEMENT_WALLET_BALANCE_SET', `${wallet.user.email} ${wallet.assetSymbol}: available ${wallet.available}→${targetAvailable}, reserved ${wallet.reserved}→${targetReserved}; ${reason}; source=${fundingSource || '-'}`);

  return ok({
    success: true,
    ledgerTxId: result.ledgerTxId,
    message: `${wallet.assetSymbol} wallet updated to ${targetAvailable} available and ${targetReserved} reserved`,
  });
});

export const runtime = 'nodejs';
