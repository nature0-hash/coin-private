// ============================================================
// Coin Private: Trade execution engine
// Market orders price against the live provider snapshot and
// settle through the atomic ledger. Large trades above the
// platform risk threshold are held (funds move available →
// reserved) and routed to the admin approval queue: no order
// pretends to be executed while it is actually pending.
// ============================================================
import { db } from '@/lib/db';
import { LedgerError, postLedger, postLedgerInTx, round8 } from '@/lib/ledger';
import { genReference } from '@/lib/session';
import { getPriceSnapshot } from '@/lib/prices';
import { getNumber } from '@/lib/settings';
import { Prisma } from '@prisma/client';
import { recordExecutedTrade, WelcomeMatchEvent } from '@/lib/welcome-match';

export interface TradeInput {
  userId: string;
  side: 'BUY' | 'SELL' | 'CONVERT';
  baseSymbol: string;      // asset bought (BUY), sold (SELL), or received (CONVERT)
  quoteSymbol?: string;    // fiat side for BUY/SELL (default USD)
  sourceSymbol?: string;   // convert source
  amount: number;
  amountMode: 'QUOTE' | 'BASE'; // spend/receive quote amount, or base amount
  promoCode?: string | null;
}

export interface TradeResult {
  status: 'EXECUTED' | 'PENDING_APPROVAL';
  order: {
    id: string;
    reference: string;
    side: string;
    baseSymbol: string;
    quoteSymbol: string;
    amountBase: number;
    amountQuote: number;
    price: number;
    fee: number;
  };
  message: string;
  promotion?: WelcomeMatchEvent | null;
}

export class TradeError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

export async function bestFeeDiscount(userId: string): Promise<{ pct: number; code: string | null }> {
  const redemptions = await db.promoRedemption.findMany({
    where: { userId },
    include: { promo: true },
  });
  let best = { pct: 0, code: null as string | null };
  for (const r of redemptions) {
    if (r.promo.kind === 'FEE_DISCOUNT' && r.promo.active) {
      if (r.promo.value > best.pct) best = { pct: r.promo.value, code: r.promo.code };
    }
  }
  return best;
}

/**
 * Validate, price and settle a market order.
 */
