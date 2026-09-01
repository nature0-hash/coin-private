'use client';

// ============================================================
// Coin Private: Admin notifications (customer events feed)
// ============================================================
import { useNotifications } from '@/hooks/use-cp-data';
import { EmptyState } from '@/components/cp/primitives';
import { timeAgo } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck } from 'lucide-react';
import { toast } from 'sonner';

export function AdminNotificationsView() {
  const { items, unread, reload } = useNotifications(10000);

  async function markAll() {
    await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
    reload();
    toast.success('All marked read');
  }

  return (
    <div className="space-y-5 max-w-[680px]">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Notifications</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">{unread > 0 ? `${unread} unread` : 'All caught up'}: sign-ins, registrations and system alerts.</p>
        </div>
        {unread > 0 && (
          <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-[12.5px]" onClick={markAll}>
            <CheckCheck className="w-4 h-4" /> Mark all read
          </Button>
        )}
      </div>

      {items.length === 0 ? (
        <div className="cp-card">
          <EmptyState icon={<Bell className="w-5 h-5" />} title="No notifications" />
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((n) => (
            <div key={n.id} className={cn('cp-card p-4', !n.read && 'border-l-2 border-l-primary')}>
              <div className="flex items-center gap-2">
                <p className={cn('text-[14px]', n.read ? 'font-medium text-muted-foreground' : 'font-semibold')}>{n.title}</p>
                <span className="ml-auto text-[11.5px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
              </div>
              <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{n.body}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
