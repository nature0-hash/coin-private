import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { auth, handler, ok, readJson } from '@/lib/api';

export const GET = handler(async (req: NextRequest) => {
  const user = await auth(req);
  if (!user) return ok({ notifications: [] });
  const notifications = await db.notification.findMany({
    where: { recipientId: user.id },
    orderBy: { createdAt: 'desc' },
    take: 60,
  });
  const unread = notifications.filter((n) => !n.read).length;
  return ok({ notifications, unread });
});

// POST: mark one or all read
export const POST = handler(async (req: NextRequest) => {
  const user = await auth(req);
  if (!user) return ok({ success: false });
  const body = await readJson<{ id?: string; all?: boolean }>(req);
  if (body.all) {
    await db.notification.updateMany({ where: { recipientId: user.id, read: false }, data: { read: true } });
  } else if (body.id) {
    await db.notification.updateMany({ where: { id: body.id, recipientId: user.id }, data: { read: true } });
  }
  return ok({ success: true });
});

// DELETE: clear all
export const DELETE = handler(async (req: NextRequest) => {
  const user = await auth(req);
  if (!user) return ok({ success: false });
  await db.notification.deleteMany({ where: { recipientId: user.id } });
  return ok({ success: true });
});

export const runtime = 'nodejs';