export async function createOrder(input: TradeInput): Promise<TradeResult> {
  const quoteSymbol = input.quoteSymbol ?? 'USD';
  const feeCfg = await getNumber('trade.feePercent', 0.35);
  const minUsd = await getNumber('trade.minOrderUsd', 5);
  const maxUsd = await getNumber('trade.maxOrderUsd', 250000);
  const flagUsd = await getNumber('risk.flagThresholdUsd', 10000);

  if (!(input.amount > 0)) throw new TradeError(422, 'Enter an amount');

  const [baseAsset, quoteAsset, sourceAsset] = await Promise.all([
    db.asset.findUnique({ where: { symbol: input.baseSymbol } }),
    db.asset.findUnique({ where: { symbol: quoteSymbol } }),
    input.side === 'CONVERT' ? db.asset.findUnique({ where: { symbol: input.sourceSymbol ?? '' } }) : Promise.resolve(null),
  ]);

  if (!baseAsset || baseAsset.status !== 'LISTED' || !baseAsset.tradeable) throw new TradeError(422, `${input.baseSymbol} is not tradeable right now`);
  if (!quoteAsset) throw new TradeError(422, `${quoteSymbol} is not available`);
  if (input.side === 'CONVERT' && (!sourceAsset || !sourceAsset.tradeable)) throw new TradeError(422, 'Conversion source is not tradeable');

  const snap = await getPriceSnapshot();
  const basePrice = snap.quotes[input.baseSymbol]?.price ?? baseAsset.priceUsd;
  const quotePrice = snap.quotes[quoteSymbol]?.price ?? quoteAsset.priceUsd;
  const sourcePrice = input.side === 'CONVERT' ? (snap.quotes[input.sourceSymbol ?? '']?.price ?? sourceAsset?.priceUsd ?? 0) : 0;
  if (basePrice <= 0 || quotePrice <= 0) throw new TradeError(503, 'Price feed unavailable: try again shortly');

  // Normalize to quote (USD-ish) notional
  let amountQuote: number;
  let amountBase: number;
  let convertSourceAmount = 0; // only used by CONVERT (source units)
  if (input.side === 'BUY') {
    if (input.amountMode === 'QUOTE') {
      amountQuote = input.amount;
      amountBase = round8(amountQuote / basePrice);
    } else {
      amountBase = input.amount;
      amountQuote = round8(amountBase * basePrice);
    }
  } else if (input.side === 'SELL') {
    if (input.amountMode === 'BASE') {
      amountBase = input.amount;
      amountQuote = round8(amountBase * basePrice);
    } else {
      amountQuote = input.amount;
      amountBase = round8(amountQuote / basePrice);
    }
  } else {
    // CONVERT source → base via USD valuation.
    // The amount is expressed in SOURCE units (what the user converts FROM).
    if (!input.sourceSymbol) throw new TradeError(422, 'Choose a source asset');
    if (input.amountMode !== 'BASE') throw new TradeError(422, 'Conversions take a source amount');
    if (sourcePrice <= 0) throw new TradeError(503, 'Price feed unavailable: try again shortly');
    convertSourceAmount = input.amount;
    const sourceValueUsd = round8(convertSourceAmount * sourcePrice);
    amountQuote = sourceValueUsd;      // USD notional
    amountBase = round8(sourceValueUsd / basePrice); // target asset received
  }

  if (input.side === 'CONVERT') {
    const sourceAmount = convertSourceAmount;
    const sourceValueUsd = amountQuote;
    if (sourceValueUsd < minUsd) throw new TradeError(422, `Minimum order is $${minUsd.toFixed(2)}`);
    if (sourceValueUsd > maxUsd) throw new TradeError(422, `Maximum order is $${maxUsd.toLocaleString('en-US')}`);

    const discount = await bestFeeDiscount(input.userId);
    const fee = round8(amountQuote * ((feeCfg * (1 - discount.pct / 100)) / 100));

    // Risk hold?
    if (sourceValueUsd > flagUsd) {
      return holdForApproval({
        userId: input.userId, side: 'CONVERT', baseSymbol: input.baseSymbol,
        quoteSymbol: input.sourceSymbol!, amountBase, amountQuote, price: basePrice,
        fee, feeSymbol: 'USD', sourceAmount,
        promoCode: discount.code,
      });
    }

    const [sourceWallet, destWallet, feeWallet] = await Promise.all([
      db.wallet.findUnique({ where: { userId_assetSymbol: { userId: input.userId, assetSymbol: input.sourceSymbol! } } }),
      db.wallet.findUnique({ where: { userId_assetSymbol: { userId: input.userId, assetSymbol: input.baseSymbol } } }),
      db.wallet.findUnique({ where: { userId_assetSymbol: { userId: input.userId, assetSymbol: 'USD' } } }),
    ]);
    if (!sourceWallet) throw new TradeError(422, `You need a ${input.sourceSymbol} wallet`);
    if (!destWallet) throw new TradeError(422, `You need a ${input.baseSymbol} wallet`);
    if (sourceWallet.available + 1e-9 < sourceAmount) throw new TradeError(422, `Insufficient ${input.sourceSymbol} balance`);
    if (fee > 0 && !feeWallet) throw new TradeError(422, 'Fee wallet (USD) missing');

    const reference = genReference('CVT');
    const lines = [
      { walletId: sourceWallet.id, direction: 'DEBIT' as const, amount: sourceAmount, memo: `Convert ${sourceAmount} ${input.sourceSymbol} → ${amountBase} ${input.baseSymbol}` },
      { walletId: destWallet.id, direction: 'CREDIT' as const, amount: amountBase, memo: `Receive ${amountBase} ${input.baseSymbol}` },
    ];
    if (fee > 0 && feeWallet && feeWallet.id !== sourceWallet.id) {
      lines.push({ walletId: feeWallet.id, direction: 'DEBIT' as const, amount: fee, memo: 'Conversion fee' });
    }

    try {
      const order = await db.$transaction(async (tx) => {
        const ledger = await postLedgerInTx(tx, {
          type: 'CONVERT',
          userId: input.userId,
          reference,
          description: `Converted ${sourceAmount} ${input.sourceSymbol} → ${amountBase} ${input.baseSymbol}`,
          meta: { side: 'CONVERT', base: input.baseSymbol, source: input.sourceSymbol, price: basePrice, fee, promo: discount.code },
          lines,
        });
        return tx.order.create({
          data: {
            userId: input.userId,
            reference,
            side: 'CONVERT',
            baseSymbol: input.baseSymbol,
            quoteSymbol: 'USD',
            sourceSymbol: input.sourceSymbol,
            amountBase,
            amountQuote,
            price: basePrice,
            fee,
            feeSymbol: 'USD',
            promoCode: discount.code,
            status: 'EXECUTED',
            ledgerTxId: ledger.ledgerTxId,
          },
        });
      }, { timeout: 15000 });
      const promotion = await recordExecutedTrade(order.id);
      return {
        status: 'EXECUTED',
        order: { id: order.id, reference, side: 'CONVERT', baseSymbol: input.baseSymbol, quoteSymbol: input.sourceSymbol!, amountBase, amountQuote, price: basePrice, fee },
        message: `Converted ${sourceAmount} ${input.sourceSymbol} to ${amountBase} ${input.baseSymbol}`,
        promotion,
      };
    } catch (e) {
      if (e instanceof LedgerError && e.code === 'INSUFFICIENT_FUNDS') throw new TradeError(422, `Insufficient ${input.sourceSymbol} balance`);
      throw e;
    }
  }

  // BUY / SELL
  if (amountQuote < minUsd) throw new TradeError(422, `Minimum order is $${minUsd.toFixed(2)}`);
  if (amountQuote > maxUsd) throw new TradeError(422, `Maximum order is $${maxUsd.toLocaleString('en-US')}`);

  const discount = await bestFeeDiscount(input.userId);
  const fee = round8(amountQuote * ((feeCfg * (1 - discount.pct / 100)) / 100));

  const [baseWallet, quoteWallet, feeWallet] = await Promise.all([
    db.wallet.findUnique({ where: { userId_assetSymbol: { userId: input.userId, assetSymbol: input.baseSymbol } } }),
    db.wallet.findUnique({ where: { userId_assetSymbol: { userId: input.userId, assetSymbol: quoteSymbol } } }),
    db.wallet.findUnique({ where: { userId_assetSymbol: { userId: input.userId, assetSymbol: 'USD' } } }),
  ]);
  if (!baseWallet) throw new TradeError(422, `You need a ${input.baseSymbol} wallet`);
  if (!quoteWallet) throw new TradeError(422, `You need a ${quoteSymbol} wallet`);
  if (fee > 0 && !feeWallet) throw new TradeError(422, 'Fee wallet (USD) missing');

  const reference = genReference(input.side === 'BUY' ? 'BUY' : 'SEL');
  const totalDebit = round8(input.side === 'BUY' ? amountQuote + fee : 0);
  const totalCredit = round8(input.side === 'SELL' ? Math.max(amountQuote - fee, 0) : 0);

  // Risk hold?
  if (amountQuote > flagUsd) {
    return holdForApproval({
      userId: input.userId, side: input.side, baseSymbol: input.baseSymbol,
      quoteSymbol, amountBase, amountQuote, price: basePrice, fee, feeSymbol: 'USD',
      promoCode: discount.code,
    });
  }

  try {
    const order = await db.$transaction(async (tx) => {
      const ledger = await postLedgerInTx(tx, {
        type: input.side === 'BUY' ? 'BUY' : 'SELL',
        userId: input.userId,
        reference,
        description: input.side === 'BUY'
          ? `Bought ${amountBase} ${input.baseSymbol} for $${amountQuote.toLocaleString('en-US', { maximumFractionDigits: 2 })}`
          : `Sold ${amountBase} ${input.baseSymbol} for $${amountQuote.toLocaleString('en-US', { maximumFractionDigits: 2 })}`,
        meta: { side: input.side, base: input.baseSymbol, quote: quoteSymbol, price: basePrice, fee, promo: discount.code },
        lines: input.side === 'BUY'
          ? [
              { walletId: quoteWallet.id, direction: 'DEBIT' as const, amount: totalDebit, memo: `Buy ${amountBase} ${input.baseSymbol}` },
              { walletId: baseWallet.id, direction: 'CREDIT' as const, amount: amountBase, memo: `Receive ${amountBase} ${input.baseSymbol}` },
            ]
          : [
              { walletId: baseWallet.id, direction: 'DEBIT' as const, amount: amountBase, memo: `Sell ${amountBase} ${input.baseSymbol}` },
              { walletId: quoteWallet.id, direction: 'CREDIT' as const, amount: totalCredit, memo: `Receive $${totalCredit.toLocaleString('en-US', { maximumFractionDigits: 2 })}` },
            ],
      });
      return tx.order.create({
        data: {
          userId: input.userId,
          reference,
          side: input.side,
          baseSymbol: input.baseSymbol,
          quoteSymbol,
          amountBase,
          amountQuote,
          price: basePrice,
          fee,
          feeSymbol: 'USD',
          promoCode: discount.code,
          status: 'EXECUTED',
          ledgerTxId: ledger.ledgerTxId,
        },
      });
    }, { timeout: 15000 });

    const promotion = await recordExecutedTrade(order.id);

    await db.notification.create({
      data: {
        recipientId: input.userId,
        type: 'TRADE',
        title: input.side === 'BUY' ? 'Buy order executed' : 'Sell order executed',
        body: input.side === 'BUY'
          ? `Bought ${amountBase} ${input.baseSymbol} at $${basePrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}: settled instantly.`
          : `Sold ${amountBase} ${input.baseSymbol} at $${basePrice.toLocaleString('en-US', { maximumFractionDigits: 2 })}: settled instantly.`,
      },
    });

    return {
      status: 'EXECUTED',
      order: { id: order.id, reference, side: input.side, baseSymbol: input.baseSymbol, quoteSymbol, amountBase, amountQuote, price: basePrice, fee },
      message: input.side === 'BUY'
        ? `Bought ${amountBase} ${input.baseSymbol}`
        : `Sold ${amountBase} ${input.baseSymbol}`,
      promotion,
    };
  } catch (e) {
    if (e instanceof LedgerError && e.code === 'INSUFFICIENT_FUNDS') {
      throw new TradeError(422, input.side === 'BUY' ? `Insufficient ${quoteSymbol} balance (including fee)` : `Insufficient ${input.baseSymbol} balance`);
    }
    throw e;
  }
}

