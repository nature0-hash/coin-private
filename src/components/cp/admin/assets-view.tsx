'use client';

// ============================================================
// Coin Private: Admin asset management
// List/delist, tradeable toggle, price override, new listing.
// ============================================================
import { useState } from 'react';
import { useFetch } from '@/hooks/use-cp-data';
import { AssetIcon, SkeletonBlock, StatusPill, PriceText } from '@/components/cp/primitives';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, RefreshCw } from 'lucide-react';

interface AdminAssetRow {
  symbol: string; name: string; kind: string; color: string; decimals: number;
  network: string | null; priceUsd: number; change24h: number; status: string;
  tradeable: boolean; sortOrder: number; walletCount: number;
}

export function AdminAssetsView() {
  const { data, loading, reload } = useFetch<{ assets: AdminAssetRow[] }>('/api/admin/assets');
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ symbol: '', name: '', kind: 'CRYPTO', priceUsd: '', color: '#8A8F98', network: '' });
  const [busy, setBusy] = useState(false);

  async function patch(symbol: string, payload: Record<string, unknown>, msg: string) {
    const res = await fetch('/api/admin/assets', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ symbol, ...payload }),
    });
    const d = await res.json();
    if (d.error) toast.error(d.error);
    else {
      toast.success(msg);
      reload();
    }
  }

  async function create() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/assets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          symbol: form.symbol, name: form.name, kind: form.kind,
          priceUsd: parseFloat(form.priceUsd || '0'), color: form.color, network: form.network || undefined,
        }),
      });
      const d = await res.json();
      if (d.error) toast.error(d.error);
      else {
        toast.success(`Listed ${form.symbol}`);
        setCreateOpen(false);
        setForm({ symbol: '', name: '', kind: 'CRYPTO', priceUsd: '', color: '#8A8F98', network: '' });
        reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Assets</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">Listings, tradeability and price feeds. Delisting hides assets from markets instantly.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="rounded-full gap-1.5 text-[12.5px]" onClick={reload}>
            <RefreshCw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button className="rounded-full gap-2" onClick={() => setCreateOpen(true)}>
            <Plus className="w-4 h-4" /> New asset
          </Button>
        </div>
      </div>

      {loading && !data ? (
        <div className="cp-card p-4 space-y-3">{[1, 2, 3, 4].map((i) => <SkeletonBlock key={i} className="h-14" />)}</div>
      ) : (
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
          {(data?.assets ?? []).map((a) => (
            <div key={a.symbol} className={cn('cp-card p-4', a.status !== 'LISTED' && 'opacity-70')}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AssetIcon symbol={a.symbol} color={a.color} size={38} />
                  <div>
                    <p className="font-semibold text-[14.5px]">{a.name}</p>
                    <p className="text-[11.5px] text-muted-foreground nums">
                      {a.symbol} · {a.kind}{a.network ? ` · ${a.network}` : ''}
                    </p>
                  </div>
                </div>
                <StatusPill status={a.status} />
              </div>
              <div className="flex items-center justify-between mt-3.5">
                <PriceText price={a.priceUsd} className="text-[15px] font-semibold" />
                <span className="text-[11.5px] text-muted-foreground">{a.walletCount} wallets</span>
              </div>
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
                <div className="flex items-center gap-2">
                  <Switch
                    checked={a.tradeable}
                    onCheckedChange={(v) => patch(a.symbol, { tradeable: v }, `${a.symbol} ${v ? 'tradeable' : 'trade paused'}`)}
                    aria-label={`Toggle ${a.symbol} tradeable`}
                  />
                  <span className="text-[12px] text-muted-foreground">Tradeable</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="rounded-full text-[12px]"
                  onClick={() => patch(a.symbol, { status: a.status === 'LISTED' ? 'DELISTED' : 'LISTED' }, `${a.symbol} ${a.status === 'LISTED' ? 'delisted' : 'listed'}`)}
                >
                  {a.status === 'LISTED' ? 'Delist' : 'Relist'}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <p className="text-[11.5px] text-muted-foreground/70">
        Note: live prices come from the configured provider (see Platform settings). The priceUsd value here is the fallback shown if the provider has no quote yet.
      </p>

      {/* create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>List a new asset</DialogTitle>
            <DialogDescription>The asset appears in markets immediately with the price you set, then follows the live provider feed.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Symbol</Label>
                <Input className="h-10 bg-secondary/60 rounded-xl uppercase" placeholder="TON" maxLength={10} value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger className="h-10 rounded-xl bg-secondary/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CRYPTO">Crypto</SelectItem>
                    <SelectItem value="FIAT">Fiat</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Name</Label>
              <Input className="h-10 bg-secondary/60 rounded-xl" placeholder="Toncoin" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Initial price (USD)</Label>
                <Input className="h-10 bg-secondary/60 rounded-xl nums" type="number" min="0" step="any" placeholder="0" value={form.priceUsd} onChange={(e) => setForm({ ...form, priceUsd: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Network (optional)</Label>
                <Input className="h-10 bg-secondary/60 rounded-xl" placeholder="The Open Network" value={form.network} onChange={(e) => setForm({ ...form, network: e.target.value })} />
              </div>
            </div>
            <Button className="w-full h-10 rounded-xl font-semibold" disabled={busy || form.symbol.length < 2 || form.name.length < 2} onClick={create}>
              {busy ? 'Listing…' : 'List asset'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
