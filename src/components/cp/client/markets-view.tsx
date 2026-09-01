'use client';

// ============================================================
// Coin Private: Markets
// Trending strip, most-traded cards, full asset list with
// sparklines + search + categories. Live prices w/ flash.
// ============================================================
import { useEffect, useMemo, useState } from 'react';
import { useUI } from '@/lib/store';
import { usePrices } from '@/hooks/use-cp-data';
import { useFetch } from '@/hooks/use-cp-data';
import { AssetIcon, PctBadge, PriceText, Sparkline, SkeletonBlock, SegmentedTabs, EmptyState, LiveBadge } from '@/components/cp/primitives';
import { cn } from '@/lib/utils';
import { Search, Star, TrendingUp } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface AssetRow {
  symbol: string;
  name: string;
  kind: string;
  color: string;
  network: string | null;
  status: string;
  tradeable: boolean;
  price: number;
  change24h: number;
  spark: number[];
}

export function MarketsView() {
  const { navigate } = useUI();
  const { quotes, provider, updatedAt } = usePrices(4000);
  const { data, loading, reload } = useFetch<{ assets: AssetRow[] }>('/api/assets');
  const [search, setSearch] = useState('');
  const [cat, setCat] = useState('all');
  const [watching, setWatching] = useState<string[]>([]);

  useEffect(() => {
    fetch('/api/watchlist').then((r) => r.json()).then((d) => setWatching(d.symbols ?? [])).catch(() => {});
  }, []);

  const assets = useMemo(() => {
    const rows = data?.assets ?? [];
    return rows.map((a) => {
      const q = quotes[a.symbol];
      return q ? { ...a, price: q.price, change24h: q.change24h } : a;
    });
  }, [data, quotes]);

  const filtered = assets.filter((a) => {
    if (a.status !== 'LISTED') return false;
    if (cat === 'crypto' && a.kind !== 'CRYPTO') return false;
    if (cat === 'fiat' && a.kind !== 'FIAT') return false;
    if (cat === 'watch' && !watching.includes(a.symbol)) return false;
    if (search && !`${a.name} ${a.symbol}`.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const trending = [...assets]
    .filter((a) => a.kind === 'CRYPTO' && a.status === 'LISTED')
    .sort((a, b) => Math.abs(b.change24h) - Math.abs(a.change24h))
    .slice(0, 3);

  async function toggleWatch(symbol: string) {
    const prev = watching;
    setWatching((w) => (w.includes(symbol) ? w.filter((s) => s !== symbol) : [...w, symbol]));
    try {
      await fetch('/api/watchlist', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ symbol }) });
    } catch {
      setWatching(prev);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-muted-foreground" />
          <Input
            className="h-11 pl-10 rounded-full bg-secondary/60 border-transparent focus:border-input"
            placeholder="Search markets"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Search markets"
          />
        </div>
        <LiveBadge provider={provider} updatedAt={updatedAt} />
      </div>

      {/* ---------- Trending cards ---------- */}
      <section>
        <div className="flex items-center gap-2 mb-3">
          <TrendingUp className="w-4.5 h-4.5 text-primary" />
          <h2 className="text-[17px] font-semibold tracking-tight">Trending now</h2>
          <span className="text-[12px] text-muted-foreground">biggest 24h moves</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {loading && !data
            ? [1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-[116px]" />)
            : trending.map((a) => (
                <button
                  key={a.symbol}
                  onClick={() => navigate('asset', { symbol: a.symbol })}
                  className="cp-card cp-card-interactive p-4 text-left group"
                >
                  <div className="flex items-center gap-3">
                    <AssetIcon symbol={a.symbol} color={a.color} size={38} />
                    <div className="min-w-0">
                      <p className="font-semibold text-[14.5px] truncate">{a.name}</p>
                      <p className="text-[12px] text-muted-foreground">{a.symbol}</p>
                    </div>
                  </div>
                  <div className="mt-3 flex items-end justify-between">
                    <div>
                      <PriceText price={a.price} className="text-[15px] font-medium" />
                      <PctBadge value={a.change24h} className="ml-1.5 text-[11.5px]" />
                    </div>
                    <Sparkline data={a.spark} up={a.change24h >= 0} width={80} height={30} />
                  </div>
                </button>
              ))}
        </div>
      </section>

      {/* ---------- Category tabs ---------- */}
      <div className="flex items-center justify-between gap-3 overflow-x-auto no-scrollbar -mx-1 px-1">
        <SegmentedTabs
          items={[
            { value: 'all', label: 'All' },
            { value: 'crypto', label: 'Crypto' },
            { value: 'fiat', label: 'Cash' },
            { value: 'watch', label: 'Watchlist' },
          ]}
          value={cat}
          onChange={setCat}
        />
        <Button variant="ghost" size="sm" className="rounded-full text-[12.5px] shrink-0" onClick={reload}>
          Refresh
        </Button>
      </div>

      {/* ---------- Asset list ---------- */}
      <div className="cp-card divide-y divide-border overflow-hidden">
        {loading && !data ? (
          <div className="p-4 space-y-4">{[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} className="h-12" />)}</div>
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={<Search className="w-5 h-5" />}
            title={cat === 'watch' ? 'Your watchlist is empty' : 'No assets match'}
            body={cat === 'watch' ? 'Tap the star on any asset to track it here.' : 'Try a different search or category.'}
          />
        ) : (
          filtered.map((a) => (
            <div key={a.symbol} className="flex items-center gap-3 px-4 md:px-5 py-3.5 hover:bg-hover transition-colors">
              <button
                onClick={() => toggleWatch(a.symbol)}
                className="p-1 -ml-1 rounded-full text-muted-foreground/50 hover:text-warn transition-colors"
                aria-label={watching.includes(a.symbol) ? `Remove ${a.symbol} from watchlist` : `Add ${a.symbol} to watchlist`}
              >
                <Star className={cn('w-4.5 h-4.5', watching.includes(a.symbol) && 'fill-warn text-warn')} />
              </button>
              <button onClick={() => navigate('asset', { symbol: a.symbol })} className="flex items-center gap-3.5 flex-1 min-w-0 text-left">
                <AssetIcon symbol={a.symbol} color={a.color} size={40} />
                <div className="min-w-0">
                  <p className="font-medium text-[14.5px] truncate">{a.name}</p>
                  <p className="text-[12.5px] text-muted-foreground nums">{a.symbol}{a.network ? ` · ${a.network}` : ''}</p>
                </div>
              </button>
              <div className="hidden sm:block">
                <Sparkline data={a.spark} up={a.change24h >= 0} width={88} height={32} />
              </div>
              <button onClick={() => navigate('asset', { symbol: a.symbol })} className="text-right shrink-0 w-[104px]">
                <PriceText price={a.price} className="font-medium text-[14.5px]" />
                <div className="flex justify-end mt-0.5"><PctBadge value={a.change24h} showBg={false} className="text-[12px]" /></div>
              </button>
            </div>
          ))
        )}
      </div>

      <p className="text-[11.5px] text-muted-foreground/70 text-center">
        Prices refresh automatically from the configured provider ({provider || '-'}): the same feed that powers order execution.
      </p>
    </div>
  );
}
