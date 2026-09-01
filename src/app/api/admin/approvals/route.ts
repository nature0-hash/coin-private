import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { requireAdmin, handler, ok, readJson } from '@/lib/api';
import { audit } from '@/lib/notify';

export const GET = handler(async (req: NextRequest) => {
  await requireAdmin(req);
  const url = new URL(req.url);
  const status = url.searchParams.get('status') ?? 'PENDING';

  const approvals = await db.approval.findMany({
    where: status ? { status } : undefined,
    include: { user: { select: { name: true, email: true } } },
    orderBy: { createdAt: 'asc' },
    take: 200,
  });

  return ok({
    approvals: approvals.map((a) => ({
      id: a.id, type: a.type, reference: a.reference, status: a.status,
      amount: a.amount, assetSymbol: a.assetSymbol,
      userName: a.user?.name, userEmail: a.user?.email,
      payload: JSON.parse(a.payload || '{}'),
      requestedBy: a.requestedBy, decidedBy: a.decidedBy, decisionNote: a.decisionNote,
      createdAt: a.createdAt, decidedAt: a.decidedAt,
    })),
  });
});

export const runtime = 'nodejs';
void readJson;
