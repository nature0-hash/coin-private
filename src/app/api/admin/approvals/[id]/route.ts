import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok, readJson } from '@/lib/api';
import { postLedger } from '@/lib/ledger';
import { genReference } from '@/lib/session';
import { audit, notifyUser } from '@/lib/notify';
import { executeHeldOrder, releaseHeldOrder } from '@/lib/trade';

type Ctx = { params: Promise<{ id: string }> };

// POST /api/admin/approvals/[id]: decide an approval
export const POST = handler<Ctx>(async (req: NextRequest, ctx) => {
  const admin = await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await readJson<{ decision?: 'APPROVED' | 'REJECTED'; note?: string }>(req);
  const decision: 'APPROVED' | 'REJECTED' | undefined = body.decision;
  const note = (body.note ?? '').trim();

  if (decision !== 'APPROVED' && decision !== 'REJECTED') return ok({ error: 'Decision must be APPROVED or REJECTED' }, { status: 422 });

  const approval = await db.approval.findUnique({ where: { id } });
  if (!approval) return ok({ error: 'Approval not found' }, { status: 404 });
  if (approval.status !== 'PENDING') return ok({ error: `Already ${approval.status.toLowerCase()}` }, { status: 409 });
  const claim = await db.approval.updateMany({
    where: { id, status: 'PENDING' },
    data: { status: 'PROCESSING' },
  });
  if (claim.count !== 1) return ok({ error: 'This approval is already being processed' }, { status: 409 });

  const payload = JSON.parse(approval.payload || '{}');

  try {
    if (approval.type === 'DEPOSIT') {
      if (decision === 'APPROVED') {
        const wallet = await db.wallet.findUnique({
          where: { userId_assetSymbol: { userId: approval.userId!, assetSymbol: approval.assetSymbol! } },
        });
        if (!wallet) throw new Error('User wallet missing');
        const ref = genReference('DEP');
        const ledger = await postLedger({
          type: 'DEPOSIT', userId: approval.userId, reference: ref,
          description: 'Crypto deposit (approved)',
          meta: { approvalId: approval.id, method: payload.method ?? 'CRYPTO' },
          lines: [{ walletId: wallet.id, direction: 'CREDIT', amount: approval.amount, memo: 'Crypto deposit credited' }],
        });
        await db.$transaction([
          db.depositRequest.updateMany({ where: { reference: approval.reference }, data: { status: 'APPROVED', decidedBy: admin.email, decidedAt: new Date(), ledgerTxId: ledger.ledgerTxId } }),
          db.approval.update({ where: { id }, data: { status: 'APPROVED', decidedBy: admin.email, decisionNote: note || null, decidedAt: new Date() } }),
        ]);
        await notifyUser(approval.userId!, 'DEPOSIT', 'Deposit approved', `${approval.amount} ${approval.assetSymbol} has been credited to your wallet.`);
      } else {
        await db.$transaction([
          db.depositRequest.updateMany({ where: { reference: approval.reference }, data: { status: 'REJECTED', decidedBy: admin.email, decidedAt: new Date() } }),
          db.approval.update({ where: { id }, data: { status: 'REJECTED', decidedBy: admin.email, decisionNote: note || null, decidedAt: new Date() } }),
        ]);
        await notifyUser(approval.userId!, 'DEPOSIT', 'Deposit rejected', `Your ${approval.amount} ${approval.assetSymbol} deposit was rejected. ${note}`);
      }
    } else if (approval.type === 'WITHDRAWAL') {
      const withdrawal = await db.withdrawalRequest.findFirst({ where: { reference: approval.reference } });
      if (!withdrawal) throw new Error('Withdrawal record missing');
      const holdTx = await db.ledgerTransaction.findUnique({ where: { id: withdrawal.ledgerTxId ?? '' }, include: { entries: true } });
      const holdEntry = holdTx?.entries[0];
      if (!holdEntry) throw new Error('Withdrawal hold missing');
      const wallet = await db.wallet.findUnique({ where: { id: holdEntry.walletId! } });
      if (!wallet) throw new Error('Wallet missing');

      if (decision === 'APPROVED') {
        // settle: reserved funds leave the platform
        const ref = genReference('WDR');
        const ledger = await postLedger({
          type: 'WITHDRAWAL', userId: withdrawal.userId, reference: ref,
          description: `Withdrawal sent: ${withdrawal.amount} ${withdrawal.assetSymbol}`,
          meta: { approvalId: approval.id, address: withdrawal.address, fee: withdrawal.fee },
          lines: [{ walletId: wallet.id, direction: 'DEBIT', from: 'reserved', amount: holdEntry.amount, memo: `Withdrawal to ${withdrawal.address.slice(0, 12)}…` }],
        });
        await db.$transaction([
          db.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: 'APPROVED', decidedBy: admin.email, decidedAt: new Date(), ledgerTxId: ledger.ledgerTxId } }),
          db.approval.update({ where: { id }, data: { status: 'APPROVED', decidedBy: admin.email, decisionNote: note || null, decidedAt: new Date() } }),
        ]);
        await notifyUser(withdrawal.userId, 'WITHDRAWAL', 'Withdrawal sent', `${withdrawal.amount} ${withdrawal.assetSymbol} has been sent to ${withdrawal.address.slice(0, 12)}…`);
      } else {
        // release hold back to available (reserved → available transition)
        await postLedger({
          type: 'ADJUSTMENT', userId: withdrawal.userId, reference: genReference('RLS'),
          description: `Withdrawal rejected: hold released (${approval.reference})`,
          meta: { releaseOf: approval.reference },
          lines: [{ walletId: wallet.id, direction: 'CREDIT', from: 'reserved', to: 'available', amount: holdEntry.amount, memo: 'Withdrawal hold released' }],
        });
        await db.$transaction([
          db.withdrawalRequest.update({ where: { id: withdrawal.id }, data: { status: 'REJECTED', decidedBy: admin.email, decidedAt: new Date() } }),
          db.approval.update({ where: { id }, data: { status: 'REJECTED', decidedBy: admin.email, decisionNote: note || null, decidedAt: new Date() } }),
        ]);
        await notifyUser(withdrawal.userId, 'WITHDRAWAL', 'Withdrawal rejected', `Your ${withdrawal.amount} ${withdrawal.assetSymbol} withdrawal was rejected and the funds are back in your balance. ${note}`);
      }
    } else if (approval.type === 'RISK_TRADE') {
      if (decision === 'APPROVED') {
        await executeHeldOrder(payload.orderId);
        await db.approval.update({ where: { id }, data: { status: 'APPROVED', decidedBy: admin.email, decisionNote: note || null, decidedAt: new Date() } });
      } else {
        await releaseHeldOrder(payload.orderId, note || 'Rejected by compliance.');
        await db.approval.update({ where: { id }, data: { status: 'REJECTED', decidedBy: admin.email, decisionNote: note || null, decidedAt: new Date() } });
      }
    } else {
      throw new Error('Unknown approval type');
    }

    await audit(admin.id, admin.email, `ADMIN_APPROVAL_${decision}`, `${approval.type} ${approval.reference}: ${note || 'no note'}`);
    return ok({ success: true, message: `${approval.type} ${decision.toLowerCase()}` });
  } catch (e) {
    await db.approval.updateMany({
      where: { id, status: 'PROCESSING' },
      data: { status: 'PENDING' },
    });
    const msg = e instanceof Error ? e.message : 'Approval failed';
    return ok({ error: msg }, { status: 422 });
  }
});

export const runtime = 'nodejs';
