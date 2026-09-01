import { NextRequest } from 'next/server';
import { requireAdmin, handler, ok, readJson } from '@/lib/api';
import { audit } from '@/lib/notify';
import {
  getWelcomeMatchSnapshot,
  managementReleaseWelcomeMatch,
  managementResetWelcomeMatch,
} from '@/lib/welcome-match';

type Ctx = { params: Promise<{ id: string }> };

export const POST = handler<Ctx>(async (req: NextRequest, ctx) => {
  const manager = await requireAdmin(req);
  const { id } = await ctx.params;
  const body = await readJson<{ action?: 'RESET' | 'RELEASE' }>(req);

  if (body.action === 'RESET') {
    await managementResetWelcomeMatch(id);
    await audit(manager.id, manager.email, 'MANAGEMENT_MATCH_RESET', `Reset first-week match for customer ${id}`);
  } else if (body.action === 'RELEASE') {
    await managementReleaseWelcomeMatch(id);
    await audit(manager.id, manager.email, 'MANAGEMENT_MATCH_RELEASE', `Released first-week match for customer ${id}`);
  } else {
    return ok({ error: 'Choose RESET or RELEASE' }, { status: 422 });
  }

  return ok({ success: true, welcomeMatch: await getWelcomeMatchSnapshot(id) });
});

export const runtime = 'nodejs';
