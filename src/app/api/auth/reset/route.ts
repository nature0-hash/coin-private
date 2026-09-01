import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { hashPassword } from '@/lib/session';
import { fail, handler, ok, readJson, clientIp } from '@/lib/api';
import { audit, notifyUser, securityEvent } from '@/lib/notify';

export const POST = handler(async (req: NextRequest) => {
  const { email, code, password } = await readJson<{ email?: string; code?: string; password?: string }>(req);
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized || !code || !password) return fail('Email, code and new password are required', 422);
  if (password.length < 8) return fail('Password must be at least 8 characters', 422);

  const reset = await db.resetCode.findFirst({
    where: { email: normalized, code, used: false, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });
  if (!reset) return fail('Invalid or expired reset code', 400);

  const user = await db.user.findUnique({ where: { email: normalized } });
  if (!user) return fail('Account not found', 404);

  await db.$transaction([
    db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(password) } }),
    db.resetCode.update({ where: { id: reset.id }, data: { used: true } }),
  ]);

  await securityEvent(user.id, 'PASSWORD_CHANGED', clientIp(req), req.headers.get('user-agent') ?? undefined, 'Password reset via code');
  await audit(user.id, user.email, 'PASSWORD_RESET', 'Password changed with reset code');
  await notifyUser(user.id, 'SECURITY', 'Password changed', 'Your password was just changed. If this wasn\'t you, contact support immediately.');

  return ok({ success: true });
});

export const runtime = 'nodejs';
