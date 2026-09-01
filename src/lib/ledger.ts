// ============================================================
// Coin Private: Atomic Ledger Engine
// ============================================================
// ALL money movements go through postLedger(). Wallet balances
// are ONLY mutated here, inside a single Prisma interactive
// transaction together with the LedgerTransaction + LedgerEntry
// rows. There is no code path anywhere in the app that writes
// wallet.available / wallet.reserved directly.
//
// Guarantees:
//   • Atomicity: balance update + entries commit or roll back together
//   • Traceability: every wallet mutation has a persisted ledger entry
//   • Sufficient-funds: debits re-check balance INSIDE the transaction
//   • Reserved funds: withdrawals hold funds before approval
// ============================================================
import { db } from '@/lib/db';
import { Prisma, PrismaClient } from '@prisma/client';

type Tx = Prisma.TransactionClient | PrismaClient;

export type LedgerDirection = 'DEBIT' | 'CREDIT';

export interface LedgerLine {
  walletId: string;
  direction: LedgerDirection;
  amount: number;
  memo?: string;
  /** debit source: 'available' (default) or 'reserved' (release a hold) */
  from?: 'available' | 'reserved';
  /** credit target: 'available' (default) or 'reserved' (create a hold) */
  to?: 'available' | 'reserved';
}

export interface PostLedgerInput {
  type:
    | 'BUY' | 'SELL' | 'CONVERT' | 'DEPOSIT' | 'WITHDRAWAL'
    | 'SEND' | 'RECEIVE' | 'FEE' | 'BONUS' | 'ADJUSTMENT' | 'REVERSAL';
  userId?: string | null;
  reference: string;
  description: string;
  meta?: Record<string, unknown>;
  lines: LedgerLine[];
}

export class LedgerError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

/**
 * Post a ledger transaction atomically.
 * Throws LedgerError with code INSUFFICIENT_FUNDS / WALLET_NOT_FOUND on failure.
 */
export async function postLedger(input: PostLedgerInput): Promise<{ ledgerTxId: string; reference: string }> {
  return db.$transaction(async (tx) => postLedgerInTx(tx, input), { timeout: 15000 });
}

/**
 * Core posting routine: usable inside an existing interactive
 * transaction (e.g. when creating an Order row in the same commit).
 */
export async function postLedgerInTx(tx: Tx, input: PostLedgerInput): Promise<{ ledgerTxId: string; reference: string }> {
  if (!input.lines.length) throw new LedgerError('EMPTY', 'Ledger transaction needs at least one line');

  const ledgerTx = await tx.ledgerTransaction.create({
    data: {
      reference: input.reference,
      type: input.type,
      userId: input.userId ?? null,
      description: input.description,
      meta: JSON.stringify(input.meta ?? {}),
      status: 'POSTED',
      postedAt: new Date(),
    },
  });

  for (const line of input.lines) {
    if (!(line.amount > 0)) throw new LedgerError('BAD_AMOUNT', 'Ledger amounts must be positive');
    const wallet = await tx.wallet.findUnique({ where: { id: line.walletId } });
    if (!wallet) throw new LedgerError('WALLET_NOT_FOUND', `Wallet ${line.walletId} not found`);

    const data: { available?: number; reserved?: number } = {};
    let bucketBefore: number;
    let bucketAfter: number;

    if (line.direction === 'DEBIT') {
      // Funds leave the `from` bucket (default available).
      const fromBucket = line.from ?? 'available';
      bucketBefore = fromBucket === 'reserved' ? wallet.reserved : wallet.available;
      bucketAfter = round8(bucketBefore - line.amount);
      if (bucketAfter < -1e-9) {
        throw new LedgerError('INSUFFICIENT_FUNDS', `Insufficient ${wallet.assetSymbol} balance`);
      }
      data[fromBucket] = bucketAfter;
      if (line.to && line.to !== fromBucket) {
        // Bucket transition on the same wallet (e.g. available → reserved hold):
        // the amount reappears in the destination bucket.
        data[line.to] = round8((line.to === 'reserved' ? wallet.reserved : wallet.available) + line.amount);
      }
    } else {
      // Funds enter the `to` bucket (default available).
      const toBucket = line.to ?? 'available';
      bucketBefore = toBucket === 'reserved' ? wallet.reserved : wallet.available;
      bucketAfter = round8(bucketBefore + line.amount);
      data[toBucket] = bucketAfter;
      if (line.from && line.from !== toBucket) {
        // Bucket transition on the same wallet (e.g. reserved → available release):
        // the amount leaves the source bucket.
        const sourceBefore = line.from === 'reserved' ? wallet.reserved : wallet.available;
        const sourceAfter = round8(sourceBefore - line.amount);
        if (sourceAfter < -1e-9) {
          throw new LedgerError('INSUFFICIENT_FUNDS', `Insufficient ${wallet.assetSymbol} balance`);
        }
        data[line.from] = sourceAfter;
      }
    }

    await tx.wallet.update({ where: { id: wallet.id }, data });

    await tx.ledgerEntry.create({
      data: {
        ledgerTxId: ledgerTx.id,
        walletId: wallet.id,
        assetSymbol: wallet.assetSymbol,
        direction: line.direction,
        amount: line.amount,
        balanceBefore: bucketBefore,
        balanceAfter: bucketAfter,
        memo: line.memo ?? null,
      },
    });
  }

  return { ledgerTxId: ledgerTx.id, reference: input.reference };
}

/**
 * Reverse a previously posted ledger transaction atomically:
// creates a REVERSAL ledger tx with mirrored lines and marks the
 * original REVERSED.
 */
export async function reverseLedger(originalId: string, actor: string, reason: string) {
  return db.$transaction(async (tx) => {
    const original = await tx.ledgerTransaction.findUnique({
      where: { id: originalId },
      include: { entries: true },
    });
    if (!original) throw new LedgerError('NOT_FOUND', 'Ledger transaction not found');
    if (original.status === 'REVERSED') throw new LedgerError('ALREADY_REVERSED', 'Transaction already reversed');
    if (original.status !== 'POSTED') throw new LedgerError('NOT_POSTED', 'Only posted transactions can be reversed');

    const reversalRef = original.reference.replace(/^CP-/, 'CP-RV-') + '-' + Date.now().toString(36).toUpperCase();

    const reversal = await postLedgerInTx(tx, {
      type: 'REVERSAL',
      userId: original.userId,
      reference: reversalRef,
      description: `Reversal of ${original.reference}: ${reason}`,
      meta: { reversalOf: original.reference, actor, reason },
      lines: original.entries.map((e) => ({
        walletId: e.walletId as string,
        direction: e.direction === 'DEBIT' ? 'CREDIT' : 'DEBIT',
        amount: e.amount,
        memo: `Reversal: ${e.memo ?? original.description}`,
      })),
    });

    await tx.ledgerTransaction.update({
      where: { id: original.id },
      data: { status: 'REVERSED', reversalOfId: reversal.ledgerTxId },
    });

    return reversal;
  });
}

export function round8(n: number): number {
  return Math.round(n * 1e8) / 1e8;
}

/** Get or create a wallet for a user/asset (outside ledger: creation only). */
export async function ensureWallet(userId: string, assetSymbol: string, address: string, label?: string) {
  const existing = await db.wallet.findUnique({
    where: { userId_assetSymbol: { userId, assetSymbol } },
  });
  if (existing) return existing;
  return db.wallet.create({ data: { userId, assetSymbol, address, label } });
}
