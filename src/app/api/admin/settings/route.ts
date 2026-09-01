import { NextRequest } from 'next/server';
import { requireAdmin, handler, ok, readJson } from '@/lib/api';
import { getSettings, setSettings, SETTING_DEFAULTS } from '@/lib/settings';
import { audit } from '@/lib/notify';
import { getPriceSnapshot } from '@/lib/prices';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);
  const settings = await getSettings(true);
  const snap = await getPriceSnapshot(true); // force refresh to test provider health
  return ok({
    settings,
    keys: Object.keys(SETTING_DEFAULTS),
    priceHealth: { provider: snap.provider, updatedAt: snap.updatedAt, symbols: Object.keys(snap.quotes).length },
  });
});

export const PUT = handler(async (req: NextRequest) => {
  const admin = await requireAdmin(req);
  const body = await readJson<Record<string, string>>(req);
  const entries: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (k in SETTING_DEFAULTS && typeof v === 'string') entries[k] = v;
  }
  if (!Object.keys(entries).length) return ok({ error: 'No valid settings provided' }, { status: 422 });
  await setSettings(entries);
  await audit(admin.id, admin.email, 'ADMIN_SETTINGS', JSON.stringify(entries));
  const settings = await getSettings(true);
  return ok({ success: true, settings });
});

export const runtime = 'nodejs';