/** Hold a large trade for manual approval: funds move available → reserved. */
async function holdForApproval(p: {
  userId: string; side: 'BUY' | 'SELL' | 'CONVERT'; baseSymbol: string; quoteSymbol: string;
  amountBase: number; amountQuote: number; price: number; fee: number; feeSymbol: string;
  sourceAmount?: number; promoCode: string | null;
}): Promise<TradeResult> {
  const ref = genReference('HLD');
  const sourceSymbol = p.side === 'CONVERT' ? p.quoteSymbol : (p.side === 'BUY' ? p.quoteSymbol : p.baseSymbol);
  const holdAmount = p.side === 'CONVERT' ? (p.sourceAmount ?? 0) : (p.side === 'BUY' ? round8(p.amountQuote + p.fee) : p.amountBase);

  const sourceWallet = await db.wallet.findUnique({
    where: { userId_assetSymbol: { userId: p.userId, assetSymbol: sourceSymbol } },
  });
  if (!sourceWallet) throw new TradeError(422, `Missing ${sourceSymbol} wallet`);
  if (sourceWallet.available + 1e-9 < holdAmount) throw new TradeError(422, `Insufficient ${sourceSymbol} balance`);

  const order = await db.$transaction(async (tx) => {
    const ledger = await postLedgerInTx(tx, {
      type: 'ADJUSTMENT',
      userId: p.userId,
      reference: ref,
      description: `Funds held for review: ${p.side} ${p.baseSymbol} order`,
      meta: { hold: true, orderSide: p.side, base: p.baseSymbol },
      lines: [{ walletId: sourceWallet.id, direction: 'DEBIT' as const, from: 'available' as const, to: 'reserved' as const, amount: holdAmount, memo: 'Risk review hold' }],
    });
    const o = await tx.order.create({
      data: {
        userId: p.userId, reference: ref, side: p.side, baseSymbol: p.baseSymbol, quoteSymbol: p.quoteSymbol,
        sourceSymbol: p.side === 'CONVERT' ? p.quoteSymbol : null,
        amountBase: p.amountBase, amountQuote: p.amountQuote, price: p.price, fee: p.fee,
        feeSymbol: p.feeSymbol, promoCode: p.promoCode, status: 'PENDING', ledgerTxId: ledger.ledgerTxId,
      },
    });
    await tx.approval.create({
      data: {
        type: 'RISK_TRADE', reference: ref, userId: p.userId,
        amount: p.amountQuote, assetSymbol: p.baseSymbol,
        payload: JSON.stringify({ orderId: o.id, side: p.side, base: p.baseSymbol, source: sourceSymbol, holdAmount, amountBase: p.amountBase, amountQuote: p.amountQuote, price: p.price, fee: p.fee }),
        requestedBy: p.userId,
      },
    });
    return o;
  }, { timeout: 15000 });

  await db.notification.create({
    data: {
      recipientId: p.userId,
      type: 'TRADE',
      title: 'Large order queued for review',
      body: `Your ${p.side} order of $${p.amountQuote.toLocaleString('en-US', { maximumFractionDigits: 2 })} exceeds the platform review threshold and is pending approval. Funds are safely held.`,
    },
  });
  await db.auditLog.create({ data: { userId: p.userId, actor: 'system', action: 'RISK_HOLD', detail: `${p.side} ${p.baseSymbol} $${p.amountQuote} queued for approval` } });

  return {
    status: 'PENDING_APPROVAL',
    order: { id: order.id, reference: ref, side: p.side, baseSymbol: p.baseSymbol, quoteSymbol: p.quoteSymbol, amountBase: p.amountBase, amountQuote: p.amountQuote, price: p.price, fee: p.fee },
    message: 'Order queued for compliance review: funds are held safely and the order will settle once approved.',
  };
}

