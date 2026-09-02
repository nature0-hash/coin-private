'use client';

// ============================================================
// Coin Private: Admin risk tools
// Thresholds, velocity flags, large trades, failed logins,
// pending risk holds.
// ============================================================
import { useFetch } from '@/hooks/use-cp-data';
import { useUI } from '@/lib/store';
import { SkeletonBlock, EmptyState, StatusPill } from '@/components/cp/primitives';
import { fmtUsd, fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ShieldAlert, Users, Zap, Lock, ArrowRight } from 'lucide-react';

interface RiskData {
  thresholds: { flagThresholdUsd: number; maxOrderUsd: number; dailyWithdrawUsd: number; minOrderUsd: number };
  velocityFlags: Array<{ name: string; email: string; count: number; volume: number }>;
  largeTrades: Array<{ id: string; reference: string; side: string; baseSymbol: string; amountQuote: number; status: string; userName: string; userEmail: string; createdAt: string }>;
  frozenUsers: Array<{ id: string; name: string; email: string; status: string }>;
  pendingRisk: Array<{ id: string; reference: string; amount: number; assetSymbol: string | null; userName?: string; userEmail?: string; createdAt: string }>;
  failedLogins: Array<{ identifier: string; count: number }>;
  volume24h: number;
  provider: string;
}

