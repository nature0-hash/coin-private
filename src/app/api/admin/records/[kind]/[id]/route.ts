import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { HttpError, handler, ok, readJson, requireAdmin } from '@/lib/api';
import { audit, notifyUser } from '@/lib/notify';

type Ctx = { params: Promise<{ kind: string; id: string }> };
type ChangeMap = Record<string, { from: string | null; to: string | null }>;

function optionalText(value: unknown, label: string, max: number): string | null | undefined {
  if (value === undefined) return undefined;
  if (value === null) return null;
  if (typeof value !== 'string') throw new HttpError(422, `${label} must be text`);
  const text = value.trim();
  if (text.length > max) throw new HttpError(422, `${label} is too long`);
  return text || null;
}

function requiredText(value: unknown, label: string, max: number): string {
  const text = optionalText(value, label, max);
  if (!text || text.length < 3) throw new HttpError(422, `${label} must be at least 3 characters`);
  return text;
}

function parseMeta(raw: string | null): Record<string, unknown> {
  try {
    const value = JSON.parse(raw ?? '{}');
    return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

async function logEdit(input: {
  userId: string | null;
  recordType: string;
  recordId: string;
  changes: ChangeMap;
  reason: string;
  editedBy: string;
}) {
  return db.transactionEditLog.create({
    data: { ...input, changes: JSON.stringify(input.changes) },
  });
}

// PATCH /api/admin/records/:kind/:id
// This endpoint only changes non-financial operational details. Amounts,
// prices, ledger lines and posted destination addresses stay immutable.
export const PATCH = handler<Ctx>(async (req: NextRequest, ctx) => {
  const manager = await requireAdmin(req);
  const { kind: rawKind, id } = await ctx.params;
  const kind = rawKind.toUpperCase();
  const body = await readJson<Record<string, unknown>>(req);
  const reason = requiredText(body.reason, 'Reason', 500);

  if (kind === 'DEPOSIT') {
    const record = await db.depositRequest.findUnique({ where: { id } });
    if (!record) return ok({ error: 'Deposit not found' }, { status: 404 });
    const sourceAddress = optionalText(body.sourceAddress, 'Source address', 240);
    const sourceReference = optionalText(body.sourceReference, 'Source reference', 240);
    const note = optionalText(body.note, 'Note', 500);
    const data: { sourceAddress?: string | null; sourceReference?: string | null; note?: string | null } = {};
    const changes: ChangeMap = {};
    if (sourceAddress !== undefined && sourceAddress !== record.sourceAddress) { data.sourceAddress = sourceAddress; changes.sourceAddress = { from: record.sourceAddress, to: sourceAddress }; }
    if (sourceReference !== undefined && sourceReference !== record.sourceReference) { data.sourceReference = sourceReference; changes.sourceReference = { from: record.sourceReference, to: sourceReference }; }
    if (note !== undefined && note !== record.note) { data.note = note; changes.note = { from: record.note, to: note }; }
    if (!Object.keys(data).length) return ok({ error: 'No deposit details changed' }, { status: 422 });
    await db.depositRequest.update({ where: { id }, data });
    await logEdit({ userId: record.userId, recordType: 'DEPOSIT', recordId: id, changes, reason, editedBy: manager.email });
    await audit(manager.id, manager.email, 'MANAGEMENT_DEPOSIT_DETAILS', `${record.reference}: ${JSON.stringify(changes)}; ${reason}`);
    await notifyUser(record.userId, 'SYSTEM', 'Deposit details corrected', `${record.reference} received an operational-details correction. Reason: ${reason}`);
    return ok({ success: true, message: 'Deposit details saved and audited' });
  }

  if (kind === 'WITHDRAWAL') {
    const record = await db.withdrawalRequest.findUnique({ where: { id } });
    if (!record) return ok({ error: 'Withdrawal not found' }, { status: 404 });
    if (record.status !== 'PENDING') return ok({ error: 'Only pending withdrawals can have destination details changed' }, { status: 422 });
    const address = optionalText(body.address, 'Destination address', 240);
    const note = optionalText(body.note, 'Note', 500);
    if (address !== undefined && !address) return ok({ error: 'Destination address cannot be blank' }, { status: 422 });
    const data: { address?: string; note?: string | null } = {};
    const changes: ChangeMap = {};
    if (address !== undefined && address !== record.address) { data.address = address; changes.address = { from: record.address, to: address }; }
    if (note !== undefined && note !== record.note) { data.note = note; changes.note = { from: record.note, to: note }; }
    if (!Object.keys(data).length) return ok({ error: 'No withdrawal details changed' }, { status: 422 });
    await db.withdrawalRequest.update({ where: { id }, data });
    await logEdit({ userId: record.userId, recordType: 'WITHDRAWAL', recordId: id, changes, reason, editedBy: manager.email });
    await audit(manager.id, manager.email, 'MANAGEMENT_WITHDRAWAL_DETAILS', `${record.reference}: ${JSON.stringify(changes)}; ${reason}`);
    await notifyUser(record.userId, 'SYSTEM', 'Withdrawal details corrected', `${record.reference} received an operational-details correction before approval. Reason: ${reason}`);
    return ok({ success: true, message: 'Pending withdrawal details saved and audited' });
  }

  if (kind === 'TRANSFER') {
    const record = await db.transfer.findUnique({ where: { id } });
    if (!record) return ok({ error: 'Transfer not found' }, { status: 404 });
    if (record.status !== 'PENDING') return ok({ error: 'Only pending transfers can have destination details changed' }, { status: 422 });
    const toAddress = optionalText(body.toAddress, 'Destination address', 240);
    const memo = optionalText(body.memo, 'Memo', 500);
    if (toAddress !== undefined && !toAddress) return ok({ error: 'Destination address cannot be blank' }, { status: 422 });
    const data: { toAddress?: string; memo?: string | null } = {};
    const changes: ChangeMap = {};
    if (toAddress !== undefined && toAddress !== record.toAddress) { data.toAddress = toAddress; changes.toAddress = { from: record.toAddress, to: toAddress }; }
    if (memo !== undefined && memo !== record.memo) { data.memo = memo; changes.memo = { from: record.memo, to: memo }; }
    if (!Object.keys(data).length) return ok({ error: 'No transfer details changed' }, { status: 422 });
    await db.transfer.update({ where: { id }, data });
    await logEdit({ userId: record.userId, recordType: 'TRANSFER', recordId: id, changes, reason, editedBy: manager.email });
    await audit(manager.id, manager.email, 'MANAGEMENT_TRANSFER_DETAILS', `${record.reference}: ${JSON.stringify(changes)}; ${reason}`);
    await notifyUser(record.userId, 'SYSTEM', 'Transfer details corrected', `${record.reference} received an operational-details correction before posting. Reason: ${reason}`);
    return ok({ success: true, message: 'Pending transfer details saved and audited' });
  }

  if (kind === 'LEDGER') {
    const record = await db.ledgerTransaction.findUnique({ where: { id } });
    if (!record) return ok({ error: 'Ledger transaction not found' }, { status: 404 });
    const note = requiredText(body.correctionNote, 'Correction note', 500);
    const meta = parseMeta(record.meta);
    const corrections = Array.isArray(meta.corrections) ? meta.corrections : [];
    const correction = { note, reason, by: manager.email, at: new Date().toISOString() };
    meta.corrections = [...corrections, correction].slice(-20);
    await db.$transaction([
      db.ledgerTransaction.update({ where: { id }, data: { meta: JSON.stringify(meta) } }),
      db.transactionEditLog.create({
        data: {
          userId: record.userId,
          recordType: 'LEDGER',
          recordId: id,
          changes: JSON.stringify({ correctionNote: { from: null, to: note } }),
          reason,
          editedBy: manager.email,
        },
      }),
    ]);
    await audit(manager.id, manager.email, 'MANAGEMENT_LEDGER_CORRECTION', `${record.reference}: ${note}; ${reason}`);
    if (record.userId) await notifyUser(record.userId, 'SYSTEM', 'Transaction correction note', `${record.reference} has a correction note. Reason: ${reason}`);
    return ok({ success: true, message: 'Correction note attached and audited' });
  }

  return ok({ error: 'Unsupported record type' }, { status: 422 });
});

export const runtime = 'nodejs';
