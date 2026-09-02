import { Prisma } from '@prisma/client';
import { db } from '@/lib/db';
import { postLedgerInTx, round8 } from '@/lib/ledger';
import { genReference } from '@/lib/session';
import { getBool, getNumber } from '@/lib/settings';

export interface WelcomeMatchSnapshot {
  enabled: boolean;
  status: 'ELIGIBLE' | 'ACTIVE' | 'LOCKED' | 'RELEASED' | 'EXPIRED';
  windowEndsAt: string;
  streakDays: number;
  requiredDays: number;
  targetUsd: number;
  todayTotalUsd: number;
  minimumUsd: number;
  matchPercent: number;
  maxBonusUsd: number;
  bonusUsd: number;
  unlockAt: string | null;
}

export interface WelcomeMatchEvent {
  kind: 'PROGRESS' | 'AWARDED';
  message: string;
  snapshot: WelcomeMatchSnapshot;
}

interface MatchConfig {
  enabled: boolean;
  windowDays: number;
  requiredDays: number;
  minimumUsd: number;
  matchPercent: number;
  maxBonusUsd: number;
}

function utcDay(date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

function dayNumber(day: string): number {
  return Math.floor(Date.parse(`${day}T00:00:00.000Z`) / 86_400_000);
}

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 86_400_000);
}

function monthEndUtc(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) - 1);
}

function money(value: number): string {
  return value.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 2 });
}

async function config(): Promise<MatchConfig> {
  return {
    enabled: await getBool('promo.firstWeekMatch.enabled'),
    windowDays: Math.max(1, Math.floor(await getNumber('promo.firstWeekMatch.windowDays', 7))),
    requiredDays: Math.max(1, Math.floor(await getNumber('promo.firstWeekMatch.streakDays', 3))),
    minimumUsd: Math.max(1, await getNumber('promo.firstWeekMatch.minDailyUsd', 1000)),
    matchPercent: Math.max(0, await getNumber('promo.firstWeekMatch.matchPercent', 100)),
    maxBonusUsd: Math.max(0, await getNumber('promo.firstWeekMatch.maxBonusUsd', 250000)),
  };
}

async function toSnapshot(
  userId: string,
  cfg: MatchConfig,
  now: Date,
): Promise<WelcomeMatchSnapshot> {
  const [user, progress] = await Promise.all([
    db.user.findUnique({ where: { id: userId }, select: { createdAt: true } }),
    db.welcomeMatchProgress.findUnique({ where: { userId } }),
  ]);
  const windowEndsAt = progress?.windowEndsAt ?? addDays(user?.createdAt ?? now, cfg.windowDays);
  const today = utcDay(now);
  const todayTotal = progress
    ? await db.welcomeMatchTrade.aggregate({
        where: { progressId: progress.id, tradeDay: today },
        _sum: { notionalUsd: true },
      })
    : null;
  const expired = now >= windowEndsAt && !progress?.awardLedgerTxId;
  const status = expired
    ? 'EXPIRED'
    : ((progress?.status === 'RELEASING' ? 'LOCKED' : progress?.status) ?? 'ELIGIBLE') as WelcomeMatchSnapshot['status'];
  return {
    enabled: cfg.enabled,
    status,
    windowEndsAt: windowEndsAt.toISOString(),
    streakDays: progress?.streakDays ?? 0,
    requiredDays: cfg.requiredDays,
    targetUsd: progress?.targetUsd ?? 0,
    todayTotalUsd: round8(todayTotal?._sum.notionalUsd ?? 0),
    minimumUsd: cfg.minimumUsd,
    matchPercent: cfg.matchPercent,
    maxBonusUsd: cfg.maxBonusUsd,
    bonusUsd: progress?.bonusUsd ?? 0,
    unlockAt: progress?.unlockAt?.toISOString() ?? null,
  };
}

