'use client';

// ============================================================
// Coin Private: Admin overview
// KPIs, AUM by asset, recent ledger activity, quick links.
// ============================================================
import { useFetch } from '@/hooks/use-cp-data';
import { useUI } from '@/lib/store';
import { AssetIcon, SkeletonBlock, StatusPill, PctBadge } from '@/components/cp/primitives';
import { fmtUsd, fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { usePrices } from '@/hooks/use-cp-data';
import {
  Users, Receipt, Layers, ClipboardCheck, TrendingUp, DollarSign,
  UserPlus, Megaphone, ArrowRight,
} from 'lucide-react';

interface AdminStats {
  totals: {
    users: number; activeUsers: number; frozenUsers: number; kycPending: number;
    newUsers7d: number; orders: number; ledgerTxs: number; pendingApprovals: number;
    activePromos: number; deposits: number; withdrawals: number;
  };
  aum: { totalUsd: number; perAsset: Array<{ symbol: string; valueUsd: number }> };
  activity: {
    tradeVolume24h: number;
    fees24h: number;
    recentLedger: Array<{ id: string; reference: string; type: string; status: string; description: string; createdAt: string }>;
    recentOrders: Array<{ id: string; reference: string; side: string; baseSymbol: string; amountQuote: number; status: string; createdAt: string }>;
  };
  settings: Record<string, string>;
}

export function AdminOverviewView() {
  const { data, loading } = useFetch<AdminStats>('/api/admin/stats', []);
  const { adminNavigate } = useUI();
  const { quotes } = usePrices(15000);

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <SkeletonBlock className="h-8 w-52" />
        <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
          {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => <SkeletonBlock key={i} className="h-28" />)}
        </div>
        <SkeletonBlock className="h-72" />
      </div>
    );
  }
  if (!data) return <p className="text-muted-foreground">Failed to load stats.</p>;

  const t = data.totals;
  const kpis = [
    { label: 'Assets under management', value: fmtUsd(data.aum.totalUsd, { compact: true }), sub: `${data.aum.perAsset.length} assets held`, icon: <Layers className="w-5 h-5" />, cls: 'text-primary bg-primary/12' },
    { label: 'Users', value: String(t.users), sub: `${t.newUsers7d} new · ${t.kycPending} KYC pending`, icon: <Users className="w-5 h-5" />, cls: 'text-up bg-up/12' },
    { label: '24h trade volume', value: fmtUsd(data.activity.tradeVolume24h, { compact: true }), sub: `${t.orders} lifetime orders`, icon: <TrendingUp className="w-5 h-5" />, cls: 'text-[#9945ff] bg-[#9945ff]/12' },
    { label: '24h fees collected', value: fmtUsd(data.activity.fees24h), sub: `${parseFloat(data.settings['trade.feePercent'] ?? '0.35')}% take rate`, icon: <DollarSign className="w-5 h-5" />, cls: 'text-warn bg-warn/12' },
    { label: 'Ledger transactions', value: String(t.ledgerTxs), sub: 'recorded, all time', icon: <Receipt className="w-5 h-5" />, cls: 'text-[#3773f5] bg-[#3773f5]/12' },
    { label: 'Pending approvals', value: String(t.pendingApprovals), sub: 'deposits · withdrawals · trades', icon: <ClipboardCheck className="w-5 h-5" />, cls: t.pendingApprovals > 0 ? 'text-warn bg-warn/12' : 'text-muted-foreground bg-secondary', urgent: t.pendingApprovals > 0 },
    { label: 'Deposits / withdrawals', value: `${t.deposits} / ${t.withdrawals}`, sub: 'all time requests', icon: <DollarSign className="w-5 h-5" />, cls: 'text-[#2775CA] bg-[#2775CA]/12' },
    { label: 'Active promotions', value: String(t.activePromos), sub: `${t.frozenUsers} frozen users`, icon: <Megaphone className="w-5 h-5" />, cls: 'text-[#E84142] bg-[#E84142]/12' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Platform overview</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">Live operating picture: everything below is ledger-backed.</p>
        </div>
        {t.pendingApprovals > 0 && (
          <Button className="rounded-full gap-2" onClick={() => adminNavigate('approvals')}>
            <ClipboardCheck className="w-4 h-4" /> Review {t.pendingApprovals} pending
          </Button>
        )}
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 xl:grid-cols-4 gap-3">
        {kpis.map((k) => (
          <div key={k.label} className={cn('cp-card p-4 md:p-5', k.urgent && 'border-warn/40')}>
            <div className="flex items-center justify-between">
              <span className={cn('w-9 h-9 rounded-full flex items-center justify-center', k.cls)}>{k.icon}</span>
              {k.urgent && <span className="w-2 h-2 rounded-full bg-warn live-dot" />}
            </div>
            <p className="text-[22px] md:text-[24px] font-semibold nums tracking-tight mt-3">{k.value}</p>
            <p className="text-[12.5px] font-medium mt-0.5">{k.label}</p>
            <p className="text-[11.5px] text-muted-foreground mt-0.5">{k.sub}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        {/* AUM by asset */}
        <div className="cp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15.5px] font-semibold">Custody by asset</h2>
            <Button variant="ghost" size="sm" className="rounded-full text-[12px] gap-1" onClick={() => adminNavigate('wallets')}>
              All wallets <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="space-y-3">
            {data.aum.perAsset.slice(0, 7).map((a) => {
              const pct = data.aum.totalUsd > 0 ? (a.valueUsd / data.aum.totalUsd) * 100 : 0;
              return (
                <div key={a.symbol} className="flex items-center gap-3">
                  <AssetIcon symbol={a.symbol} size={30} color={quotes[a.symbol]?.color} />
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between text-[13px] mb-1">
                      <span className="font-medium nums">{a.symbol}</span>
                      <span className="text-muted-foreground nums">{fmtUsd(a.valueUsd, { compact: true })}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-secondary overflow-hidden">
                      <div className="h-full rounded-full bg-primary/70" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="text-[11.5px] text-muted-foreground nums w-12 text-right">{pct.toFixed(1)}%</span>
                </div>
              );
            })}
            {data.aum.perAsset.length === 0 && <p className="text-[13px] text-muted-foreground py-6 text-center">No custody yet.</p>}
          </div>
        </div>

        {/* recent ledger */}
        <div className="cp-card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-[15.5px] font-semibold">Recent ledger activity</h2>
            <Button variant="ghost" size="sm" className="rounded-full text-[12px] gap-1" onClick={() => adminNavigate('transactions')}>
              All transactions <ArrowRight className="w-3.5 h-3.5" />
            </Button>
          </div>
          <div className="space-y-1">
            {data.activity.recentLedger.map((tx) => (
              <div key={tx.id} className="flex items-center gap-3 py-2 border-b border-border/60 last:border-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[13px] font-medium truncate">{tx.description}</p>
                  <p className="text-[11px] text-muted-foreground nums">{tx.reference} · {fmtDateTime(tx.createdAt)}</p>
                </div>
                <StatusPill status={tx.status === 'POSTED' ? 'COMPLETED' : tx.status} />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* recent orders */}
      <div className="cp-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15.5px] font-semibold">Latest orders</h2>
          <Button variant="ghost" size="sm" className="rounded-full text-[12px] gap-1" onClick={() => adminNavigate('users')}>
            <UserPlus className="w-3.5 h-3.5" /> Manage users
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-muted-foreground text-[11.5px] uppercase tracking-wide border-b border-border">
                <th className="pb-2.5 font-medium">Reference</th>
                <th className="pb-2.5 font-medium">Side</th>
                <th className="pb-2.5 font-medium">Asset</th>
                <th className="pb-2.5 font-medium text-right">Notional</th>
                <th className="pb-2.5 font-medium">Status</th>
                <th className="pb-2.5 font-medium text-right">When</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border/60">
              {data.activity.recentOrders.map((o) => (
                <tr key={o.id} className="hover:bg-hover transition-colors">
                  <td className="py-2.5 nums">{o.reference}</td>
                  <td className="py-2.5">
                    <span className={cn('font-medium', o.side === 'BUY' ? 'text-up' : o.side === 'SELL' ? 'text-destructive' : 'text-primary')}>
                      {o.side}
                    </span>
                  </td>
                  <td className="py-2.5 nums">{o.baseSymbol}</td>
                  <td className="py-2.5 text-right nums font-medium">{fmtUsd(o.amountQuote)}</td>
                  <td className="py-2.5"><StatusPill status={o.status === 'EXECUTED' ? 'COMPLETED' : o.status} /></td>
                  <td className="py-2.5 text-right text-muted-foreground text-[12px]">{fmtDateTime(o.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