/** Execute a pending (held) order after admin approval. */
export async function executeHeldOrder(orderId: string): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new TradeError(404, 'Order not found');
  if (order.status !== 'PENDING') throw new TradeError(422, 'Order is not pending');

  const side = order.side as 'BUY' | 'SELL' | 'CONVERT';
  const holdTx = await db.ledgerTransaction.findUnique({ where: { id: order.ledgerTxId ?? '' }, include: { entries: true } });
  const holdEntry = holdTx?.entries[0];

  if (!holdEntry) throw new TradeError(500, 'Hold record missing');

  const sourceSymbol = side === 'CONVERT' ? (order.sourceSymbol ?? order.quoteSymbol) : (side === 'BUY' ? order.quoteSymbol : order.baseSymbol);
  const sourceWallet = await db.wallet.findUnique({ where: { userId_assetSymbol: { userId: order.userId, assetSymbol: sourceSymbol } } });
  const destWallet = await db.wallet.findUnique({ where: { userId_assetSymbol: { userId: order.userId, assetSymbol: side === 'CONVERT' ? order.baseSymbol : (side === 'BUY' ? order.baseSymbol : order.quoteSymbol) } } });
  const feeWallet = await db.wallet.findUnique({ where: { userId_assetSymbol: { userId: order.userId, assetSymbol: 'USD' } } });
  if (!sourceWallet || !destWallet) throw new TradeError(500, 'Wallets missing for settlement');

  const lines: Parameters<typeof postLedgerInTx>[1]['lines'] = [];
  const settleRef = genReference(side === 'CONVERT' ? 'CVT' : side === 'BUY' ? 'BUY' : 'SEL');

  if (side === 'BUY') {
    lines.push({ walletId: sourceWallet.id, direction: 'DEBIT', from: 'reserved', amount: round8(order.amountQuote + order.fee), memo: `Settle buy ${order.reference}` });
    lines.push({ walletId: destWallet.id, direction: 'CREDIT', amount: order.amountBase, memo: `Receive ${order.amountBase} ${order.baseSymbol}` });
  } else if (side === 'SELL') {
    lines.push({ walletId: sourceWallet.id, direction: 'DEBIT', from: 'reserved', amount: order.amountBase, memo: `Settle sell ${order.reference}` });
    lines.push({ walletId: destWallet.id, direction: 'CREDIT', amount: round8(Math.max(order.amountQuote - order.fee, 0)), memo: `Receive $${order.amountQuote.toFixed(2)}` });
  } else {
    lines.push({ walletId: sourceWallet.id, direction: 'DEBIT', from: 'reserved', amount: holdEntry.amount, memo: `Settle convert ${order.reference}` });
    lines.push({ walletId: destWallet.id, direction: 'CREDIT', amount: order.amountBase, memo: `Receive ${order.amountBase} ${order.baseSymbol}` });
    if (order.fee > 0 && feeWallet) {
      lines.push({ walletId: feeWallet.id, direction: 'DEBIT', amount: order.fee, memo: 'Conversion fee' });
    }
  }

  await db.$transaction(async (tx) => {
    await postLedgerInTx(tx, {
      type: side,
      userId: order.userId,
      reference: settleRef,
      description: `Settled held order ${order.reference}`,
      meta: { settledHold: order.reference },
      lines,
    });
    await tx.order.update({ where: { id: order.id }, data: { status: 'EXECUTED' } });
  }, { timeout: 15000 });

  await recordExecutedTrade(order.id);

  await db.notification.create({
    data: {
      recipientId: order.userId, type: 'TRADE', title: 'Order approved & settled',
      body: `Your ${side.toLowerCase()} order ${order.reference} was approved and settled.`,
    },
  });
}