export async function releaseMaturedWelcomeMatch(userId: string, now = new Date()): Promise<boolean> {
  const progress = await db.welcomeMatchProgress.findUnique({ where: { userId } });
  if (!progress || progress.status !== 'LOCKED' || !progress.unlockAt || progress.unlockAt > now || progress.bonusUsd <= 0) {
    return false;
  }

  return db.$transaction(async (tx) => {
    const claim = await tx.welcomeMatchProgress.updateMany({
      where: { id: progress.id, status: 'LOCKED', unlockAt: { lte: now } },
      data: { status: 'RELEASING' },
    });
    if (claim.count !== 1) return false;

    const wallet = await tx.wallet.findUnique({
      where: { userId_assetSymbol: { userId, assetSymbol: 'USD' } },
    });
    if (!wallet) throw new Error('USD wallet missing for promotional release');

    const ledger = await postLedgerInTx(tx, {
      type: 'BONUS',
      userId,
      reference: genReference('MATCH-REL'),
      description: 'First-week trading match unlocked',
      meta: { welcomeMatchProgressId: progress.id, release: true },
      lines: [{
        walletId: wallet.id,
        direction: 'CREDIT',
        from: 'reserved',
        to: 'available',
        amount: progress.bonusUsd,
        memo: 'Promotional match unlocked',
      }],
    });

    await tx.welcomeMatchProgress.update({
      where: { id: progress.id },
      data: {
        status: 'RELEASED',
        releasedAt: now,
        releaseLedgerTxId: ledger.ledgerTxId,
      },
    });
    await tx.notification.create({
      data: {
        recipientId: userId,
        type: 'PROMO',
        title: 'Promotional match unlocked',
        body: `${money(progress.bonusUsd)} is now available to trade or withdraw.`,
      },
    });
    return true;
  }, { timeout: 15000 });
}

export async function getWelcomeMatchSnapshot(userId: string, now = new Date()): Promise<WelcomeMatchSnapshot> {
  await releaseMaturedWelcomeMatch(userId, now);
  return toSnapshot(userId, await config(), now);
}

