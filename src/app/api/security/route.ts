import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, handler, ok, readJson, clientIp } from '@/lib/api';
import { hashPassword, verifyPassword } from '@/lib/session';
import { audit, securityEvent } from '@/lib/notify';

const CUSTOMER_SECURITY_TYPES = ['LOGIN', 'LOGIN_FAILED', 'PASSWORD_CHANGED', '2FA_TOGGLED'];

// POST /api/security: password changes
export const POST = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await readJson<{ action?: string; currentPassword?: string; newPassword?: string; enable?: boolean }>(req);

  if (body.action === 'change_password') {
    const rec = await db.user.findUnique({ where: { id: user.id } });
    if (!rec) return ok({ error: 'Account not found' }, { status: 404 });
    const valid = await verifyPassword(body.currentPassword ?? '', rec.passwordHash);
    if (!valid) return ok({ error: 'Current password is incorrect' }, { status: 422 });
    if ((body.newPassword ?? '').length < 8) return ok({ error: 'New password must be at least 8 characters' }, { status: 422 });
    await db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(body.newPassword!) } });
    await securityEvent(user.id, 'PASSWORD_CHANGED', clientIp(req), req.headers.get('user-agent') ?? undefined);
    await audit(user.id, user.email, 'PASSWORD_CHANGE', 'Password changed from security settings');
    return ok({ success: true, message: 'Password updated' });
  }

  return ok({ error: 'Unknown action' }, { status: 422 });
});

// GET /api/security: customer-visible security history.
// Hidden rows remain intact internally and are only omitted from this view.
export const GET = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const hidden = await db.customerHiddenItem.findMany({
    where: { userId: user.id, area: 'SECURITY' },
    select: { itemId: true },
  });
  const hiddenIds = hidden.map((item) => item.itemId);
  const events = await db.securityEvent.findMany({
    where: {
      userId: user.id,
      type: { in: CUSTOMER_SECURITY_TYPES },
      ...(hiddenIds.length ? { id: { notIn: hiddenIds } } : {}),
    },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return ok({ events });
});

// DELETE /api/security: hide one event or all current events from the customer view.
// The SecurityEvent records and audit trail are preserved internally.
export const DELETE = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await readJson<{ id?: string; all?: boolean }>(req);

  if (body.all) {
    const events = await db.securityEvent.findMany({
      where: { userId: user.id, type: { in: CUSTOMER_SECURITY_TYPES } },
      select: { id: true },
    });
    if (events.length) {
      await db.customerHiddenItem.createMany({
        data: events.map(({ id }) => ({ userId: user.id, area: 'SECURITY', itemId: id })),
        skipDuplicates: true,
      });
    }
    return ok({ success: true, hidden: events.length });
  }

  if (!body.id) return ok({ error: 'Security event id is required' }, { status: 422 });
  const event = await db.securityEvent.findFirst({
    where: { id: body.id, userId: user.id, type: { in: CUSTOMER_SECURITY_TYPES } },
    select: { id: true },
  });
  if (!event) return ok({ error: 'Security event not found' }, { status: 404 });

  await db.customerHiddenItem.upsert({
    where: { userId_area_itemId: { userId: user.id, area: 'SECURITY', itemId: event.id } },
    update: {},
    create: { userId: user.id, area: 'SECURITY', itemId: event.id },
  });
  return ok({ success: true });
});

export const runtime = 'nodejs';
