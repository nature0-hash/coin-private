// ============================================================
// Coin Private: Notifications & audit helpers
// ============================================================
import { db } from '@/lib/db';

export async function notifyUser(recipientId: string, type: string, title: string, body: string) {
  return db.notification.create({ data: { recipientId, type, title, body } });
}

export async function notifyAdmins(type: string, title: string, body: string) {
  return db.notification.create({ data: { recipientRole: 'ADMIN', type, title, body } });
}

export async function audit(userId: string | null, actor: string, action: string, detail?: string) {
  return db.auditLog.create({ data: { userId, actor, action, detail: detail ?? null } });
}

export async function securityEvent(userId: string | null, type: string, ip?: string, userAgent?: string, detail?: string) {
  return db.securityEvent.create({
    data: { userId, type, ip: ip ?? null, userAgent: userAgent ?? null, detail: detail ?? null },
  });
}
