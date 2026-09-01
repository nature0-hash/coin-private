// ============================================================
// Coin Private: API route helpers
// ============================================================
import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUserFromToken } from '@/lib/session';

export interface AuthUser {
  id: string;
  email: string;
  loginId: string | null;
  name: string;
  role: string;
  status: string;
  phone: string | null;
  address: string | null;
  country: string | null;
  avatarUrl: string | null;
  kycStatus: string;
  kycTier: number;
  twoFactorEnabled: boolean;
  createdAt: Date;
}

export function ok<T>(data: T, init?: ResponseInit) {
  return NextResponse.json(data as object, init);
}

export function fail(message: string, status = 400, code?: string) {
  return NextResponse.json({ error: message, code }, { status });
}

export function tokenFrom(req: NextRequest): string | null {
  return req.headers.get('x-tab-session') ?? req.cookies.get('cp_session')?.value ?? null;
}

export async function auth(req: NextRequest): Promise<AuthUser | null> {
  const user = await getCurrentUserFromToken(tokenFrom(req));
  if (!user) return null;
  if (user.status === 'FROZEN' && !req.nextUrl.pathname.startsWith('/api/auth')) return null;
  return user as unknown as AuthUser;
}

export async function requireAuth(req: NextRequest): Promise<AuthUser> {
  const user = await auth(req);
  if (!user) throw new HttpError(401, 'Not signed in');
  return user;
}

export async function requireAdmin(req: NextRequest): Promise<AuthUser> {
  const user = await requireAuth(req);
  if (user.role !== 'ADMIN') throw new HttpError(403, 'Management access required');
  return user;
}

export class HttpError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/** Wrap a route handler with uniform error handling. */
export function handler<Ctx>(fn: (req: NextRequest, ctx: Ctx) => Promise<NextResponse>) {
  return async (req: NextRequest, ctx: Ctx): Promise<NextResponse> => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof HttpError) return fail(e.message, e.status);
      const msg = e instanceof Error ? e.message : 'Unexpected error';
      console.error('[api]', msg);
      return fail(msg, 500);
    }
  };
}

export async function readJson<T>(req: NextRequest): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new HttpError(400, 'Invalid JSON body');
  }
}

export function clientIp(req: NextRequest): string {
  return req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ?? '127.0.0.1';
}
