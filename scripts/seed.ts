// ============================================================
// Coin Private: Database seed (CLI wrapper)
// Delegates to the shared seed in src/lib/bootstrap.ts so the
// CLI and the first-boot auto-seed can never drift apart.
// Run: bun run db:seed
// ============================================================
import { runSeed } from '../src/lib/bootstrap';
import { db } from '../src/lib/db';

async function main() {
  console.log('Seeding Coin Private…');
  await runSeed();
  console.log('✓ assets, users, wallets, price history, orders, promotions, settings');

  console.log('\nSeeded. Sign-in credentials:');
  console.log('  ADMIN   LUCIAN1975 / PASSWORD@@1975');
  console.log('  CLIENT  amber@demo.coinprivate.com / password123');
  console.log('  CLIENT  marcus@demo.coinprivate.com / password123');
  console.log('  CLIENT  sofia@demo.coinprivate.com / password123');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
