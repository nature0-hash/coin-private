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

// PATCH: Management profile, access and verification controls. Financial
// balances are deliberately not accepted here: use the audited ledger
// adjustment endpoint instead.
export const PATCH = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body = await readJson<{
    id?: string; name?: string; email?: string; loginId?: string | null;
    phone?: string | null; address?: string | null; country?: string | null; avatarUrl?: string | null;
    password?: string; status?: string; closeReason?: string; kycStatus?: string; kycTier?: number; role?: string;
  }>(req);
  if (!body.id) return ok({ error: 'User id required' }, { status: 422 });

  const current = await db.user.findUnique({ where: { id: body.id } });
  if (!current) return ok({ error: 'User not found' }, { status: 404 });

  const data: {
    name?: string; email?: string; loginId?: string | null; phone?: string | null;
    address?: string | null; country?: string | null; avatarUrl?: string | null;
    passwordHash?: string; status?: string; closedAt?: Date | null; closedReason?: string | null;
    kycStatus?: string; kycTier?: number; role?: string;
  } = {};
  const changed: Record<string, { from: string | number | null; to: string | number | null }> = {};

  const setText = (key: 'phone' | 'address' | 'country' | 'avatarUrl', value: string | null | undefined, max = 240) => {
    if (value === undefined) return;
    const next = value?.trim() || null;
    if (next && next.length > max) throw new Error(`${key} is too long`);
    if (current[key] !== next) {
      data[key] = next;
      changed[key] = { from: current[key], to: next };
    }
  };

  if (body.name !== undefined) {
    const name = body.name.trim();
    if (name.length < 2 || name.length > 120) return ok({ error: 'Name must be 2 to 120 characters' }, { status: 422 });
    if (name !== current.name) { data.name = name; changed.name = { from: current.name, to: name }; }
  }
  if (body.email !== undefined) {
    const email = body.email.trim().toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return ok({ error: 'Valid email required' }, { status: 422 });
    if (email !== current.email) {
      const exists = await db.user.findFirst({ where: { email, NOT: { id: current.id } } });
      if (exists) return ok({ error: 'Email already registered' }, { status: 409 });
      data.email = email; changed.email = { from: current.email, to: email };
    }
  }
  if (body.loginId !== undefined) {
    const loginId = body.loginId?.trim().toUpperCase() || null;
    if (loginId && (loginId.length < 3 || loginId.length > 64)) return ok({ error: 'Login ID must be 3 to 64 characters' }, { status: 422 });
    if (loginId !== current.loginId) {
      if (loginId) {
        const exists = await db.user.findFirst({ where: { loginId, NOT: { id: current.id } } });
        if (exists) return ok({ error: 'Login ID already in use' }, { status: 409 });
      }
      data.loginId = loginId; changed.loginId = { from: current.loginId, to: loginId };
    }
  }
  try {
    setText('phone', body.phone, 64);
    setText('address', body.address, 240);
    setText('country', body.country, 96);
    setText('avatarUrl', body.avatarUrl, 500);
  } catch (error) {
    return ok({ error: error instanceof Error ? error.message : 'Invalid profile value' }, { status: 422 });
  }
  if (body.password !== undefined) {
    if (body.password.length < 8) return ok({ error: 'Temporary password must be at least 8 characters' }, { status: 422 });
    data.passwordHash = await hashPassword(body.password);
    changed.password = { from: 'set', to: 'replaced' };
  }

  if (body.status && ['ACTIVE', 'FROZEN', 'CLOSED'].includes(body.status)) {
    if (current.id === admin.id && body.status !== 'ACTIVE') return ok({ error: 'You cannot freeze or close the account you are using' }, { status: 422 });
    if (body.status === 'CLOSED' && (body.closeReason ?? '').trim().length < 3) return ok({ error: 'A reason is required to close an account' }, { status: 422 });
    if (body.status !== current.status) {
      data.status = body.status;
      data.closedAt = body.status === 'CLOSED' ? new Date() : null;
      data.closedReason = body.status === 'CLOSED' ? body.closeReason!.trim() : null;
      changed.status = { from: current.status, to: body.status };
    }
  }
  if (body.kycStatus && ['VERIFIED', 'PENDING', 'UNVERIFIED'].includes(body.kycStatus)) data.kycStatus = body.kycStatus;
  if (body.kycTier && [1, 2, 3].includes(body.kycTier)) data.kycTier = body.kycTier;
  if (body.kycStatus && body.kycStatus !== current.kycStatus) changed.kycStatus = { from: current.kycStatus, to: body.kycStatus };
  if (body.kycTier && body.kycTier !== current.kycTier) changed.kycTier = { from: current.kycTier, to: body.kycTier };
  if (body.role && ['CUSTOMER', 'ADMIN'].includes(body.role)) {
    if (current.id === admin.id && body.role !== 'ADMIN') return ok({ error: 'You cannot remove your own Management access' }, { status: 422 });
    if (body.role !== current.role) { data.role = body.role; changed.role = { from: current.role, to: body.role }; }
  }

  const wouldRemoveLastManager = current.role === 'ADMIN'
    && (data.role === 'CUSTOMER' || (data.status !== undefined && data.status !== 'ACTIVE'));
  if (wouldRemoveLastManager) {
    const activeManagers = await db.user.count({ where: { role: 'ADMIN', status: 'ACTIVE' } });
    if (activeManagers <= 1) return ok({ error: 'Keep at least one active Management account' }, { status: 422 });
  }
  if (!Object.keys(data).length) return ok({ error: 'Nothing to update' }, { status: 422 });

  const updated = await db.user.update({ where: { id: body.id }, data });
  if (body.status === 'FROZEN') {
    await notifyUser(body.id, 'SYSTEM', 'Account frozen', 'Your account has been frozen by the compliance team. Contact support for details.');
  }
  if (body.status === 'ACTIVE') {
    await notifyUser(body.id, 'SYSTEM', 'Account restored', 'Your account has been reactivated. Welcome back.');
  }
  if (body.status === 'CLOSED') {
    await notifyUser(body.id, 'SYSTEM', 'Account closed', `Your account was closed by Management. Reason: ${body.closeReason?.trim()}`);
  }
  if (body.kycStatus === 'VERIFIED') {
    await notifyUser(body.id, 'SYSTEM', 'Identity verified', 'Your verification is complete: higher limits are now unlocked.');
  }
  await audit(admin.id, admin.email, 'ADMIN_USER_UPDATE', `${updated.email}: ${JSON.stringify(changed)}`);
  return ok({ success: true, user: { id: updated.id, name: updated.name, email: updated.email, status: updated.status } });
});

export const runtime = 'nodejs';
