import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { tokenFrom, handler, clientIp } from '@/lib/api';
import { getSessionFromToken } from '@/lib/session';
import { audit, securityEvent } from '@/lib/notify';

export const POST = handler(async (req: NextRequest) => {
  const payload = getSessionFromToken(tokenFrom(req));
  if (payload) {
    await securityEvent(payload.userId, 'LOGOUT', clientIp(req), req.headers.get('user-agent') ?? undefined);
    await audit(payload.userId, payload.email, 'LOGOUT', 'Signed out');
  }
  void db;
  const response = NextResponse.json({ success: true });
  response.cookies.set('cp_session', '', {
    httpOnly: true,
    sameSite: 'lax',
    path: '/',
    expires: new Date(0),
  });
  return response;
});

export const runtime = 'nodejs';