export async function recordExecutedTrade(orderId: string, now = new Date()): Promise<WelcomeMatchEvent | null> {
  const cfg = await config();
  if (!cfg.enabled || cfg.matchPercent <= 0 || cfg.maxBonusUsd <= 0) return null;

  const order = await db.order.findUnique({
    where: { id: orderId },
    include: { user: { select: { createdAt: true } } },
  });
  if (!order || order.status !== 'EXECUTED') return null;

  const windowEndsAt = addDays(order.user.createdAt, cfg.windowDays);
  if (now >= windowEndsAt) return null;

  await db.welcomeMatchProgress.upsert({
    where: { userId: order.userId },
    update: {},
    create: { userId: order.userId, windowEndsAt },
  });

  const today = utcDay(now);
  let eventKind: WelcomeMatchEvent['kind'] | null = null;

  try {
    await db.$transaction(async (tx) => {
      const progress = await tx.welcomeMatchProgress.findUnique({ where: { userId: order.userId } });
      if (!progress || ['LOCKED', 'RELEASING', 'RELEASED', 'EXPIRED'].includes(progress.status)) return;

      await tx.welcomeMatchTrade.create({
        data: {
          progressId: progress.id,
          orderId: order.id,
          tradeDay: today,
          notionalUsd: round8(order.amountQuote),
        },
      });

      const total = await tx.welcomeMatchTrade.aggregate({
        where: { progressId: progress.id, tradeDay: today },
        _sum: { notionalUsd: true },
      });
      const todayTotal = round8(total._sum.notionalUsd ?? 0);
      let streakDays = progress.streakDays;
      let targetUsd = progress.targetUsd;
      let streakStartedDay = progress.streakStartedDay;
      let lastQualifiedDay = progress.lastQualifiedDay;

      if (!lastQualifiedDay) {
        if (todayTotal < cfg.minimumUsd) return;
        streakDays = 1;
        targetUsd = todayTotal;
        streakStartedDay = today;
        lastQualifiedDay = today;
        eventKind = 'PROGRESS';
      } else {
        const gap = dayNumber(today) - dayNumber(lastQualifiedDay);
        if (gap === 0) return;
        if (gap === 1) {
          if (todayTotal + 1e-9 < targetUsd) return;
          streakDays += 1;
          lastQualifiedDay = today;
          eventKind = 'PROGRESS';
        } else {
          if (todayTotal < cfg.minimumUsd) {
            await tx.welcomeMatchProgress.update({
              where: { id: progress.id },
              data: { status: 'ELIGIBLE', streakDays: 0, targetUsd: 0, streakStartedDay: null, lastQualifiedDay: null },
            });
            return;
          }
          streakDays = 1;
          targetUsd = todayTotal;
          streakStartedDay = today;
          lastQualifiedDay = today;
          eventKind = 'PROGRESS';
        }
      }

      if (streakDays < cfg.requiredDays) {
        await tx.welcomeMatchProgress.update({
          where: { id: progress.id },
          data: { status: 'ACTIVE', streakDays, targetUsd, streakStartedDay, lastQualifiedDay },
        });
        await tx.notification.create({
          data: {
            recipientId: order.userId,
            type: 'PROMO',
            title: `Trading match streak: day ${streakDays} of ${cfg.requiredDays}`,
            body: `Trade at least ${money(targetUsd)} on the next consecutive day to keep your first-week match streak active.`,
          },
        });
        return;
      }

      const bonusUsd = round8(Math.min(targetUsd * (cfg.matchPercent / 100), cfg.maxBonusUsd));
      const claim = await tx.welcomeMatchProgress.updateMany({
        where: { id: progress.id, awardLedgerTxId: null, status: { in: ['ELIGIBLE', 'ACTIVE'] } },
        data: { status: 'LOCKED', streakDays, targetUsd, streakStartedDay, lastQualifiedDay, bonusUsd },
      });
      if (claim.count !== 1) return;

      const wallet = await tx.wallet.findUnique({
        where: { userId_assetSymbol: { userId: order.userId, assetSymbol: 'USD' } },
      });
      if (!wallet) throw new Error('USD wallet missing for promotional match');

      const unlockAt = monthEndUtc(now);
      const ledger = await postLedgerInTx(tx, {
        type: 'BONUS',
        userId: order.userId,
        reference: genReference('MATCH'),
        description: 'First-week three-day trading match',
        meta: { welcomeMatchProgressId: progress.id, targetUsd, streakDays, unlockAt: unlockAt.toISOString() },
        lines: [{
          walletId: wallet.id,
          direction: 'CREDIT',
          to: 'reserved',
          amount: bonusUsd,
          memo: 'First-week promotional match',
        }],
      });
      await tx.welcomeMatchProgress.update({
        where: { id: progress.id },
        data: {
          status: 'LOCKED',
          streakDays,
          targetUsd,
          bonusUsd,
          unlockAt,
          awardedAt: now,
          awardLedgerTxId: ledger.ledgerTxId,
        },
      });
      await tx.notification.create({
        data: {
          recipientId: order.userId,
          type: 'PROMO',
          title: 'Your first-week match is complete',
          body: `${money(bonusUsd)} was added to your promotional balance. It becomes withdrawable on ${unlockAt.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })}. Your own available funds remain withdrawable.`,
        },
      });
      eventKind = 'AWARDED';
    }, { timeout: 15000 });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') return null;
    throw error;
  }

  if (!eventKind) return null;
  const snapshot = await toSnapshot(order.userId, cfg, now);
  return {
    kind: eventKind,
    snapshot,
    message: eventKind === 'AWARDED'
      ? `${money(snapshot.bonusUsd)} promotional match added. It unlocks at month-end.`
      : `Trading match streak day ${snapshot.streakDays} of ${snapshot.requiredDays} completed.`,
  };
}

export async function managementResetWelcomeMatch(userId: string): Promise<void> {
  const user = await db.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
  if (!user) throw new Error('Customer not found');
  const cfg = await config();
  const progress = await db.welcomeMatchProgress.findUnique({ where: { userId } });
  if (progress?.bonusUsd && ['LOCKED', 'RELEASING'].includes(progress.status)) {
    throw new Error('Release or reverse the locked promotional balance before resetting progress');
  }
  if (progress) {
    await db.welcomeMatchProgress.delete({ where: { id: progress.id } });
  }
  await db.welcomeMatchProgress.create({
    data: { userId, windowEndsAt: addDays(new Date(), cfg.windowDays) },
  });
}

export async function managementReleaseWelcomeMatch(userId: string): Promise<boolean> {
  const progress = await db.welcomeMatchProgress.findUnique({ where: { userId } });
  if (!progress || progress.status !== 'LOCKED') throw new Error('Customer has no locked promotional match');
  await db.welcomeMatchProgress.update({ where: { id: progress.id }, data: { unlockAt: new Date(0) } });
  return releaseMaturedWelcomeMatch(userId, new Date());
}
