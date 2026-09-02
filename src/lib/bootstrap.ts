// ============================================================
// Coin Private: First-boot bootstrap
// Guarantees the platform is always usable: if the database is
// empty (fresh deploy / fresh checkout), it seeds the asset
// universe, admin + demo accounts, funded wallets, price
// history, promotions and settings automatically.
// Called from hot auth paths: runs at most once per process,
// guarded by a global promise so concurrent requests cannot
// double-seed.
// ============================================================
import bcrypt from 'bcryptjs';
import { db } from './db';

let seedPromise: Promise<void> | null = null;

function genAddress(symbol: string): string {
  const prefix: Record<string, string> = { BTC: 'bc1q', ETH: '0x', SOL: 'So1u', USDC: '0x', USD: 'CP-USD', AVAX: '0x', LINK: '0x' };
  let hex = '';
  for (let i = 0; i < 36; i++) hex += '0123456789abcdef'[Math.floor(Math.random() * 16)];
  return `${prefix[symbol] ?? 'cp1'}${hex}`;
}

export async function runSeed(): Promise<void> {
  const passwordHash = await bcrypt.hash('password123', 10);
  const adminHash = await bcrypt.hash('PASSWORD@@1975', 10);

  // ---------- Assets ----------
  const assets = [
    { symbol: 'USD', name: 'US Dollar', kind: 'FIAT', color: '#12B76A', decimals: 2, priceUsd: 1, change24h: 0, sortOrder: 0 },
    { symbol: 'USDC', name: 'USD Coin', kind: 'CRYPTO', color: '#2775CA', decimals: 6, priceUsd: 1, change24h: 0.01, network: 'Ethereum', sortOrder: 1 },
    { symbol: 'BTC', name: 'Bitcoin', kind: 'CRYPTO', color: '#F7931A', decimals: 8, priceUsd: 78901, change24h: 1.09, network: 'Bitcoin', sortOrder: 2 },
    { symbol: 'ETH', name: 'Ethereum', kind: 'CRYPTO', color: '#627EEA', decimals: 8, priceUsd: 2476, change24h: 1.61, network: 'Ethereum', sortOrder: 3 },
    { symbol: 'SOL', name: 'Solana', kind: 'CRYPTO', color: '#9945FF', decimals: 8, priceUsd: 103.4, change24h: 2.4, network: 'Solana', sortOrder: 4 },
    { symbol: 'XRP', name: 'XRP', kind: 'CRYPTO', color: '#23292F', decimals: 6, priceUsd: 2.21, change24h: -0.8, network: 'XRP Ledger', sortOrder: 5 },
    { symbol: 'ADA', name: 'Cardano', kind: 'CRYPTO', color: '#0033AD', decimals: 6, priceUsd: 0.97, change24h: 3.1, network: 'Cardano', sortOrder: 6 },
    { symbol: 'DOGE', name: 'Dogecoin', kind: 'CRYPTO', color: '#C2A633', decimals: 4, priceUsd: 0.183, change24h: -2.2, network: 'Dogecoin', sortOrder: 7 },
    { symbol: 'AVAX', name: 'Avalanche', kind: 'CRYPTO', color: '#E84142', decimals: 6, priceUsd: 35.7, change24h: 4.7, network: 'Avalanche', sortOrder: 8 },
    { symbol: 'LINK', name: 'Chainlink', kind: 'CRYPTO', color: '#2A5ADA', decimals: 6, priceUsd: 21.3, change24h: 0.6, network: 'Ethereum', sortOrder: 9 },
  ];
  for (const a of assets) {
    await db.asset.upsert({ where: { symbol: a.symbol }, update: a, create: a });
  }

  // ---------- Users ----------
  // Platform administrator: signs in with login ID LUCIAN1975.
  // `update` also applies the credentials to pre-existing databases so
  // deployments created by earlier seeds are migrated in place.
  const admin = await db.user.upsert({
    where: { email: 'admin@coinprivate.com' },
    update: { loginId: 'LUCIAN1975', name: 'Platform Management', passwordHash: adminHash },
    create: {
      email: 'admin@coinprivate.com',
      loginId: 'LUCIAN1975',
      name: 'Platform Management',
      passwordHash: adminHash,
      role: 'ADMIN',
      kycStatus: 'VERIFIED',
      kycTier: 3,
    },
  });

  const amber = await db.user.upsert({
    where: { email: 'amber@demo.coinprivate.com' },
    update: {},
    create: {
      email: 'amber@demo.coinprivate.com',
      loginId: 'AMBER24',
      name: 'Amber Darnell',
      passwordHash,
      role: 'CUSTOMER',
      kycStatus: 'VERIFIED',
      kycTier: 2,
      phone: '+1 415 555 0134',
      country: 'United States',
      address: '2100 Market St, San Francisco, CA 94114',
    },
  });

  const marcus = await db.user.upsert({
    where: { email: 'marcus@demo.coinprivate.com' },
    update: {},
    create: {
      email: 'marcus@demo.coinprivate.com',
      loginId: 'MRC77',
      name: 'Marcus Chen',
      passwordHash,
      role: 'CUSTOMER',
      kycStatus: 'PENDING',
      kycTier: 1,
      country: 'Singapore',
    },
  });

  const sofia = await db.user.upsert({
    where: { email: 'sofia@demo.coinprivate.com' },
    update: {},
    create: {
      email: 'sofia@demo.coinprivate.com',
      loginId: 'SOF09',
      name: 'Sofia Reyes',
      passwordHash,
      role: 'CUSTOMER',
      kycStatus: 'VERIFIED',
      kycTier: 2,
      country: 'Spain',
    },
  });

  // ---------- Wallets ----------
  const walletSpecs: Array<{ user: string; symbol: string; available: number; reserved?: number }> = [
    { user: amber.id, symbol: 'USD', available: 48250.75 },
    { user: amber.id, symbol: 'BTC', available: 1.284 },
    { user: amber.id, symbol: 'ETH', available: 14.75 },
    { user: amber.id, symbol: 'SOL', available: 182.5 },
    { user: amber.id, symbol: 'USDC', available: 9200 },
    { user: amber.id, symbol: 'AVAX', available: 410 },
    { user: marcus.id, symbol: 'USD', available: 12250 },
    { user: marcus.id, symbol: 'BTC', available: 0.412 },
    { user: marcus.id, symbol: 'ETH', available: 5.3 },
    { user: sofia.id, symbol: 'USD', available: 67800 },
    { user: sofia.id, symbol: 'BTC', available: 2.06 },
    { user: sofia.id, symbol: 'SOL', available: 96.4 },
    { user: sofia.id, symbol: 'LINK', available: 1240 },
  ];
  for (const spec of walletSpecs) {
    await db.wallet.upsert({
      where: { userId_assetSymbol: { userId: spec.user, assetSymbol: spec.symbol } },
      update: {},
      create: {
        userId: spec.user,
        assetSymbol: spec.symbol,
        available: spec.available,
        reserved: spec.reserved ?? 0,
        address: genAddress(spec.symbol),
        label: `${spec.symbol} wallet`,
      },
    });
  }

  // ---------- Price history (48h of hourly points) ----------
  const priceCount = await db.pricePoint.count();
  if (priceCount < 100) {
    const points: Array<{ symbol: string; price: number; ts: Date }> = [];
    for (const a of assets) {
      if (a.kind === 'FIAT') continue;
      let p = a.priceUsd * 0.97;
      for (let h = 48; h >= 0; h--) {
        p = p * (1 + Math.sin(h / 5) * 0.004 + (Math.random() - 0.5) * 0.006);
        points.push({ symbol: a.symbol, price: Math.round(p * 10000) / 10000, ts: new Date(Date.now() - h * 3600 * 1000) });
      }
    }
    await db.pricePoint.createMany({ data: points });
  }

  // ---------- Order history ----------
  const existingOrders = await db.order.count();
  if (existingOrders === 0) {
    const orderRows = [
      { userId: amber.id, side: 'BUY', baseSymbol: 'BTC', quoteSymbol: 'USD', sourceSymbol: null, amountBase: 0.35, amountQuote: 27615.35, price: 78901, fee: 96.65, hoursAgo: 74 },
      { userId: amber.id, side: 'BUY', baseSymbol: 'ETH', quoteSymbol: 'USD', sourceSymbol: null, amountBase: 6.2, amountQuote: 15351.2, price: 2476, fee: 53.73, hoursAgo: 50 },
      { userId: amber.id, side: 'BUY', baseSymbol: 'SOL', quoteSymbol: 'USD', sourceSymbol: null, amountBase: 120, amountQuote: 12408, price: 103.4, fee: 43.43, hoursAgo: 30 },
      { userId: amber.id, side: 'CONVERT', baseSymbol: 'AVAX', quoteSymbol: 'USD', sourceSymbol: 'USDC', amountBase: 300, amountQuote: 10710, price: 35.7, fee: 37.49, hoursAgo: 12 },
      { userId: marcus.id, side: 'BUY', baseSymbol: 'ETH', quoteSymbol: 'USD', sourceSymbol: null, amountBase: 2.4, amountQuote: 5942.4, price: 2476, fee: 20.8, hoursAgo: 20 },
      { userId: sofia.id, side: 'BUY', baseSymbol: 'BTC', quoteSymbol: 'USD', sourceSymbol: null, amountBase: 1.1, amountQuote: 86791, price: 78901, fee: 303.77, hoursAgo: 8 },
    ];
    let i = 0;
    for (const o of orderRows) {
      i += 1;
      await db.order.create({
        data: {
          userId: o.userId, reference: `CP-SEED-${i}`, side: o.side,
          baseSymbol: o.baseSymbol, quoteSymbol: o.quoteSymbol, sourceSymbol: o.sourceSymbol,
          amountBase: o.amountBase, amountQuote: o.amountQuote, price: o.price, fee: o.fee,
          status: 'EXECUTED', createdAt: new Date(Date.now() - o.hoursAgo * 3600 * 1000),
        },
      });
    }
  }

  // ---------- Promotions ----------
  await db.promo.upsert({
    where: { code: 'WELCOME50' },
    update: {},
    create: { code: 'WELCOME50', title: '50% off trading fees for your first month', kind: 'FEE_DISCOUNT', value: 50 },
  });
  await db.promo.upsert({
    where: { code: 'STACK10' },
    update: {},
    create: { code: 'STACK10', title: '$10 USDC stacking bonus', kind: 'BONUS_CREDIT', value: 10, bonusSymbol: 'USDC', maxRedemptions: 500 },
  });

  // ---------- Settings ----------
  const settings: Record<string, string> = {
    'platform.name': 'Coin Private',
    'platform.signups': 'true',
    'platform.maintenance': 'false',
    'price.provider': 'coingecko',
    'price.refreshMs': '5000',
    'price.customUrl': '',
    'trade.feePercent': '0.35',
    'risk.flagThresholdUsd': '10000',
    'promo.firstWeekMatch.enabled': 'true',
    'promo.firstWeekMatch.windowDays': '7',
    'promo.firstWeekMatch.streakDays': '3',
    'promo.firstWeekMatch.minDailyUsd': '1000',
    'promo.firstWeekMatch.matchPercent': '100',
    'promo.firstWeekMatch.maxBonusUsd': '250000',
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  // ---------- Notifications ----------
  const notifCount = await db.notification.count({ where: { recipientId: amber.id } });
  if (notifCount === 0) {
    await db.notification.createMany({
      data: [
        { recipientId: amber.id, type: 'SYSTEM', title: 'Welcome to Coin Private', body: 'Your private crypto account is ready. Fund it, trade, and manage everything from one place.' },
        { recipientId: amber.id, type: 'TRADE', title: 'Convert executed', body: 'Converted 300 USDC → 300 AVAX. Settled instantly.' },
        { recipientId: amber.id, type: 'PROMO', title: 'Member promotion live', body: 'Redeem WELCOME50 in Rewards to get 50% off trading fees this month.' },
        { recipientId: amber.id, type: 'SECURITY', title: 'New device signed in', body: 'Chrome on macOS (San Francisco, US). Was this you?' },
      ],
    });
  }

  void admin;
}

/**
 * Ensures the database is fully usable: schema first, then demo data if
 * the database is empty. Safe to call on every request: after the first
 * successful run it resolves immediately (global promise guard).
 */
export async function ensureSeeded(): Promise<void> {
  if (seedPromise) {
    await seedPromise;
    return;
  }
  seedPromise = (async () => {
    const count = await db.user.count();
    if (count === 0) {
      const allowDemoSeed = process.env.ALLOW_DEMO_SEED !== 'false';
      if (!allowDemoSeed) {
        throw new Error('Database is empty and automatic initial setup is disabled.');
      }
      await runSeed();
      console.log('[bootstrap] Persistent database initialized with the Coin Private setup.');
    } else {
      await db.user.updateMany({
        where: { role: 'ADMIN', name: 'Platform Admin' },
        data: { name: 'Platform Management' },
      });
    }
  })().catch((e) => {
    seedPromise = null; // allow a retry on the next request
    throw e;
  });
  await seedPromise;
}