/** Release a held order after rejection: reserved funds return to available. */
export async function releaseHeldOrder(orderId: string, note: string): Promise<void> {
  const order = await db.order.findUnique({ where: { id: orderId } });
  if (!order) throw new TradeError(404, 'Order not found');
  if (order.status !== 'PENDING') throw new TradeError(422, 'Order is not pending');

  const holdTx = await db.ledgerTransaction.findUnique({ where: { id: order.ledgerTxId ?? '' }, include: { entries: true } });
  const holdEntry = holdTx?.entries[0];
  if (!holdEntry) throw new TradeError(500, 'Hold record missing');

  const sourceSymbol = holdEntry.assetSymbol;
  const sourceWallet = await db.wallet.findUnique({ where: { userId_assetSymbol: { userId: order.userId, assetSymbol: sourceSymbol } } });
  if (!sourceWallet) throw new TradeError(500, 'Wallet missing');

  await db.$transaction(async (tx) => {
    await postLedgerInTx(tx, {
      type: 'ADJUSTMENT',
      userId: order.userId,
      reference: genReference('RLS'),
      description: `Hold released: order ${order.reference} rejected`,
      meta: { releaseOf: order.reference, note },
      lines: [{ walletId: sourceWallet.id, direction: 'CREDIT', from: 'reserved', to: 'available', amount: holdEntry.amount, memo: 'Release risk hold' }],
    });
    await tx.order.update({ where: { id: order.id }, data: { status: 'FAILED' } });
  }, { timeout: 15000 });

  await db.notification.create({
    data: {
      recipientId: order.userId, type: 'TRADE', title: 'Order rejected: funds released',
      body: `Your ${order.side.toLowerCase()} order ${order.reference} was not approved. Held funds have been returned to your balance. ${note}`,
    },
  });
}

void Prisma; void postLedger;
