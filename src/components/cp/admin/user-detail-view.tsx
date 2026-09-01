'use client';

// ============================================================
// Coin Private: Admin user detail
// Identity, wallets, ledger-backed credit/debit adjustment,
// orders / transfers / security history.
// ============================================================
import { useState } from 'react';
import { useFetch } from '@/hooks/use-cp-data';
import { useUI } from '@/lib/store';
import { AssetIcon, SkeletonBlock, StatusPill, PriceText } from '@/components/cp/primitives';
import { fmtDateTime, fmtUsd, fmtCrypto } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { ArrowLeft, ShieldOff, ShieldCheck, BadgeCheck, ArrowDownToLine, ArrowUpFromLine, UserCog, Gift, RefreshCcw, Unlock } from 'lucide-react';

interface DetailUser {
  id: string; email: string; name: string; role: string; status: string;
  phone: string | null; address: string | null; country: string | null;
  kycStatus: string; kycTier: number; twoFactorEnabled: boolean; createdAt: string;
  wallets: Array<{ id: string; symbol: string; address: string; available: number; reserved: number; total: number; price: number; valueUsd: number; color: string }>;
}
interface DetailData {
  user: DetailUser;
  orders: Array<{ id: string; reference: string; side: string; baseSymbol: string; amountBase: number; amountQuote: number; status: string; createdAt: string }>;
  transfers: Array<{ id: string; reference: string; kind: string; assetSymbol: string; amount: number; status: string; toAddress: string; createdAt: string }>;
  deposits: Array<{ id: string; reference: string; assetSymbol: string; amount: number; method: string; status: string; createdAt: string }>;
  withdrawals: Array<{ id: string; reference: string; assetSymbol: string; amount: number; status: string; createdAt: string }>;
  ledgerTxs: Array<{ id: string; reference: string; type: string; status: string; description: string; createdAt: string }>;
  securityEvents: Array<{ id: string; type: string; ip: string | null; createdAt: string }>;
  promos: Array<{ code: string; title: string; redeemedAt: string }>;
  welcomeMatch: {
    status: 'ELIGIBLE' | 'ACTIVE' | 'LOCKED' | 'RELEASED' | 'EXPIRED';
    windowEndsAt: string;
    streakDays: number;
    requiredDays: number;
    targetUsd: number;
    todayTotalUsd: number;
    bonusUsd: number;
    unlockAt: string | null;
  };
}

