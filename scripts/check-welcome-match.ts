import { db } from '../src/lib/db';
import { getWelcomeMatchSnapshot, managementReleaseWelcomeMatch, recordExecutedTrade } from '../src/lib/welcome-match';

function expect(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

async function main() {
  const unique = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const base = new Date();
  base.setUTCHours(12, 0, 0, 0);

  await db.asset.upsert({
    where: { symbol: 'USD' },
    update: {},
    create: { symbol: 'USD', name: 'US Dollar', kind: 'FIAT', decimals: 2, priceUsd: 1 },
  });
  for (const [key, value] of Object.entries({
    'promo.firstWeekMatch.enabled': 'true',
    'promo.firstWeekMatch.windowDays': '7',
    'promo.firstWeekMatch.streakDays': '3',
    'promo.firstWeekMatch.minDailyUsd': '1000',
    'promo.firstWeekMatch.matchPercent': '100',
    'promo.firstWeekMatch.maxBonusUsd': '250000',
  })) {
    await db.setting.upsert({ where: { key }, update: { value }, create: { key, value } });
  }

  const user = await db.user.create({
    data: {
      email: `welcome-match-${unique}@test.invalid`,
      name: 'Welcome Match Test',
      passwordHash: 'test-only',
      createdAt: base,
      wallets: {
        create: {
          assetSymbol: 'USD',
          available: 5000,
          address: `CP-USD-${unique}`,
        },
      },
    },
  });

  try {
    for (let day = 0; day < 3; day += 1) {
      const now = new Date(base.getTime() + day * 86_400_000);
      const order = await db.order.create({
        data: {
          userId: user.id,
          reference: `CP-MATCH-TEST-${unique}-${day}`,
          side: 'BUY',
          baseSymbol: 'BTC',
          quoteSymbol: 'USD',
          amountBase: 0.01,
          amountQuote: 1000,
          price: 100000,
          status: 'EXECUTED',
          createdAt: now,
        },
      });
      await recordExecutedTrade(order.id, now);
      const progress = await getWelcomeMatchSnapshot(user.id, now);
      expect(progress.streakDays === day + 1, `Expected streak day ${day + 1}, received ${progress.streakDays}`);
    }

    const locked = await getWelcomeMatchSnapshot(user.id, new Date(base.getTime() + 2 * 86_400_000));
    expect(locked.status === 'LOCKED', `Expected LOCKED status, received ${locked.status}`);
    expect(locked.targetUsd === 1000, `Expected a $1,000 target, received ${locked.targetUsd}`);
    expect(locked.bonusUsd === 1000, `Expected a $1,000 bonus, received ${locked.bonusUsd}`);

    const beforeRelease = await db.wallet.findUniqueOrThrow({
      where: { userId_assetSymbol: { userId: user.id, assetSymbol: 'USD' } },
    });
    expect(beforeRelease.available === 5000, 'Customer principal should remain available');
    expect(beforeRelease.reserved === 1000, 'Promotional match should be reserved');

    await managementReleaseWelcomeMatch(user.id);
    const released = await getWelcomeMatchSnapshot(user.id);
    const afterRelease = await db.wallet.findUniqueOrThrow({
      where: { userId_assetSymbol: { userId: user.id, assetSymbol: 'USD' } },
    });
    expect(released.status === 'RELEASED', `Expected RELEASED status, received ${released.status}`);
    expect(afterRelease.available === 6000, 'Released promotional match should become available');
    expect(afterRelease.reserved === 0, 'No promotional balance should remain reserved');

    console.log('Welcome match checks passed: 3-day streak, locked bonus, principal safety, and release.');
  } finally {
    await db.user.delete({ where: { id: user.id } }).catch(() => undefined);
    await db.$disconnect();
  }
}

main().catch(async (error) => {
  console.error(error);
  await db.$disconnect();
  process.exit(1);
});
