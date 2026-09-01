// ============================================================
// Coin Private: SQLite schema bootstrap (mirrors prisma/schema.prisma)
// Executed with CREATE IF NOT EXISTS on first boot when the
// database file has no tables yet (fresh deploy / fresh checkout).
// Generated from the live database via `bun run scripts/dump-ddl.ts`
// so it can never drift from a `prisma db push` result.
// ============================================================
export const SCHEMA_SQL = `
CREATE TABLE IF NOT EXISTS "Approval" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "type" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "userId" TEXT,
    "payload" TEXT NOT NULL DEFAULT '{}',
    "amount" REAL NOT NULL DEFAULT 0,
    "assetSymbol" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "requestedBy" TEXT,
    "decidedBy" TEXT,
    "decisionNote" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" DATETIME,
    CONSTRAINT "Approval_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Asset" (
    "symbol" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "color" TEXT NOT NULL DEFAULT '#8A8F98',
    "decimals" INTEGER NOT NULL DEFAULT 8,
    "network" TEXT,
    "depositTag" BOOLEAN NOT NULL DEFAULT false,
    "priceUsd" REAL NOT NULL DEFAULT 0,
    "change24h" REAL NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'LISTED',
    "tradeable" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "actor" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "DepositRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "method" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "decidedBy" TEXT,
    "decidedAt" DATETIME,
    "ledgerTxId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DepositRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LedgerEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "ledgerTxId" TEXT NOT NULL,
    "walletId" TEXT,
    "assetSymbol" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "balanceBefore" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "memo" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerEntry_ledgerTxId_fkey" FOREIGN KEY ("ledgerTxId") REFERENCES "LedgerTransaction" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "LedgerEntry_walletId_fkey" FOREIGN KEY ("walletId") REFERENCES "Wallet" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "LedgerTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "reference" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "userId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "description" TEXT NOT NULL,
    "meta" TEXT DEFAULT '{}',
    "reversalOfId" TEXT,
    "postedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LedgerTransaction_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Notification" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "recipientId" TEXT,
    "recipientRole" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "read" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Notification_recipientId_fkey" FOREIGN KEY ("recipientId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "baseSymbol" TEXT NOT NULL,
    "quoteSymbol" TEXT NOT NULL DEFAULT 'USD',
    "sourceSymbol" TEXT,
    "amountBase" REAL NOT NULL,
    "amountQuote" REAL NOT NULL,
    "price" REAL NOT NULL,
    "fee" REAL NOT NULL DEFAULT 0,
    "feeSymbol" TEXT NOT NULL DEFAULT 'USD',
    "promoCode" TEXT,
    "status" TEXT NOT NULL DEFAULT 'EXECUTED',
    "ledgerTxId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Order_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "PricePoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "symbol" TEXT NOT NULL,
    "price" REAL NOT NULL,
    "ts" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PricePoint_symbol_fkey" FOREIGN KEY ("symbol") REFERENCES "Asset" ("symbol") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Promo" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "value" REAL NOT NULL,
    "bonusSymbol" TEXT,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "startsAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endsAt" DATETIME,
    "maxRedemptions" INTEGER NOT NULL DEFAULT 0,
    "usedCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PromoRedemption" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promoId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromoRedemption_promoId_fkey" FOREIGN KEY ("promoId") REFERENCES "Promo" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromoRedemption_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WelcomeMatchProgress" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ELIGIBLE',
    "windowEndsAt" DATETIME NOT NULL,
    "streakStartedDay" TEXT,
    "lastQualifiedDay" TEXT,
    "streakDays" INTEGER NOT NULL DEFAULT 0,
    "targetUsd" REAL NOT NULL DEFAULT 0,
    "bonusUsd" REAL NOT NULL DEFAULT 0,
    "unlockAt" DATETIME,
    "awardedAt" DATETIME,
    "releasedAt" DATETIME,
    "awardLedgerTxId" TEXT,
    "releaseLedgerTxId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WelcomeMatchProgress_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WelcomeMatchTrade" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "progressId" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "tradeDay" TEXT NOT NULL,
    "notionalUsd" REAL NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WelcomeMatchTrade_progressId_fkey" FOREIGN KEY ("progressId") REFERENCES "WelcomeMatchProgress" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "WelcomeMatchTrade_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "ResetCode" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "used" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ResetCode_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "SecurityEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "type" TEXT NOT NULL,
    "ip" TEXT,
    "userAgent" TEXT,
    "detail" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SecurityEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "Setting" (
    "key" TEXT NOT NULL PRIMARY KEY,
    "value" TEXT NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Transfer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "fee" REAL NOT NULL DEFAULT 0,
    "toAddress" TEXT NOT NULL,
    "toUserId" TEXT,
    "txHash" TEXT,
    "memo" TEXT,
    "status" TEXT NOT NULL DEFAULT 'POSTED',
    "ledgerTxId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Transfer_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "loginId" TEXT,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'CUSTOMER',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "phone" TEXT,
    "address" TEXT,
    "country" TEXT,
    "avatarUrl" TEXT,
    "kycStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "kycTier" INTEGER NOT NULL DEFAULT 1,
    "twoFactorEnabled" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

CREATE TABLE IF NOT EXISTS "Wallet" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "available" REAL NOT NULL DEFAULT 0,
    "reserved" REAL NOT NULL DEFAULT 0,
    "address" TEXT NOT NULL,
    "label" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Wallet_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Wallet_assetSymbol_fkey" FOREIGN KEY ("assetSymbol") REFERENCES "Asset" ("symbol") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WatchlistItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "symbol" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WatchlistItem_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "WithdrawalRequest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "reference" TEXT NOT NULL,
    "assetSymbol" TEXT NOT NULL,
    "amount" REAL NOT NULL,
    "fee" REAL NOT NULL DEFAULT 0,
    "address" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "decidedBy" TEXT,
    "decidedAt" DATETIME,
    "ledgerTxId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "WithdrawalRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE UNIQUE INDEX IF NOT EXISTS "DepositRequest_reference_key" ON "DepositRequest"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "LedgerTransaction_reference_key" ON "LedgerTransaction"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "Order_reference_key" ON "Order"("reference");
CREATE INDEX IF NOT EXISTS "PricePoint_symbol_ts_idx" ON "PricePoint"("symbol", "ts");
CREATE UNIQUE INDEX IF NOT EXISTS "PromoRedemption_promoId_userId_key" ON "PromoRedemption"("promoId", "userId");
CREATE UNIQUE INDEX IF NOT EXISTS "Promo_code_key" ON "Promo"("code");
CREATE UNIQUE INDEX IF NOT EXISTS "Transfer_reference_key" ON "Transfer"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX IF NOT EXISTS "User_loginId_key" ON "User"("loginId");
CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_address_key" ON "Wallet"("address");
CREATE UNIQUE INDEX IF NOT EXISTS "Wallet_userId_assetSymbol_key" ON "Wallet"("userId", "assetSymbol");
CREATE UNIQUE INDEX IF NOT EXISTS "WatchlistItem_userId_symbol_key" ON "WatchlistItem"("userId", "symbol");
CREATE UNIQUE INDEX IF NOT EXISTS "WithdrawalRequest_reference_key" ON "WithdrawalRequest"("reference");
CREATE UNIQUE INDEX IF NOT EXISTS "WelcomeMatchProgress_userId_key" ON "WelcomeMatchProgress"("userId");
CREATE UNIQUE INDEX IF NOT EXISTS "WelcomeMatchTrade_orderId_key" ON "WelcomeMatchTrade"("orderId");
CREATE INDEX IF NOT EXISTS "WelcomeMatchTrade_progressId_tradeDay_idx" ON "WelcomeMatchTrade"("progressId", "tradeDay");
`;