export function AdminUserDetailView() {
  const { adminParams, adminNavigate } = useUI();
  const id = adminParams.id ?? '';
  const { data, loading, reload } = useFetch<DetailData>(`/api/admin/users/${id}`, [id]);

  const [adjustOpen, setAdjustOpen] = useState(false);
  const [adjust, setAdjust] = useState({ symbol: 'USD', amount: '', direction: 'CREDIT', reason: '' });
  const [busy, setBusy] = useState(false);

  async function submitAdjust() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/credit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: id, symbol: adjust.symbol, direction: adjust.direction,
          amount: parseFloat(adjust.amount), reason: adjust.reason,
        }),
      });
      const d = await res.json();
      if (d.error) toast.error(d.error);
      else {
        toast.success(d.message);
        setAdjustOpen(false);
        setAdjust({ symbol: 'USD', amount: '', direction: 'CREDIT', reason: '' });
        reload();
      }
    } finally {
      setBusy(false);
    }
  }

  async function patch(payload: Record<string, unknown>, msg: string) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    const d = await res.json();
    if (d.error) toast.error(d.error);
    else {
      toast.success(msg);
      reload();
    }
  }

  async function manageMatch(action: 'RESET' | 'RELEASE') {
    setBusy(true);
    try {
      const res = await fetch(`/api/admin/users/${id}/welcome-match`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const d = await res.json();
      if (d.error) toast.error(d.error);
      else {
        toast.success(action === 'RESET' ? 'Trading match eligibility reset' : 'Promotional match released');
        reload();
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <SkeletonBlock className="h-8 w-40" />
        <SkeletonBlock className="h-36 w-full" />
        <SkeletonBlock className="h-52 w-full" />
      </div>
    );
  }
  if (!data) return <p className="text-muted-foreground">User not found.</p>;

  const u = data.user;
  const totalValue = u.wallets.reduce((s, w) => s + w.valueUsd, 0);

  return (
    <div className="space-y-6">
      <button onClick={() => adminNavigate('users')} className="inline-flex items-center gap-1.5 text-[13px] text-muted-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-4 h-4" /> Users
      </button>

      {/* identity header */}
      <div className="cp-card p-5">
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h1 className="text-[20px] font-semibold tracking-tight">{u.name}</h1>
              <StatusPill status={u.status} />
              <span className="text-[11px] font-semibold rounded-full px-2 py-0.5 bg-secondary text-muted-foreground">{u.role === 'ADMIN' ? 'MANAGEMENT' : u.role}</span>
            </div>
            <p className="text-[13px] text-muted-foreground nums mt-1">{u.email}</p>
            <p className="text-[12px] text-muted-foreground mt-1">
              {u.country ?? 'Unknown country'} · {u.phone ?? 'No phone'} · KYC {u.kycStatus} (T{u.kycTier}) · 2FA {u.twoFactorEnabled ? 'on' : 'off'}
            </p>
            <p className="text-[11.5px] text-muted-foreground/70 mt-0.5">Joined {fmtDateTime(u.createdAt)}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {u.status === 'ACTIVE' ? (
              <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-[12.5px] text-destructive border-destructive/25 hover:bg-destructive/10" onClick={() => patch({ status: 'FROZEN' }, 'Account frozen')}>
                <ShieldOff className="w-4 h-4" /> Freeze
              </Button>
            ) : (
              <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-[12.5px] text-up border-up/25 hover:bg-up/10" onClick={() => patch({ status: 'ACTIVE' }, 'Account restored')}>
                <ShieldCheck className="w-4 h-4" /> Unfreeze
              </Button>
            )}
            {u.kycStatus !== 'VERIFIED' && (
              <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-[12.5px]" onClick={() => patch({ kycStatus: 'VERIFIED', kycTier: 2 }, 'KYC verified')}>
                <BadgeCheck className="w-4 h-4" /> Verify KYC
              </Button>
            )}
            <Button size="sm" className="rounded-full gap-1.5 text-[12.5px]" onClick={() => setAdjustOpen(true)}>
              <UserCog className="w-4 h-4" /> Adjust funds
            </Button>
          </div>
        </div>
      </div>

      <div className="cp-card p-5">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-[15px] flex items-center gap-2">
              <Gift className="w-4.5 h-4.5 text-primary" /> First-week trading match
            </p>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              Status {data.welcomeMatch.status} · streak {data.welcomeMatch.streakDays}/{data.welcomeMatch.requiredDays} · target {fmtUsd(data.welcomeMatch.targetUsd)}
            </p>
            <p className="text-[12px] text-muted-foreground mt-1">
              {data.welcomeMatch.status === 'LOCKED' && data.welcomeMatch.unlockAt
                ? `${fmtUsd(data.welcomeMatch.bonusUsd)} locked until ${fmtDateTime(data.welcomeMatch.unlockAt)}`
                : `Eligibility ends ${fmtDateTime(data.welcomeMatch.windowEndsAt)}`}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.welcomeMatch.status === 'LOCKED' && (
              <Button variant="outline" size="sm" className="rounded-full gap-1.5" disabled={busy} onClick={() => manageMatch('RELEASE')}>
                <Unlock className="w-4 h-4" /> Release now
              </Button>
            )}
            {!['LOCKED'].includes(data.welcomeMatch.status) && (
              <Button variant="outline" size="sm" className="rounded-full gap-1.5" disabled={busy} onClick={() => manageMatch('RESET')}>
                <RefreshCcw className="w-4 h-4" /> Reset eligibility
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* wallets */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-[15.5px] font-semibold">Wallets · {fmtUsd(totalValue)} total</h2>
        </div>
        <div className="grid sm:grid-cols-2 xl:grid-cols-3 gap-3">
          {u.wallets.map((w) => (
            <div key={w.id} className="cp-card p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <AssetIcon symbol={w.symbol} color={w.color} size={34} />
                  <div>
                    <p className="font-semibold text-[14px] nums">{w.symbol}</p>
                    <p className="text-[11px] text-muted-foreground">{fmtUsd(w.valueUsd)}</p>
                  </div>
                </div>
                <PriceText price={w.price} className="text-[12px] text-muted-foreground" />
              </div>
              <div className="mt-3 space-y-1 text-[12.5px] nums">
                <div className="flex justify-between"><span className="text-muted-foreground">Available</span><span className="font-medium">{fmtCrypto(w.available, w.symbol, 6)}</span></div>
                {w.reserved > 0 && (
                  <div className="flex justify-between"><span className="text-muted-foreground">Reserved</span><span className="font-medium text-warn">{fmtCrypto(w.reserved, w.symbol, 6)}</span></div>
                )}
              </div>
              <p className="text-[10.5px] text-muted-foreground/70 nums mt-2 truncate" title={w.address}>{w.address}</p>
            </div>
          ))}
        </div>
      </div>

      {/* history grid */}
      <div className="grid lg:grid-cols-2 gap-4">
        <HistoryCard title="Ledger transactions" rows={data.ledgerTxs.slice(0, 10).map((t) => ({
          key: t.id, main: t.description, sub: `${t.reference} · ${fmtDateTime(t.createdAt)}`,
          right: <StatusPill status={t.status === 'POSTED' ? 'COMPLETED' : t.status} />,
        }))} />
        <HistoryCard title="Orders" rows={data.orders.slice(0, 10).map((o) => ({
          key: o.id, main: `${o.side} ${o.amountBase} ${o.baseSymbol}: ${fmtUsd(o.amountQuote)}`, sub: `${o.reference} · ${fmtDateTime(o.createdAt)}`,
          right: <StatusPill status={o.status === 'EXECUTED' ? 'COMPLETED' : o.status === 'PENDING' ? 'PENDING' : 'FAILED'} />,
        }))} />
        <HistoryCard title="Transfers" rows={data.transfers.slice(0, 8).map((t) => ({
          key: t.id, main: `${t.kind} ${t.amount} ${t.assetSymbol}`, sub: `${t.toAddress.slice(0, 14)}… · ${fmtDateTime(t.createdAt)}`,
          right: <StatusPill status={t.status === 'POSTED' ? 'COMPLETED' : t.status} />,
        }))} />
        <HistoryCard title="Security events" rows={data.securityEvents.slice(0, 8).map((e) => ({
          key: e.id, main: e.type.replaceAll('_', ' '), sub: `${e.ip ?? 'unknown'} · ${fmtDateTime(e.createdAt)}`,
          right: <span className={cn('w-2 h-2 rounded-full', e.type === 'LOGIN' ? 'bg-up' : e.type === 'LOGIN_FAILED' ? 'bg-destructive' : 'bg-warn')} />,
        }))} />
      </div>

      {/* adjust dialog */}
      <Dialog open={adjustOpen} onOpenChange={setAdjustOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>Adjust funds: {u.name}</DialogTitle>
            <DialogDescription>
              Posts a real ledger adjustment. Use credit for support deposits, debit for corrections: both are audited and reversible from Transactions.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Direction</Label>
                <Select value={adjust.direction} onValueChange={(v) => setAdjust({ ...adjust, direction: v })}>
                  <SelectTrigger className="h-10 rounded-xl bg-secondary/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CREDIT">Credit (add)</SelectItem>
                    <SelectItem value="DEBIT">Debit (remove)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Asset</Label>
                <Select value={adjust.symbol} onValueChange={(v) => setAdjust({ ...adjust, symbol: v })}>
                  <SelectTrigger className="h-10 rounded-xl bg-secondary/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {u.wallets.map((w) => <SelectItem key={w.symbol} value={w.symbol}>{w.symbol}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Amount</Label>
              <Input className="h-10 bg-secondary/60 rounded-xl nums" type="number" min="0" step="any" value={adjust.amount} onChange={(e) => setAdjust({ ...adjust, amount: e.target.value })} placeholder="0.00" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Reason (required)</Label>
              <Input className="h-10 bg-secondary/60 rounded-xl" value={adjust.reason} onChange={(e) => setAdjust({ ...adjust, reason: e.target.value })} placeholder="Support case #1234" />
            </div>
            <Button
              className="w-full h-10 rounded-xl font-semibold"
              disabled={busy || !(parseFloat(adjust.amount) > 0) || adjust.reason.trim().length < 3}
              onClick={submitAdjust}
            >
              {busy ? 'Posting…' : adjust.direction === 'CREDIT' ? (
                <><ArrowDownToLine className="w-4 h-4 mr-2" /> Credit {adjust.symbol}</>
              ) : (
                <><ArrowUpFromLine className="w-4 h-4 mr-2" /> Debit {adjust.symbol}</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function HistoryCard({ title, rows }: { title: string; rows: Array<{ key: string; main: string; sub: string; right: React.ReactNode }> }) {
  return (
    <div className="cp-card p-4">
      <h3 className="text-[13.5px] font-semibold mb-2">{title}</h3>
      {rows.length === 0 ? (
        <p className="text-[12px] text-muted-foreground py-4 text-center">Nothing yet.</p>
      ) : (
        <div className="divide-y divide-border/60">
          {rows.map((r) => (
            <div key={r.key} className="flex items-center gap-3 py-2.5">
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium truncate">{r.main}</p>
                <p className="text-[10.5px] text-muted-foreground nums truncate">{r.sub}</p>
              </div>
              {r.right}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
