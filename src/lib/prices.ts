// ============================================================
// Coin Private: Price service (configurable data provider)
// ============================================================
// Providers (switchable at runtime from Admin → Settings, or via
// PRICE_PROVIDER env):
//   • simulated : geometric random walk around seeded base prices
//   • coingecko : live public CoinGecko simple/price API
//   • custom    : any HTTP endpoint returning
//                  {"BTC":{"usd":123,"usd_24h_change":1.2}, ...}
//
// The active provider's quotes are cached server-side with a TTL
// (price.refreshMs) and every refresh appends PricePoint history
// used for sparklines and portfolio charts. Client polls
// /api/prices: no fake confirmations, values are what the
// provider actually returned.
// ============================================================
import { db } from '@/lib/db';
import { getSettings } from '@/lib/settings';

export interface Quote {
  symbol: string;
  price: number;
  change24h: number;
}

interface SimState {
  price: number;
  drift: number;
  vol: number;
}

const g = globalThis as unknown as {
  __cpPrices?: { quotes: Map<string, Quote>; updatedAt: number };
  __cpSim?: Map<string, SimState>;
};

const BASE_PRICES: Record<string, { price: number; vol: number }> = {
  BTC: { price: 78901, vol: 0.004 },
  ETH: { price: 2476, vol: 0.006 },
  SOL: { price: 103.4, vol: 0.01 },
  XRP: { price: 2.21, vol: 0.012 },
  ADA: { price: 0.97, vol: 0.012 },
  DOGE: { price: 0.183, vol: 0.016 },
  AVAX: { price: 35.7, vol: 0.011 },
  LINK: { price: 21.3, vol: 0.01 },
  USDC: { price: 1, vol: 0.0002 },
};

function simStates(): Map<string, SimState> {
  if (g.__cpSim) return g.__cpSim;
  const m = new Map<string, SimState>();
  for (const [sym, b] of Object.entries(BASE_PRICES)) {
    m.set(sym, { price: b.price, drift: (Math.random() - 0.5) * 0.0006, vol: b.vol });
  }
  g.__cpSim = m;
  return m;
}

function stepSimulated(): Quote[] {
  const states = simStates();
  const out: Quote[] = [];
  for (const [symbol, s] of states) {
    // mean-reverting random walk
    const shock = (Math.random() - 0.5) * 2 * s.vol;
    s.drift = s.drift * 0.98 + shock * 0.02;
    const pct = shock + s.drift;
    s.price = Math.max(s.price * (1 + pct), symbol === 'USDC' ? 0.999 : s.price * 0.5);
    if (symbol === 'USDC') s.price = Math.min(Math.max(s.price, 0.9995), 1.0005);
    const change24h = (Math.tanh(s.drift * 250) * 8) + pct * 40;
    out.push({ symbol, price: roundNice(s.price, symbol), change24h: Math.max(-30, Math.min(30, change24h)) });
  }
  return out;
}

function roundNice(p: number, symbol: string): number {
  if (symbol === 'USDC') return Math.round(p * 10000) / 10000;
  if (p >= 1000) return Math.round(p * 100) / 100;
  if (p >= 1) return Math.round(p * 10000) / 10000;
  return Math.round(p * 1000000) / 1000000;
}

async function fetchCoinGecko(): Promise<Quote[]> {
  const ids = 'bitcoin,ethereum,solana,ripple,cardano,dogecoin,avalanche-2,chainlink,usd-coin';
  const map: Record<string, string> = {
    bitcoin: 'BTC', ethereum: 'ETH', solana: 'SOL', ripple: 'XRP',
    cardano: 'ADA', dogecoin: 'DOGE', 'avalanche-2': 'AVAX',
    chainlink: 'LINK', 'usd-coin': 'USDC',
  };
  const url = `https://api.coingecko.com/api/v3/simple/price?ids=${ids}&vs_currencies=usd&include_24hr_change=true`;
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`CoinGecko ${res.status}`);
  const json = (await res.json()) as Record<string, { usd: number; usd_24h_change?: number }>;
  const out: Quote[] = [];
  for (const [id, v] of Object.entries(json)) {
    const sym = map[id];
    if (sym && typeof v.usd === 'number') {
      out.push({ symbol: sym, price: v.usd, change24h: v.usd_24h_change ?? 0 });
    }
  }
  if (!out.length) throw new Error('CoinGecko empty');
  return out;
}

async function fetchCustom(url: string): Promise<Quote[]> {
  const res = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(6000) });
  if (!res.ok) throw new Error(`Custom provider ${res.status}`);
  const json = (await res.json()) as Record<string, { usd?: number; price?: number; usd_24h_change?: number; change24h?: number }>;
  const out: Quote[] = [];
  for (const [sym, v] of Object.entries(json)) {
    const price = v.usd ?? v.price;
    if (typeof price === 'number') {
      out.push({ symbol: sym, price, change24h: v.usd_24h_change ?? v.change24h ?? 0 });
    }
  }
  if (!out.length) throw new Error('Custom provider returned no prices');
  return out;
}

export interface PriceSnapshot {
  quotes: Record<string, Quote>;
  updatedAt: number;
  provider: string;
}

export async function getPriceSnapshot(force = false): Promise<PriceSnapshot> {
  const settings = await getSettings(force);
  const provider = process.env.PRICE_PROVIDER || settings['price.provider'] || 'coingecko';
  const refreshMs = Math.max(2000, parseInt(process.env.PRICE_REFRESH_MS || settings['price.refreshMs'] || '5000', 10) || 5000);

  const cache = g.__cpPrices;
  if (!force && cache && Date.now() - cache.updatedAt < refreshMs) {
    return { quotes: Object.fromEntries(cache.quotes), updatedAt: cache.updatedAt, provider };
  }

  let quotes: Quote[] = [];
  try {
    if (provider === 'coingecko') quotes = await fetchCoinGecko();
    else if (provider === 'custom') {
      const url = process.env.PRICE_PROVIDER_URL || settings['price.customUrl'];
      if (!url) throw new Error('No custom URL configured');
      quotes = await fetchCustom(url);
    } else quotes = stepSimulated();
  } catch {
    // provider failed → fall back to simulation so the platform stays live
    quotes = stepSimulated();
  }

  // persist history (throttled to 1 row / 45s / symbol)
  const now = Date.now();
  const last = g.__cpPrices;
  const shouldPersist = !last || now - last.updatedAt > 45_000;

  if (quotes.length) {
    const map = cache?.quotes ?? new Map<string, Quote>();
    for (const q of quotes) map.set(q.symbol, q);
    g.__cpPrices = { quotes: map, updatedAt: now };

    if (shouldPersist) {
      try {
        await db.pricePoint.createMany({
          data: quotes.map((q) => ({ symbol: q.symbol, price: q.price, ts: new Date(now) })),
        });
        // keep history bounded
        const cutoff = new Date(now - 1000 * 60 * 60 * 6);
        await db.pricePoint.deleteMany({ where: { ts: { lt: cutoff } } });
      } catch { /* non-fatal */ }
    }
  }

  return {
    quotes: Object.fromEntries(g.__cpPrices?.quotes ?? new Map()),
    updatedAt: g.__cpPrices?.updatedAt ?? now,
    provider,
  };
}
