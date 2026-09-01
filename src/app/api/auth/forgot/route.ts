import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { genResetCode } from '@/lib/session';
import { fail, handler, ok, readJson } from '@/lib/api';
import { notifyUser } from '@/lib/notify';

export const POST = handler(async (req: NextRequest) => {
  const { email } = await readJson<{ email?: string }>(req);
  const normalized = (email ?? '').trim().toLowerCase();
  if (!normalized) return fail('Enter your email address', 422);

  const user = await db.user.findUnique({ where: { email: normalized } });
  // Do not reveal whether the account exists
  if (user) {
    await db.resetCode.deleteMany({ where: { userId: user.id, used: false } });
    const code = genResetCode();
    await db.resetCode.create({
      data: {
        userId: user.id,
        code,
        email: normalized,
        expiresAt: new Date(Date.now() + 10 * 60 * 1000),
      },
    });
    // Local previews can expose the code for end-to-end testing. A production
    // deployment must deliver it through a private channel instead.
    await notifyUser(user.id, 'SECURITY', 'Password reset code', `Your reset code is ${code}. It expires in 10 minutes. If you didn't request it, ignore this message.`);
    if (process.env.NODE_ENV !== 'production' || process.env.EXPOSE_DEMO_RESET_CODE === 'true') {
      return ok({ success: true, resetCode: code, note: 'Development reset code' });
    }
    return ok({ success: true });
  }
  return ok({ success: true });
});

export const runtime = 'nodejs';
