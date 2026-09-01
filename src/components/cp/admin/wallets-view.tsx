'use client';

// ============================================================
// Coin Private: Admin wallets (platform-wide custody view)
// ============================================================
import { useMemo, useState } from 'react';
import { useFetch, usePrices } from '@/hooks/use-cp-data';
import { useUI } from '@/lib/store';
import { AssetIcon, SkeletonBlock, StatusPill, EmptyState, PriceText } from '@/components/cp/primitives';
import { fmtUsd, fmtCrypto, maskAddress } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Search, Eye } from 'lucide-react';

interface WalletRow {
  id: string; userId: string; userName: string; userEmail: string; userStatus: string;
  symbol: string; assetName: string; color: string; available: number; reserved: number;
  total: number; price: number; valueUsd: number; address: string; updatedAt: string;
}

export function AdminWalletsView() {
  const { data, loading } = useFetch<{ wallets: WalletRow[] }>('/api/admin/wallets');
  const { quotes } = usePrices(15000);
  const { adminNavigate } = useUI();
  const [q, setQ] = useState('');

  const wallets = useMemo(() => {
    const rows = (data?.wallets ?? []).map((w) => {
      const price = quotes[w.symbol]?.price ?? w.price;
      return { ...w, price, valueUsd: (w.available + w.reserved) * price };
    });
    return rows
      .filter((w) => `${w.userName} ${w.userEmail} ${w.symbol}`.toLowerCase().includes(q.toLowerCase()))
      .sort((a, b) => b.valueUsd - a.valueUsd);
  }, [data, quotes, q]);

  const totalUsd = wallets.reduce((s, w) => s + w.valueUsd, 0);

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Wallets</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">
            Platform custody · {fmtUsd(totalUsd, { compact: true })} across {wallets.length} wallets
          </p>
        </div>
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="h-10 pl-9.5 rounded-full bg-secondary/60" placeholder="Filter by user or asset" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
      </div>

      {loading && !data ? (
        <div className="cp-card p-4 space-y-3">{[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} className="h-11" />)}</div>
      ) : wallets.length === 0 ? (
        <div className="cp-card"><EmptyState icon={<Search className="w-5 h-5" />} title="No wallets match" /></div>
      ) : (
        <div className="cp-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[820px]">
              <thead>
                <tr className="text-left text-muted-foreground text-[11px] uppercase tracking-wide border-b border-border">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Asset</th>
                  <th className="px-3 py-3 font-medium text-right">Available</th>
                  <th className="px-3 py-3 font-medium text-right">Reserved</th>
                  <th className="px-3 py-3 font-medium text-right">Price</th>
                  <th className="px-3 py-3 font-medium text-right">Value</th>
                  <th className="px-3 py-3 font-medium">Address</th>
                  <th className="px-5 py-3 font-medium text-right">User</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {wallets.slice(0, 100).map((w) => (
                  <tr key={w.id} className="hover:bg-hover transition-colors">
                    <td className="px-5 py-3">
                      <button className="text-left hover:text-primary transition-colors" onClick={() => adminNavigate('user-detail', { id: w.userId })}>
                        <p className="font-medium">{w.userName}</p>
                        <p className="text-[11px] text-muted-foreground">{w.userEmail}</p>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-2">
                        <AssetIcon symbol={w.symbol} color={w.color} size={24} />
                        <span className="nums font-medium">{w.symbol}</span>
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right nums font-medium">{fmtCrypto(w.available, w.symbol, 6)}</td>
                    <td className={cn('px-3 py-3 text-right nums', w.reserved > 0 ? 'text-warn' : 'text-muted-foreground')}>
                      {w.reserved > 0 ? fmtCrypto(w.reserved, w.symbol, 6) : '-'}
                    </td>
                    <td className="px-3 py-3 text-right nums text-muted-foreground"><PriceText price={w.price} className="text-[12.5px] text-muted-foreground" /></td>
                    <td className="px-3 py-3 text-right nums font-medium">{fmtUsd(w.valueUsd)}</td>
                    <td className="px-3 py-3 text-[11.5px] text-muted-foreground nums">{maskAddress(w.address)}</td>
                    <td className="px-5 py-3 text-right"><StatusPill status={w.userStatus} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="text-[11.5px] text-muted-foreground/70 flex items-center gap-1.5">
        <Eye className="w-3.5 h-3.5" /> Reserved balances are funds held for pending withdrawals or risk-reviewed trades.
      </p>
    </div>
  );
}
