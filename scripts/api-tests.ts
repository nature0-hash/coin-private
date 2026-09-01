// ============================================================
// Coin Private: API smoke test battery
// Exercises every flow end-to-end against a running dev server.
// Run: bun run scripts/api-tests.ts
// ============================================================
const BASE = 'http://localhost:3000';

let clientToken = '';
let adminToken = '';
let passCount = 0;
let failCount = 0;
const failures: string[] = [];

async function call(method: string, path: string, body?: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['X-Tab-Session'] = token;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json(); } catch {}
  return { status: res.status, data };
}

function check(name: string, cond: boolean, detail?: string) {
  if (cond) {
    passCount++;
    console.log(`  ✓ ${name}`);
  } else {
    failCount++;
    failures.push(`${name}${detail ? `: ${detail}` : ''}`);
    console.log(`  ✗ ${name}${detail ? `: ${detail}` : ''}`);
  }
}

async function main() {
  console.log('\n=== AUTH ===');
  const badLogin = await call('POST', '/api/auth/login', { identifier: 'amber@demo.coinprivate.com', password: 'wrong' });
  check('wrong password rejected', badLogin.status === 401);

  const login = await call('POST', '/api/auth/login', { identifier: 'AMBER24', password: 'password123' });
  check('login by loginId works', login.status === 200 && !!login.data.token);
  clientToken = login.data.token as string;

  const me = await call('GET', '/api/auth/me', undefined, clientToken);
  check('me returns user', (me.data.user as { email?: string })?.email === 'amber@demo.coinprivate.com');

  const noAuth = await call('GET', '/api/portfolio');
  check('portfolio requires auth', noAuth.status === 401);

  const adminLogin = await call('POST', '/api/auth/login', { identifier: 'LUCIAN1975', password: 'PASSWORD@@1975' });
  adminToken = adminLogin.data.token as string;
  check('admin login works', adminLogin.status === 200);

  const clientAdmin = await call('GET', '/api/admin/stats', undefined, clientToken);
  check('client blocked from admin', clientAdmin.status === 403);

  console.log('\n=== MARKET DATA ===');
  const prices = await call('GET', '/api/prices');
  const quotes = prices.data.quotes as Array<{ symbol: string; price: number }>;
  check('prices return live quotes', Array.isArray(quotes) && quotes.length >= 8);
  check('BTC price positive', (quotes.find((q) => q.symbol === 'BTC')?.price ?? 0) > 1000);
  check('provider attached', !!prices.data.provider);

  const assets = await call('GET', '/api/assets');
  const sparkCount = (assets.data.assets as Array<{ spark: number[] }>).filter((a) => a.spark.length > 2).length;
  check('seeded assets include sparklines', sparkCount >= 5, `got ${sparkCount}`);

  console.log('\n=== PORTFOLIO ===');
  const pf = await call('GET', '/api/portfolio', undefined, clientToken);
  check('portfolio totals computed', (pf.data.totalUsd as number) > 0);
  check('holdings include BTC', (pf.data.holdings as Array<{ symbol: string }>).some((h) => h.symbol === 'BTC'));

  console.log('\n=== TRADE: SELL ===');
  const sell = await call('POST', '/api/trade', { side: 'SELL', baseSymbol: 'BTC', amount: 0.01, amountMode: 'BASE' }, clientToken);
  check('sell executes', sell.data.status === 'EXECUTED', JSON.stringify(sell.data).slice(0, 120));

  const oversell = await call('POST', '/api/trade', { side: 'SELL', baseSymbol: 'BTC', amount: 2, amountMode: 'BASE' }, clientToken);
  check('oversell rejected with insufficient funds', !!oversell.data.error && /insufficient/i.test(oversell.data.error as string), JSON.stringify(oversell.data));

  console.log('\n=== TRADE: CONVERT ===');
  const convert = await call('POST', '/api/trade', { side: 'CONVERT', baseSymbol: 'ETH', sourceSymbol: 'SOL', amount: 5, amountMode: 'BASE' }, clientToken);
  check('convert executes', convert.data.status === 'EXECUTED', JSON.stringify(convert.data).slice(0, 120));

  const badConvert = await call('POST', '/api/trade', { side: 'CONVERT', baseSymbol: 'ETH', amount: 5, amountMode: 'BASE' }, clientToken);
  check('convert without source rejected', !!badConvert.data.error);

  console.log('\n=== TRADE: RISK HOLD (large order) ===');
  const bigOrder = await call('POST', '/api/trade', { side: 'BUY', baseSymbol: 'BTC', amount: 15000, amountMode: 'QUOTE' }, clientToken);
  check('large order queued for approval', bigOrder.data.status === 'PENDING_APPROVAL', JSON.stringify(bigOrder.data).slice(0, 140));
  const bigOrderId = (bigOrder.data.order as { id?: string })?.id;

  console.log('\n=== SEND ===');
  const sendNoFunds = await call('POST', '/api/send', { symbol: 'BTC', amount: 9999, toAddress: 'bc1qexternal000000000000' }, clientToken);
  check('send above balance rejected', !!sendNoFunds.data.error);
  const badSend = await call('POST', '/api/send', { symbol: 'BTC', amount: 0.001, toAddress: 'x' }, clientToken);
  check('short address rejected', !!badSend.data.error);

  console.log('\n=== PROMO ===');
  const promoCode = `RUN${Date.now().toString(36).toUpperCase().slice(-6)}50`;
  // create a fresh promo as admin so re-runs never collide
  await call('POST', '/api/admin/promos', { code: promoCode, title: 'Test fee discount', kind: 'FEE_DISCOUNT', value: 50 }, adminToken);
  const promo = await call('POST', '/api/promo', { code: promoCode }, clientToken);
  check('promo redeems', promo.data.success === true, JSON.stringify(promo.data).slice(0, 100));
  const promoDup = await call('POST', '/api/promo', { code: promoCode }, clientToken);
  check('promo double-redeem blocked', !!promoDup.data.error);
  const promoBad = await call('POST', '/api/promo', { code: 'NOPE' }, clientToken);
  check('bad promo rejected', !!promoBad.data.error);

  console.log('\n=== SECURITY ===');
  const sec = await call('GET', '/api/security', undefined, clientToken);
  check('security events listed', Array.isArray(sec.data.events));
  const twofa = await call('POST', '/api/security', { action: 'toggle_2fa', enable: true }, clientToken);
  check('unconfigured 2FA cannot be falsely enabled', twofa.status === 422 && !!twofa.data.error);

  console.log('\n=== NOTIFICATIONS ===');
  const notifs = await call('GET', '/api/notifications', undefined, clientToken);
  check('notifications exist', (notifs.data.notifications as unknown[]).length > 0);
  const markAll = await call('POST', '/api/notifications', { all: true }, clientToken);
  check('mark all read', markAll.data.success === true);

  console.log('\n=== WATCHLIST ===');
  const wl = await call('POST', '/api/watchlist', { symbol: 'ETH' }, clientToken);
  check('watchlist add', wl.data.watching === true);
  const wl2 = await call('POST', '/api/watchlist', { symbol: 'ETH' }, clientToken);
  check('watchlist toggle removes', wl2.data.watching === false);

  console.log('\n=== ACTIVITY ===');
  const act = await call('GET', '/api/activity', undefined, clientToken);
  check('activity has items', (act.data.items as unknown[]).length > 3);

  console.log('\n=== ADMIN: USERS ===');
  const users = await call('GET', '/api/admin/users', undefined, adminToken);
  check('admin lists users', (users.data.users as unknown[]).length >= 4);
  const marcus = (users.data.users as Array<{ id: string; email: string }>).find((u) => u.email.startsWith('marcus'));
  const freeze = await call('PATCH', '/api/admin/users', { id: marcus!.id, status: 'FROZEN' }, adminToken);
  check('freeze user works', freeze.data.success === true);
  const frozenLogin = await call('POST', '/api/auth/login', { identifier: 'marcus@demo.coinprivate.com', password: 'password123' });
  check('frozen user cannot log in', frozenLogin.status === 403);
  await call('PATCH', '/api/admin/users', { id: marcus!.id, status: 'ACTIVE' }, adminToken);

  console.log('\n=== ADMIN: CREDIT (ledger adjustment) ===');
  const credit = await call('POST', '/api/admin/credit', { userId: marcus!.id, symbol: 'USD', amount: 500, direction: 'CREDIT', reason: 'Test adjustment' }, adminToken);
  check('admin credit posts', credit.data.success === true, JSON.stringify(credit.data).slice(0, 120));
  const marcusLogin = await call('POST', '/api/auth/login', { identifier: 'marcus@demo.coinprivate.com', password: 'password123' });
  const marcusToken = marcusLogin.data.token as string;
  const marcusPf = await call('GET', '/api/portfolio', undefined, marcusToken);
  check('credited funds visible', (marcusPf.data.totalUsd as number) > 500);
  await call('POST', '/api/auth/logout', undefined, marcusToken);

  const badCredit = await call('POST', '/api/admin/credit', { userId: marcus!.id, symbol: 'USD', amount: 999999, direction: 'DEBIT', reason: 'Overdraft attempt' }, adminToken);
  check('debit above balance rejected', !!badCredit.data.error);

  console.log('\n=== ADMIN: RISK TRADE APPROVAL ===');
  if (bigOrderId) {
    const queue = await call('GET', '/api/admin/approvals?status=PENDING', undefined, adminToken);
    const riskItem = (queue.data.approvals as Array<{ id: string; type: string; payload: Record<string, unknown> }>).find((a) => a.type === 'RISK_TRADE');
    check('risk trade in queue', !!riskItem);
    if (riskItem) {
      const approve = await call('POST', `/api/admin/approvals/${riskItem.id}`, { decision: 'APPROVED', note: 'Verified source of funds' }, adminToken);
      check('risk trade approval settles', approve.data.success === true, JSON.stringify(approve.data).slice(0, 140));
    }
  }

  console.log('\n=== ADMIN: ASSETS ===');
  const testSymbol = `T${Date.now().toString(36).toUpperCase().slice(-5)}`;
  const assetCreate = await call('POST', '/api/admin/assets', { symbol: testSymbol, name: 'Test Asset', kind: 'CRYPTO', priceUsd: 5.5, color: '#0098EA', network: 'Testnet' }, adminToken);
  check('asset listed', assetCreate.data.success === true);
  const delist = await call('PATCH', '/api/admin/assets', { symbol: testSymbol, status: 'DELISTED' }, adminToken);
  check('asset delisted', delist.data.success === true);

  console.log('\n=== ADMIN: PROMOS ===');
  const promoCreate = await call('POST', '/api/admin/promos', { code: `P${Date.now().toString(36).toUpperCase().slice(-7)}`, title: 'Test promo', kind: 'FEE_DISCOUNT', value: 20 }, adminToken);
  check('promo created', promoCreate.data.success === true);

  console.log('\n=== ADMIN: SETTINGS (price provider) ===');
  const settingsGet = await call('GET', '/api/admin/settings', undefined, adminToken);
  check('settings readable + provider healthy', !!(settingsGet.data.priceHealth as { provider?: string } | undefined)?.provider);
  const providerSet = await call('PUT', '/api/admin/settings', { 'price.provider': 'coingecko' }, adminToken);
  check('provider switchable', providerSet.data.success === true);

  console.log('\n=== DEPOSIT (instant rail) ===');
  const dep = await call('POST', '/api/deposits', { symbol: 'USD', amount: 500, method: 'BANK' }, clientToken);
  check('bank deposit posts instantly', dep.data.pending === false && !!dep.data.deposit, JSON.stringify(dep.data).slice(0, 120));
  const depCrypto = await call('POST', '/api/deposits', { symbol: 'USDC', amount: 250, method: 'CRYPTO' }, clientToken);
  check('crypto deposit enters pending queue', depCrypto.data.pending === true);

  console.log('\n=== ADMIN: TRANSACTIONS + REVERSE ===');
  const txs = await call('GET', '/api/admin/transactions', undefined, adminToken);
  const txList = txs.data.transactions as Array<{ id: string; status: string; reference: string; description: string }>;
  check('transactions listed', txList.length > 3);
  const depositTx = txList.find((t) => t.status === 'POSTED' && (t.description.includes('Bank transfer') || t.description.includes('deposit')));
  check('found a posted deposit tx to reverse', !!depositTx);
  if (depositTx) {
    const noReason = await call('POST', '/api/admin/transactions/reverse', { ledgerTxId: depositTx.id, reason: 'x' }, adminToken);
    check('reversal requires reason', noReason.status === 422 || !!noReason.data.error);
    const reversal = await call('POST', '/api/admin/transactions/reverse', { ledgerTxId: depositTx.id, reason: 'Smoke test reversal' }, adminToken);
    check('reversal posts mirrored entries', reversal.data.success === true, JSON.stringify(reversal.data).slice(0, 140));
    const doubleRev = await call('POST', '/api/admin/transactions/reverse', { ledgerTxId: depositTx.id, reason: 'Double reversal attempt' }, adminToken);
    check('double reversal blocked', !!doubleRev.data.error);
  }

  console.log('\n=== ADMIN: AUDIT + RISK ===');
  const auditLog = await call('GET', '/api/admin/audit', undefined, adminToken);
  check('audit log populated', (auditLog.data.logs as unknown[]).length > 5);
  const risk = await call('GET', '/api/admin/risk', undefined, adminToken);
  check('risk endpoints respond', !!risk.data.thresholds);

  console.log('\n=== REGISTER (new user flow) ===');
  const reg = await call('POST', '/api/auth/register', { name: 'Test Newbie', email: `newbie${Date.now()}@test.cp`, password: 'testpass123' });
  check('registration works + returns token', !!reg.data.token);
  const newbieToken = reg.data.token as string;
  const newbiePf = await call('GET', '/api/portfolio', undefined, newbieToken);
  const usdHolding = (newbiePf.data.holdings as Array<{ symbol: string; total: number }>).find((h) => h.symbol === 'USD');
  check('welcome bonus credited through ledger', (usdHolding?.total ?? 0) >= 100, `total=${usdHolding?.total}`);
  const dupReg = await call('POST', '/api/auth/register', { name: 'Test Newbie', email: reg.data.user ? 'amber@demo.coinprivate.com' : 'x@y.z', password: 'testpass123' });
  check('duplicate email blocked', dupReg.status === 409 || !!dupReg.data.error);

  console.log('\n=== FORGOT / RESET ===');
  const forgot = await call('POST', '/api/auth/forgot', { email: 'sofia@demo.coinprivate.com' });
  check('reset code issued', !!forgot.data.resetCode);
  const reset = await call('POST', '/api/auth/reset', { email: 'sofia@demo.coinprivate.com', code: forgot.data.resetCode, password: 'newpassword99' });
  check('password reset works', reset.data.success === true);
  const reLogin = await call('POST', '/api/auth/login', { identifier: 'sofia@demo.coinprivate.com', password: 'newpassword99' });
  check('login with new password', reLogin.status === 200);
  // restore original password
  const sofiaLogin = await call('POST', '/api/auth/login', { identifier: 'sofia@demo.coinprivate.com', password: 'newpassword99' });
  const sofiaToken = sofiaLogin.data.token as string;
  await call('POST', '/api/security', { action: 'change_password', currentPassword: 'newpassword99', newPassword: 'password123' }, sofiaToken);
  const sofiaRestored = await call('POST', '/api/auth/login', { identifier: 'sofia@demo.coinprivate.com', password: 'password123' });
  check('password restored for demo', sofiaRestored.status === 200);

  console.log('\n==================================================');
  console.log(`RESULTS: ${passCount} passed, ${failCount} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log(`  ✗ ${f}`);
    process.exit(1);
  }
}

main().catch((e) => {
  console.error('Test runner crashed:', e);
  process.exit(1);
});
