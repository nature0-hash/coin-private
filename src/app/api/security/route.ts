import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, handler, ok, readJson, clientIp } from '@/lib/api';
import { hashPassword, verifyPassword } from '@/lib/session';
import { audit, securityEvent } from '@/lib/notify';

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

// GET /api/security: login history
export const GET = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const events = await db.securityEvent.findMany({
    where: { userId: user.id, type: { in: ['LOGIN', 'LOGIN_FAILED', 'PASSWORD_CHANGED', '2FA_TOGGLED'] } },
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  return ok({ events });
});

export const runtime = 'nodejs';