export function AdminRiskView() {
  const { data, loading } = useFetch<RiskData>('/api/admin/risk');
  const { adminNavigate } = useUI();

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-28 w-full" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
    );
  }
  if (!data) return <p className="text-muted-foreground">Failed to load risk data.</p>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Risk tools</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1">Signals from the last 24 hours. Thresholds are configurable in Platform settings.</p>
      </div>

      {/* thresholds */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {[
          { label: 'Trade review threshold', value: fmtUsd(data.thresholds.flagThresholdUsd, { compact: true }), key: 'risk.flagThresholdUsd' },
          { label: 'Max order size', value: fmtUsd(data.thresholds.maxOrderUsd, { compact: true }), key: 'trade.maxOrderUsd' },
          { label: 'Daily withdrawal limit', value: fmtUsd(data.thresholds.dailyWithdrawUsd, { compact: true }), key: 'withdraw.dailyLimitUsd' },
          { label: 'Min order size', value: fmtUsd(data.thresholds.minOrderUsd), key: 'trade.minOrderUsd' },
        ].map((t) => (
          <button key={t.key} onClick={() => adminNavigate('settings-admin')} className="cp-card cp-card-interactive p-4 text-left">
            <p className="micro-label">{t.label}</p>
            <p className="text-[20px] font-semibold nums tracking-tight mt-1.5">{t.value}</p>
            <p className="text-[11px] text-primary mt-1 flex items-center gap-1">Adjust in settings <ArrowRight className="w-3 h-3" /></p>
          </button>
        ))}
      </div>

      {/* pending risk holds */}
      <div className="cp-card p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15.5px] font-semibold flex items-center gap-2">
            <ShieldAlert className="w-4.5 h-4.5 text-[#9945ff]" /> Trades held for review
          </h2>
          {data.pendingRisk.length > 0 && (
            <Button size="sm" className="rounded-full" onClick={() => adminNavigate('approvals')}>
              Review queue
            </Button>
          )}
        </div>
        {data.pendingRisk.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-4 text-center">No trades are waiting for review.</p>
        ) : (
          <div className="divide-y divide-border/60">
            {data.pendingRisk.map((p) => (
              <div key={p.id} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-[13.5px] font-medium">{p.userName}: {fmtUsd(p.amount)} {p.assetSymbol}</p>
                  <p className="text-[11.5px] text-muted-foreground nums">{p.reference} · {fmtDateTime(p.createdAt)}</p>
                </div>
                <StatusPill status="PENDING" />
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* velocity */}
        <div className="cp-card p-5">
          <h2 className="text-[15.5px] font-semibold flex items-center gap-2 mb-3">
            <Zap className="w-4.5 h-4.5 text-warn" /> Velocity flags
            <span className="text-[11.5px] text-muted-foreground font-normal">&gt;10 trades / 24h</span>
          </h2>
          {data.velocityFlags.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-4 text-center">No unusual trading velocity detected.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {data.velocityFlags.map((v) => (
                <div key={v.email} className="flex items-center justify-between py-2.5">
                  <div>
                    <p className="text-[13px] font-medium">{v.name}</p>
                    <p className="text-[11px] text-muted-foreground">{v.email}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[13px] font-semibold nums text-warn">{v.count} trades</p>
                    <p className="text-[11px] text-muted-foreground nums">{fmtUsd(v.volume, { compact: true })}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* failed logins */}
        <div className="cp-card p-5">
          <h2 className="text-[15.5px] font-semibold flex items-center gap-2 mb-3">
            <Lock className="w-4.5 h-4.5 text-[#cf202f]" /> Failed sign-ins (24h)
          </h2>
          {data.failedLogins.length === 0 ? (
            <p className="text-[13px] text-muted-foreground py-4 text-center">No failed sign-in attempts.</p>
          ) : (
            <div className="divide-y divide-border/60">
              {data.failedLogins.map((f) => (
                <div key={f.identifier} className="flex items-center justify-between py-2.5">
                  <p className="text-[13px] nums truncate">{f.identifier}</p>
                  <span className={cn('text-[13px] font-semibold nums', f.count > 5 ? 'text-[#cf202f]' : 'text-muted-foreground')}>{f.count}×</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* large trades */}
      <div className="cp-card p-5">
        <h2 className="text-[15.5px] font-semibold mb-3">Largest trades (24h)</h2>
        {data.largeTrades.length === 0 ? (
          <p className="text-[13px] text-muted-foreground py-4 text-center">No trades above the review threshold today.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="text-left text-muted-foreground text-[11px] uppercase tracking-wide border-b border-border">
                  <th className="pb-2.5 font-medium">Reference</th>
                  <th className="pb-2.5 font-medium">User</th>
                  <th className="pb-2.5 font-medium">Side</th>
                  <th className="pb-2.5 font-medium text-right">Notional</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 font-medium text-right">When</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {data.largeTrades.map((t) => (
                  <tr key={t.id}>
                    <td className="py-2.5 nums">{t.reference}</td>
                    <td className="py-2.5">{t.userName}</td>
                    <td className={cn('py-2.5 font-medium', t.side === 'BUY' ? 'text-up' : 'text-destructive')}>{t.side}</td>
                    <td className="py-2.5 text-right nums font-medium">{fmtUsd(t.amountQuote)}</td>
                    <td className="py-2.5"><StatusPill status={t.status === 'EXECUTED' ? 'COMPLETED' : t.status === 'PENDING' ? 'PENDING' : 'FAILED'} /></td>
                    <td className="py-2.5 text-right text-muted-foreground text-[12px]">{fmtDateTime(t.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* frozen users */}
      <div className="cp-card p-5">
        <h2 className="text-[15.5px] font-semibold flex items-center gap-2 mb-3">
          <Users className="w-4.5 h-4.5 text-muted-foreground" /> Frozen accounts ({data.frozenUsers.length})
        </h2>
        {data.frozenUsers.length === 0 ? (
          <EmptyState title="No frozen accounts" />
        ) : (
          <div className="divide-y divide-border/60">
            {data.frozenUsers.map((f) => (
              <div key={f.id} className="flex items-center justify-between py-2.5">
                <div>
                  <p className="text-[13px] font-medium">{f.name}</p>
                  <p className="text-[11px] text-muted-foreground">{f.email}</p>
                </div>
                <Button variant="ghost" size="sm" className="rounded-full text-[12px]" onClick={() => adminNavigate('user-detail', { id: f.id })}>
                  Open
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
