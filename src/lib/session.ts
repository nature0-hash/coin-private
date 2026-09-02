// ============================================================
// Coin Private: Session auth
// Stateless per-tab HMAC-signed tokens (pattern reused from the
// original project, hardened for Coin Private).
//   1. Login  → signed token { userId, role, tabId, exp }
//   2. Client stores it in sessionStorage (one tab = one session)
//   3. Every API request carries X-Tab-Session header
//   4. Server verifies signature + expiry
// ============================================================
import { db } from '@/lib/db';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

function sessionSecret(): string {
  const configured = process.env.SESSION_SECRET;
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') {
    const databaseUrl = process.env.DATABASE_URL;
    if (databaseUrl?.startsWith('postgres')) {
      return crypto.createHash('sha256').update(`coin-private-session:${databaseUrl}`).digest('hex');
    }
    throw new Error('SESSION_SECRET or a PostgreSQL DATABASE_URL must be configured in production');
  }
  return 'coin-private-dev-secret-change-me';
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: 'CUSTOMER' | 'ADMIN';
  name: string;
  tabId: string;
  iat: number;
  exp: number;
}

function sign(payload: SessionPayload): string {
  const data = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const sig = crypto.createHmac('sha256', sessionSecret()).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verify(token: string): SessionPayload | null {
  try {
    const [data, sig] = token.split('.');
    if (!data || !sig) return null;
    const expected = crypto.createHmac('sha256', sessionSecret()).update(data).digest('base64url');
    if (sig.length !== expected.length) return null;
    if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
    const payload: SessionPayload = JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
    if (Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export async function createSession(payload: Omit<SessionPayload, 'iat' | 'exp' | 'tabId'>): Promise<{ tabToken: string; tabId: string }> {
  const now = Date.now();
  const ttlMs = 12 * 60 * 60 * 1000; // 12h
  const tabId = crypto.randomBytes(16).toString('hex');
  const token = sign({ ...payload, tabId, iat: now, exp: now + ttlMs });
  return { tabToken: token, tabId };
}

export function getSessionFromToken(tabToken: string | null | undefined): SessionPayload | null {
  if (!tabToken) return null;
  return verify(tabToken);
}

export async function getCurrentUserFromToken(tabToken: string | null | undefined) {
  const session = getSessionFromToken(tabToken);
  if (!session) return null;
  return db.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true, email: true, loginId: true, name: true, role: true, status: true,
      phone: true, address: true, country: true, avatarUrl: true,
      kycStatus: true, kycTier: true, twoFactorEnabled: true, createdAt: true,
    },
  });
}

export function genReference(prefix: string): string {
  const t = Date.now().toString(36).toUpperCase();
  const r = crypto.randomBytes(3).toString('hex').toUpperCase();
  return `CP-${prefix}-${t}${r}`;
}

export function genWalletAddress(symbol: string): string {
  const hex = crypto.randomBytes(20).toString('hex');
  const prefixBySymbol: Record<string, string> = {
    BTC: 'bc1q', ETH: '0x', SOL: 'So1u', USDC: '0x', USDT: '0x',
    XRP: 'r', ADA: 'addr1', DOGE: 'D', AVAX: '0x', LINK: '0x',
  };
  return `${prefixBySymbol[symbol] ?? 'cp1'}${hex}`;
}

export function genTxHash(): string {
  return '0x' + crypto.randomBytes(32).toString('hex');
}

export function genResetCode(): string {
  return crypto.randomInt(100000, 1000000).toString();
}
