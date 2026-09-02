'use client';

// ============================================================
// Coin Private: Admin audit log
// Every privileged action, in order, forever.
// ============================================================
import { useState } from 'react';
import { useFetch } from '@/hooks/use-cp-data';
import { SkeletonBlock, EmptyState, SegmentedTabs } from '@/components/cp/primitives';
import { fmtDateTime } from '@/lib/format';
import { ScrollText } from 'lucide-react';
import { cn } from '@/lib/utils';

interface AuditRow {
  id: string;
  actor: string;
  action: string;
  detail: string | null;
  userName?: string | null;
  createdAt: string;
}

const ACTION_CLS: Record<string, string> = {
  LOGIN: 'text-up', LOGOUT: 'text-muted-foreground',
  ADMIN_REVERSE: 'text-destructive', ADMIN_ADJUSTMENT: 'text-warn',
  ADMIN_USER_UPDATE: 'text-warn', ADMIN_SETTINGS: 'text-primary',
  RISK_HOLD: 'text-warn', PASSWORD_RESET: 'text-warn',
};

export function AdminAuditView() {
  const [action, setAction] = useState('ALL');
  const { data, loading } = useFetch<{ logs: AuditRow[] }>(`/api/admin/audit${action === 'ALL' ? '' : `?action=${action}`}`, [action]);

  const logs = data?.logs ?? [];
  const displayAction = (value: string) => value.replace(/^ADMIN_/, 'MANAGEMENT_');

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Audit log</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1">Immutable record of privileged actions: logins, trades, adjustments, approvals and settings changes.</p>
      </div>

      <SegmentedTabs
        items={[
          { value: 'ALL', label: 'All' },
          { value: 'LOGIN', label: 'Sign-ins' },
          { value: 'ADMIN_ADJUSTMENT', label: 'Adjustments' },
          { value: 'ADMIN_REVERSE', label: 'Reversals' },
          { value: 'ADMIN_SETTINGS', label: 'Settings' },
        ]}
        value={action}
        onChange={setAction}
      />

      {loading && !data ? (
        <div className="cp-card p-4 space-y-3">{[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} className="h-10" />)}</div>
      ) : logs.length === 0 ? (
        <div className="cp-card"><EmptyState icon={<ScrollText className="w-5 h-5" />} title="No audit entries" /></div>
      ) : (
        <div className="cp-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[680px]">
              <thead>
                <tr className="text-left text-muted-foreground text-[11px] uppercase tracking-wide border-b border-border">
                  <th className="px-5 py-3 font-medium">When</th>
                  <th className="px-3 py-3 font-medium">Actor</th>
                  <th className="px-3 py-3 font-medium">Action</th>
                  <th className="px-5 py-3 font-medium">Detail</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {logs.map((l) => (
                  <tr key={l.id} className="hover:bg-hover transition-colors">
                    <td className="px-5 py-2.5 text-[12px] text-muted-foreground whitespace-nowrap">{fmtDateTime(l.createdAt)}</td>
                    <td className="px-3 py-2.5 text-[12.5px]">{l.actor}</td>
                    <td className="px-3 py-2.5">
                      <span className={cn('text-[11.5px] font-semibold rounded-full px-2 py-0.5 bg-secondary', ACTION_CLS[l.action] ?? 'text-muted-foreground')}>
                        {displayAction(l.action)}
                      </span>
                    </td>
                    <td className="px-5 py-2.5 text-[12.5px] text-muted-foreground max-w-[420px]"><p className="truncate">{l.detail ?? '-'}</p></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
