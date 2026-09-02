import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();
async function main() {
  // Wipe all data (respecting FK order) then re-seed via scripts/seed.ts.
  const tables = [
    db.ledgerEntry.deleteMany(),
    db.ledgerTransaction.deleteMany(),
    db.order.deleteMany(),
    db.transfer.deleteMany(),
    db.depositRequest.deleteMany(),
    db.withdrawalRequest.deleteMany(),
    db.approval.deleteMany(),
    db.promoRedemption.deleteMany(),
    db.promo.deleteMany(),
    db.notification.deleteMany(),
    db.auditLog.deleteMany(),
    db.securityEvent.deleteMany(),
    db.watchlistItem.deleteMany(),
    db.resetCode.deleteMany(),
    db.pricePoint.deleteMany(),
    db.wallet.deleteMany(),
    db.setting.deleteMany(),
    db.user.deleteMany(),
    db.asset.deleteMany(),
  ];
  for (const t of tables) await t;
  console.log('all tables wiped');
}
main().finally(() => db.$disconnect());
