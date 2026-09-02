import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { createSession, hashPassword, genWalletAddress } from '@/lib/session';
import { fail, handler, ok, readJson, clientIp } from '@/lib/api';
import { audit, notifyAdmins, notifyUser, securityEvent } from '@/lib/notify';
import { postLedger, ensureWallet } from '@/lib/ledger';
import { genReference } from '@/lib/session';
import { getBool, getNumber } from '@/lib/settings';
import { ensureSeeded } from '@/lib/bootstrap';

export const POST = handler(async (req: NextRequest) => {
  // First-boot safety: make sure the asset universe exists on a fresh deploy.
  await ensureSeeded();
  const body = await readJson<{ name?: string; email?: string; password?: string; country?: string }>(req);
  const name = (body.name ?? '').trim();
  const email = (body.email ?? '').trim().toLowerCase();
  const password = body.password ?? '';
  const country = (body.country ?? '').trim() || null;

  if (name.length < 2) return fail('Enter your full name', 422);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return fail('Enter a valid email address', 422);
  if (password.length < 8) return fail('Password must be at least 8 characters', 422);

  const signupsOpen = await getBool('platform.signups');
  if (!signupsOpen) return fail('New registrations are currently closed', 403);

  const existing = await db.user.findUnique({ where: { email } });
  if (existing) return fail('An account with this email already exists', 409);

  const passwordHash = await hashPassword(password);
  const user = await db.user.create({
    data: { name, email, passwordHash, role: 'CUSTOMER', country, kycStatus: 'PENDING', kycTier: 1 },
  });

  // Welcome bonus posted through the atomic ledger (real funds, real entries)
  const bonus = await getNumber('platform.welcomeBonusUsd', 0);
  const usdWallet = await ensureWallet(user.id, 'USD', genWalletAddress('USD'), 'Cash (USD)');
  if (bonus > 0) {
    await postLedger({
      type: 'BONUS',
      userId: user.id,
      reference: genReference('BONUS'),
      description: 'Welcome bonus',
      meta: { reason: 'account_registration' },
      lines: [{ walletId: usdWallet.id, direction: 'CREDIT', amount: bonus, memo: 'Welcome bonus' }],
    });
    await notifyUser(user.id, 'PROMO', 'Welcome bonus credited', `$${bonus.toFixed(2)} has been credited to your USD cash balance. Happy trading!`);
  }

  await ensureWallet(user.id, 'BTC', genWalletAddress('BTC'), 'Bitcoin wallet');
  await ensureWallet(user.id, 'ETH', genWalletAddress('ETH'), 'Ethereum wallet');
  await ensureWallet(user.id, 'SOL', genWalletAddress('SOL'), 'Solana wallet');

  const { tabToken } = await createSession({
    userId: user.id, email: user.email, role: 'CUSTOMER', name: user.name,
  });

  await securityEvent(user.id, 'LOGIN', clientIp(req), req.headers.get('user-agent') ?? undefined, 'Account created');
  await audit(user.id, user.email, 'REGISTER', 'Account created');
  await notifyAdmins('SECURITY', 'New registration', `${user.name} (${user.email}) joined Coin Private.`);

  const res = NextResponse.json({
    token: tabToken,
    user: { id: user.id, email: user.email, name: user.name, role: user.role, kycStatus: user.kycStatus, kycTier: user.kycTier },
  });
  res.cookies.set('cp_session', tabToken, { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 12 * 60 * 60 });
  return res;
});

export const runtime = 'nodejs';
