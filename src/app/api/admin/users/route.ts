import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok, readJson } from '@/lib/api';
import { hashPassword, genWalletAddress } from '@/lib/session';
import { audit, notifyUser } from '@/lib/notify';
import { ensureWallet } from '@/lib/ledger';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);
  const url = new URL(req.url);
  const q = (url.searchParams.get('q') ?? '').trim().toLowerCase();
  const status = url.searchParams.get('status') ?? '';

  const users = await db.user.findMany({
    where: {
      AND: [
        q ? { OR: [{ email: { contains: q } }, { name: { contains: q } }, { loginId: { contains: q } }] } : {},
        status ? { status } : {},
      ],
    },
    include: { wallets: true },
    orderBy: { createdAt: 'desc' },
    take: 200,
  });

  return ok({
    users: users.map((u) => ({
      id: u.id, email: u.email, name: u.name, role: u.role, status: u.status,
      phone: u.phone, country: u.country, kycStatus: u.kycStatus, kycTier: u.kycTier,
      twoFactorEnabled: u.twoFactorEnabled, createdAt: u.createdAt,
      walletCount: u.wallets.length,
    })),
  });
});

// POST: create a user (admin onboarding)
export const POST = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body = await readJson<{ name?: string; email?: string; password?: string; role?: string; kycStatus?: string }>(req);

  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  if (name.length < 2) return ok({ error: 'Name required' }, { status: 422 });
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok({ error: 'Valid email required' }, { status: 422 });
  if (password.length < 8) return ok({ error: 'Password must be at least 8 characters' }, { status: 422 });

  const exists = await db.user.findUnique({ where: { email } });
  if (exists) return ok({ error: 'Email already registered' }, { status: 409 });

  const user = await db.user.create({
    data: {
      name, email, passwordHash: await hashPassword(password),
      role: body.role === 'ADMIN' ? 'ADMIN' : 'CUSTOMER',
      kycStatus: body.kycStatus === 'VERIFIED' ? 'VERIFIED' : 'PENDING',
      kycTier: body.kycStatus === 'VERIFIED' ? 2 : 1,
    },
  });

  for (const sym of ['USD', 'BTC', 'ETH', 'SOL']) {
    await ensureWallet(user.id, sym, genWalletAddress(sym));
  }

  await notifyUser(user.id, 'SYSTEM', 'Welcome to Coin Private', 'Your account was created by the platform team. Set a strong password and enable two-factor authentication.');
  await audit(admin.id, admin.email, 'ADMIN_USER_CREATE', `Created ${email} (${user.role})`);
  return ok({ success: true, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
});

// PATCH: update status / kyc / role
export const PATCH = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body = await readJson<{ id?: string; status?: string; kycStatus?: string; kycTier?: number; role?: string }>(req);
  if (!body.id) return ok({ error: 'User id required' }, { status: 422 });

  const data: Record<string, string | number> = {};
  if (body.status && ['ACTIVE', 'FROZEN'].includes(body.status)) data.status = body.status;
  if (body.kycStatus && ['VERIFIED', 'PENDING', 'UNVERIFIED'].includes(body.kycStatus)) data.kycStatus = body.kycStatus;
  if (body.kycTier && [1, 2, 3].includes(body.kycTier)) data.kycTier = body.kycTier;
  if (body.role && ['CUSTOMER', 'ADMIN'].includes(body.role)) data.role = body.role;
  if (!Object.keys(data).length) return ok({ error: 'Nothing to update' }, { status: 422 });

  const updated = await db.user.update({ where: { id: body.id }, data });
  if (body.status === 'FROZEN') {
    await notifyUser(body.id, 'SYSTEM', 'Account frozen', 'Your account has been frozen by the compliance team. Contact support for details.');
  }
  if (body.status === 'ACTIVE') {
    await notifyUser(body.id, 'SYSTEM', 'Account restored', 'Your account has been reactivated. Welcome back.');
  }
  if (body.kycStatus === 'VERIFIED') {
    await notifyUser(body.id, 'SYSTEM', 'Identity verified', 'Your verification is complete: higher limits are now unlocked.');
  }
  await audit(admin.id, admin.email, 'ADMIN_USER_UPDATE', `${updated.email}: ${JSON.stringify(data)}`);
  return ok({ success: true });
});

export const runtime = 'nodejs';
