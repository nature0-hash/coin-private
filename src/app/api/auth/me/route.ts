import { NextRequest } from 'next/server';
import { auth, handler, ok } from '@/lib/api';
import { ensureSeeded } from '@/lib/bootstrap';

export const GET = handler(async (req: NextRequest) => {
  await ensureSeeded(); // first-boot provisioning on fresh deploys
  const user = await auth(req);
  if (!user) return ok({ user: null });
  return ok({
    user: {
      id: user.id, email: user.email, loginId: user.loginId, name: user.name, role: user.role,
      status: user.status, phone: user.phone, address: user.address, country: user.country,
      avatarUrl: user.avatarUrl, kycStatus: user.kycStatus, kycTier: user.kycTier,
      twoFactorEnabled: user.twoFactorEnabled, createdAt: user.createdAt,
    },
  });
});

export const runtime = 'nodejs';
