'use client';

// ============================================================
// Coin Private: Notifications
// ============================================================
import { useNotifications } from '@/hooks/use-cp-data';
import { SkeletonBlock, EmptyState } from '@/components/cp/primitives';
import { timeAgo, fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Bell, CheckCheck, Trash2, TrendingUp, ArrowDownToLine, ShieldCheck, Gift, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

const TYPE_ICON: Record<string, React.ReactNode> = {
  TRADE: <TrendingUp className="w-4.5 h-4.5" />,
  DEPOSIT: <ArrowDownToLine className="w-4.5 h-4.5" />,
  WITHDRAWAL: <ArrowDownToLine className="w-4.5 h-4.5" />,
  SEND: <ArrowDownToLine className="w-4.5 h-4.5" />,
  RECEIVE: <ArrowDownToLine className="w-4.5 h-4.5" />,
  SECURITY: <ShieldCheck className="w-4.5 h-4.5" />,
  PROMO: <Gift className="w-4.5 h-4.5" />,
  SYSTEM: <AlertCircle className="w-4.5 h-4.5" />,
};

const TYPE_CLS: Record<string, string> = {
  TRADE: 'bg-[#9945ff]/12 text-[#9945ff]',
  DEPOSIT: 'bg-up/12 text-up',
  WITHDRAWAL: 'bg-warn/12 text-warn',
  SEND: 'bg-[#3773f5]/12 text-[#3773f5]',
  RECEIVE: 'bg-up/12 text-up',
  SECURITY: 'bg-[#3773f5]/12 text-[#3773f5]',
  PROMO: 'bg-warn/12 text-warn',
  SYSTEM: 'bg-secondary text-muted-foreground',
};

export function NotificationsView() {
  const { items, unread, reload } = useNotifications(8000);

  async function markAll() {
    await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ all: true }) });
    reload();
    toast.success('All caught up');
  }

  async function clearAll() {
    await fetch('/api/notifications', { method: 'DELETE' });
    reload();
    toast.success('Notifications cleared');
  }

  async function markOne(id: string) {
    await fetch('/api/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    reload();
  }

  async function deleteOne(id: string) {
    await fetch('/api/notifications', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) });
    reload();
    toast.success('Notification deleted');
  }

  return (
    <div className="space-y-5 max-w-[680px]">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Notifications</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">{unread > 0 ? `${unread} unread` : 'All caught up'}</p>
        </div>
        {items.length > 0 && (
          <div className="flex gap-2">
            {unread > 0 && (
              <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-[12.5px]" onClick={markAll}>
                <CheckCheck className="w-4 h-4" /> Mark all read
              </Button>
            )}
            <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-[12.5px] text-muted-foreground hover:text-destructive" onClick={clearAll}>
              <Trash2 className="w-4 h-4" /> Clear
            </Button>
          </div>
        )}
      </div>

      {items.length === 0 ? (
        <div className="cp-card">
          <EmptyState icon={<Bell className="w-5 h-5" />} title="No notifications" body="Trade, deposit and security updates will show up here." />
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((n) => (
            <div
              key={n.id}
              onClick={() => markOne(n.id)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') markOne(n.id);
              }}
              role="button"
              tabIndex={0}
              className={cn(
                'w-full cp-card p-4 flex items-start gap-3.5 text-left transition-colors hover:bg-hover',
                !n.read && 'border-l-2 border-l-primary'
              )}
              title={fmtDateTime(n.createdAt)}
            >
              <span className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', TYPE_CLS[n.type] ?? TYPE_CLS.SYSTEM)}>
                {TYPE_ICON[n.type] ?? TYPE_ICON.SYSTEM}
              </span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className={cn('text-[14.5px]', n.read ? 'font-medium text-muted-foreground' : 'font-semibold')}>{n.title}</p>
                  {!n.read && <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />}
                </div>
                <p className="text-[13px] text-muted-foreground mt-1 leading-relaxed">{n.body}</p>
                <p className="text-[11.5px] text-muted-foreground/70 mt-1.5">{timeAgo(n.createdAt)}</p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="shrink-0 h-8 w-8 rounded-lg text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                aria-label={`Delete notification: ${n.title}`}
                title="Delete notification"
                onClick={(event) => { event.stopPropagation(); deleteOne(n.id); }}
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
