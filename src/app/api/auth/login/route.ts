import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSession, verifyPassword } from '@/lib/session';
import { fail, handler, readJson, clientIp } from '@/lib/api';
import { audit, notifyAdmins, notifyUser, securityEvent } from '@/lib/notify';
import { ensureSeeded } from '@/lib/bootstrap';

export const POST = handler(async (req: NextRequest) => {
  // First-boot safety: a fresh deployment self-seeds so sign-in always works.
  await ensureSeeded();
  const body = await readJson<{ identifier?: string; password?: string }>(req);
  const identifier = (body.identifier ?? '').trim().toLowerCase();
  const identifierUpper = identifier.toUpperCase();
  const password = body.password ?? '';
  if (!identifier || !password) return fail('Enter your email/login ID and password', 422);

  const user = await db.user.findFirst({
    where: { OR: [{ email: identifier }, { loginId: identifierUpper }, { loginId: identifier }] },
  });
  if (!user) {
    await securityEvent(null, 'LOGIN_FAILED', clientIp(req), req.headers.get('user-agent') ?? undefined, `Unknown identifier: ${identifier}`);
    return fail('Invalid credentials', 401);
  }
  if (user.status === 'FROZEN') return fail('Account frozen: contact support', 403);

  const valid = await verifyPassword(password, user.passwordHash);
  if (!valid) {
    await securityEvent(user.id, 'LOGIN_FAILED', clientIp(req), req.headers.get('user-agent') ?? undefined);
    return fail('Invalid credentials', 401);
  }

  const { tabToken } = await createSession({
    userId: user.id, email: user.email, role: user.role as 'CUSTOMER' | 'ADMIN', name: user.name,
  });

  await securityEvent(user.id, 'LOGIN', clientIp(req), req.headers.get('user-agent') ?? undefined);
  await audit(user.id, user.email, 'LOGIN', `Signed in as ${user.role.toLowerCase()}`);
  await notifyUser(user.id, 'SECURITY', 'New sign-in', `You signed in to Coin Private on ${new Date().toLocaleString('en-US')}. If this wasn't you, change your password immediately.`);
  await notifyAdmins('SECURITY', 'User sign-in', `${user.name} (${user.email}) signed in.`);

  const res = NextResponse.json({
    token: tabToken,
    user: {
      id: user.id, email: user.email, name: user.name, role: user.role,
      status: user.status, kycStatus: user.kycStatus, kycTier: user.kycTier,
      avatarUrl: user.avatarUrl, twoFactorEnabled: user.twoFactorEnabled,
    },
  });
  res.cookies.set('cp_session', tabToken, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 12 * 60 * 60 });
  return res;
});

export const runtime = 'nodejs';
