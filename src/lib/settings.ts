// ============================================================
// Coin Private: Platform Settings service
// Key/value store editable from Admin → Settings with env
// fallbacks. Cached in memory for cheap reads on hot paths.
// ============================================================
import { db } from '@/lib/db';

export const SETTING_DEFAULTS: Record<string, string> = {
  'platform.name': 'Coin Private',
  'platform.maintenance': 'false',
  'platform.signups': 'true',
  'platform.welcomeBonusUsd': '100',
  'promo.firstWeekMatch.enabled': 'true',
  'promo.firstWeekMatch.windowDays': '7',
  'promo.firstWeekMatch.streakDays': '3',
  'promo.firstWeekMatch.minDailyUsd': '1000',
  'promo.firstWeekMatch.matchPercent': '100',
  'promo.firstWeekMatch.maxBonusUsd': '250000',
  'trade.feePercent': '0.35',
  'trade.minOrderUsd': '5',
  'trade.maxOrderUsd': '250000',
  'transfer.sendFeePercent': '0.1',
  'withdraw.feePercent': '0.05',
  'withdraw.dailyLimitUsd': '100000',
  'risk.flagThresholdUsd': '10000', // trades above this need admin pre-approval
  'price.provider': 'coingecko', // coingecko (live) | simulated | custom
  'price.refreshMs': '5000',
  'price.customUrl': '',
};

type CacheShape = { data: Record<string, string>; loadedAt: number };

const g = globalThis as unknown as { __cpSettings?: CacheShape };
const TTL = 10_000;

export async function getSettings(force = false): Promise<Record<string, string>> {
  const cache = g.__cpSettings;
  if (!force && cache && Date.now() - cache.loadedAt < TTL) return cache.data;
  const rows = await db.setting.findMany();
  const data = { ...SETTING_DEFAULTS };
  for (const r of rows) data[r.key] = r.value;
  g.__cpSettings = { data, loadedAt: Date.now() };
  return data;
}

export async function getSetting(key: string): Promise<string> {
  const s = await getSettings();
  return s[key] ?? SETTING_DEFAULTS[key] ?? '';
}

export async function getNumber(key: string, fallback = 0): Promise<number> {
  const v = await getSetting(key);
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : fallback;
}

export async function getBool(key: string): Promise<boolean> {
  return (await getSetting(key)) === 'true';
}

export async function setSetting(key: string, value: string): Promise<void> {
  await db.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
  await getSettings(true);
}

export async function setSettings(entries: Record<string, string>): Promise<void> {
  for (const [key, value] of Object.entries(entries)) {
    if (key in SETTING_DEFAULTS) {
      await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
    }
  }
  await getSettings(true);
}
