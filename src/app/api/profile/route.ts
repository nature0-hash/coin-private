import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAuth, handler, ok, readJson } from '@/lib/api';
import { audit } from '@/lib/notify';

// PATCH /api/profile: update profile fields
export const PATCH = handler(async (req: NextRequest) => {
  const user = await requireAuth(req);
  const body = await readJson<{ name?: string; phone?: string; address?: string; country?: string; avatarUrl?: string }>(req);

  const data: Record<string, string> = {};
  if (body.name !== undefined) {
    if (body.name.trim().length < 2) return ok({ error: 'Name must be at least 2 characters' }, { status: 422 });
    data.name = body.name.trim();
  }
  if (body.phone !== undefined) data.phone = body.phone.trim();
  if (body.address !== undefined) data.address = body.address.trim();
  if (body.country !== undefined) data.country = body.country.trim();
  if (body.avatarUrl !== undefined) data.avatarUrl = body.avatarUrl;

  const updated = await db.user.update({ where: { id: user.id }, data });
  await audit(user.id, user.email, 'PROFILE_UPDATE', 'Profile updated');

  return ok({
    success: true,
    user: {
      id: updated.id, email: updated.email, name: updated.name, role: updated.role,
      phone: updated.phone, address: updated.address, country: updated.country,
      avatarUrl: updated.avatarUrl, kycStatus: updated.kycStatus, kycTier: updated.kycTier,
      twoFactorEnabled: updated.twoFactorEnabled, status: updated.status,
    },
  });
});

export const runtime = 'nodejs';
