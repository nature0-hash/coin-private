import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok, readJson } from '@/lib/api';
import { audit } from '@/lib/notify';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);
  const promos = await db.promo.findMany({ orderBy: { createdAt: 'desc' }, include: { _count: { select: { redemptions: true } } } });
  return ok({
    promos: promos.map((p) => ({
      id: p.id, code: p.code, title: p.title, kind: p.kind, value: p.value,
      bonusSymbol: p.bonusSymbol, active: p.active, startsAt: p.startsAt, endsAt: p.endsAt,
      maxRedemptions: p.maxRedemptions, usedCount: p.usedCount,
      redemptions: p._count.redemptions,
    })),
  });
});

export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body = await readJson<{
    code?: string; title?: string; kind?: string; value?: number;
    bonusSymbol?: string; endsAt?: string; maxRedemptions?: number;
  }>(req);

  const code = (body.code ?? '').trim().toUpperCase();
  const title = (body.title ?? '').trim();
  const kind = body.kind ?? 'FEE_DISCOUNT';
  const value = Number(body.value ?? 0);
  if (!/^[A-Z0-9-]{3,20}$/.test(code)) return ok({ error: 'Code must be 3-20 chars (A-Z, 0-9, dash)' }, { status: 422 });
  if (!title) return ok({ error: 'Title required' }, { status: 422 });
  if (!(value > 0)) return ok({ error: 'Value must be positive' }, { status: 422 });
  if (kind === 'FEE_DISCOUNT' && value > 100) return ok({ error: 'Fee discount cannot exceed 100%' }, { status: 422 });
  if (kind === 'BONUS_CREDIT' && !body.bonusSymbol) return ok({ error: 'Bonus credit needs a symbol' }, { status: 422 });

  const exists = await db.promo.findUnique({ where: { code } });
  if (exists) return ok({ error: 'Code already exists' }, { status: 409 });

  const promo = await db.promo.create({
    data: {
      code, title, kind, value,
      bonusSymbol: kind === 'BONUS_CREDIT' ? (body.bonusSymbol ?? 'USDC').toUpperCase() : null,
      endsAt: body.endsAt ? new Date(body.endsAt) : null,
      maxRedemptions: body.maxRedemptions ?? 0,
    },
  });
  await audit(admin.id, admin.email, 'ADMIN_PROMO_CREATE', `${code} (${kind} ${value})`);
  return ok({ success: true, promo });
});

// PATCH: toggle active
export const PATCH = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body = await readJson<{ id?: string; active?: boolean }>(req);
  if (!body.id) return ok({ error: 'Promo id required' }, { status: 422 });
  const promo = await db.promo.update({ where: { id: body.id }, data: { active: !!body.active } });
  await audit(admin.id, admin.email, 'ADMIN_PROMO_UPDATE', `${promo.code} ${body.active ? 'activated' : 'deactivated'}`);
  return ok({ success: true, promo });
});

export const runtime = 'nodejs';
