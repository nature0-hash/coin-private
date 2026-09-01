import { NextRequest } from 'next/server';
import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { requireAuth, handler, ok, readJson } from '@/lib/api';
import { postLedgerInTx } from '@/lib/ledger';
import { genReference } from '@/lib/session';
import { audit, notifyUser } from '@/lib/notify';

// POST /api/promo: redeem a promotion code
export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const { code } = await readJson<{ code?: string }>(req);
  const normalized = (code ?? '').trim().toUpperCase();
  if (!normalized) return ok({ error: 'Enter a promotion code' }, { status: 422 });

  try {
    const result = await db.$transaction(async (tx) => {
      const promo = await tx.promo.findUnique({ where: { code: normalized } });
      if (!promo || !promo.active) throw new PromoError(404, 'This code is not valid');
      if (promo.endsAt && promo.endsAt < new Date()) throw new PromoError(410, 'This code has expired');

      const countClaim = promo.maxRedemptions > 0
        ? await tx.promo.updateMany({
            where: { id: promo.id, usedCount: { lt: promo.maxRedemptions } },
            data: { usedCount: { increment: 1 } },
          })
        : await tx.promo.updateMany({ where: { id: promo.id }, data: { usedCount: { increment: 1 } } });
      if (countClaim.count !== 1) throw new PromoError(410, 'This code has reached its redemption limit');

      await tx.promoRedemption.create({ data: { promoId: promo.id, userId: user.id } });

      let message = 'Promotion applied.';
      if (promo.kind === 'FEE_DISCOUNT') {
        message = `Fee discount of ${promo.value}% is now active on your account.`;
      } else if (promo.kind === 'BONUS_CREDIT' && promo.bonusSymbol) {
        const wallet = await tx.wallet.findUnique({
          where: { userId_assetSymbol: { userId: user.id, assetSymbol: promo.bonusSymbol } },
        });
        if (!wallet) throw new PromoError(422, `Missing ${promo.bonusSymbol} wallet`);
        await postLedgerInTx(tx, {
          type: 'BONUS',
          userId: user.id,
          reference: genReference('PRM'),
          description: `Promotion bonus: ${promo.code}`,
          meta: { promoId: promo.id, code: promo.code },
          lines: [{ walletId: wallet.id, direction: 'CREDIT', amount: promo.value, memo: `Promo ${promo.code}` }],
        });
        message = `${promo.value} ${promo.bonusSymbol} credited to your wallet.`;
      }
      return { promo, message };
    }, { timeout: 15000 });

    await notifyUser(user.id, 'PROMO', 'Promotion redeemed', `${result.promo.title}: ${result.message}`);
    await audit(user.id, user.email, 'PROMO_REDEEM', result.promo.code);
    return ok({
      success: true,
      message: result.message,
      promo: { code: result.promo.code, title: result.promo.title, kind: result.promo.kind, value: result.promo.value },
    });
  } catch (error) {
    if (error instanceof PromoError) return ok({ error: error.message }, { status: error.status });
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return ok({ error: 'You have already redeemed this code' }, { status: 409 });
    }
    throw error;
  }
});

class PromoError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

// GET /api/promo: my redeemed promotions
export const GET = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const redemptions = await db.promoRedemption.findMany({ where: { userId: user.id }, include: { promo: true } });
  return ok({
    redemptions: redemptions.map((r) => ({
      code: r.promo.code, title: r.promo.title, kind: r.promo.kind,
      value: r.promo.value, bonusSymbol: r.promo.bonusSymbol, redeemedAt: r.createdAt,
    })),
  });
});

export const runtime = 'nodejs';
