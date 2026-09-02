import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok } from '@/lib/api';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);
  const url = new URL(req.url);
  const action = url.searchParams.get('action') ?? '';

  const logs = await db.auditLog.findMany({
    where: action ? { action } : undefined,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  return ok({
    logs: logs.map((l) => ({
      id: l.id, actor: l.actor, action: l.action, detail: l.detail,
      userName: l.user?.name, userEmail: l.user?.email, createdAt: l.createdAt,
    })),
  });
});

export const runtime = 'nodejs';
