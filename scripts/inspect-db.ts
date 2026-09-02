import { PrismaClient } from '@prisma/client';
const db = new PrismaClient();

async function main() {
  const users = await db.user.findMany({
    select: { email: true, loginId: true, name: true, role: true, status: true },
  });
  console.log('USERS:', JSON.stringify(users, null, 2));
  console.log('COUNT:', users.length);
  const wallets = await db.wallet.count();
  const assets = await db.asset.count();
  const ledger = await db.ledgerTransaction.count();
  console.log('wallets:', wallets, 'assets:', assets, 'ledgerTxs:', ledger);
}

main().then(() => db.$disconnect()).catch((e) => { console.error(e); db.$disconnect(); process.exit(1); });
