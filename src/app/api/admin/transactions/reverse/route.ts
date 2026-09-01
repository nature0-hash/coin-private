import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok, readJson } from '@/lib/api';
import { reverseLedger, LedgerError } from '@/lib/ledger';
import { audit, notifyUser } from '@/lib/notify';

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body = await readJson<{ ledgerTxId?: string; reason?: string }>(req);
  if (!body.ledgerTxId) return ok({ error: 'Ledger transaction id required' }, { status: 422 });
  if (!body.reason || body.reason.trim().length < 3) return ok({ error: 'A reason is required to reverse a transaction' }, { status: 422 });

  try {
    const result = await reverseLedger(body.ledgerTxId, admin.email, body.reason.trim());
    const original = await db.ledgerTransaction.findUnique({ where: { id: body.ledgerTxId } });
    if (original?.userId) {
      await notifyUser(original.userId, 'SYSTEM', 'Transaction reversed', `${original.reference} was reversed by the platform. Reason: ${body.reason}`);
    }
    await audit(admin.id, admin.email, 'ADMIN_REVERSE', `${body.ledgerTxId} → ${result.reference}: ${body.reason}`);
    return ok({ success: true, reversalReference: result.reference, message: `Reversed as ${result.reference}` });
  } catch (e) {
    if (e instanceof LedgerError) return ok({ error: e.message }, { status: 422 });
    throw e;
  }
});

export const runtime = 'nodejs';
