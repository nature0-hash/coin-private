'use client';

// ============================================================
// Coin Private: Asset detail
// Live price, historical area chart, holdings card, buy/sell,
// send/receive shortcuts, asset stats.
// ============================================================
import { useMemo, useState } from 'react';
import { useUI } from '@/lib/store';
import { usePrices, usePortfolio, useFetch } from '@/hooks/use-cp-data';
import { AssetIcon, PctBadge, PriceText, SkeletonBlock, StatusPill, LiveBadge } from '@/components/cp/primitives';
import { fmtUsd, fmtCrypto, fmtPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { ArrowLeft, ArrowLeftRight, ArrowDownToLine, ArrowUpFromLine, QrCode, Info } from 'lucide-react';
import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer } from 'recharts';

const RANGES = [
  { key: '1H', label: '1H', points: 12 },
  { key: '1D', label: '1D', points: 24 },
  { key: '1W', label: '1W', points: 40 },
  { key: '1M', label: '1M', points: 60 },
];

export function AssetDetailView() {
  const { clientParams, navigate } = useUI();
  const symbol = (clientParams.symbol ?? 'BTC').toUpperCase();
  const { quotes, provider, updatedAt } = usePrices(4000);
  const { portfolio } = usePortfolio(15000);
  const [range, setRange] = useState('1D');

  const { data, loading } = useFetch<{ assets: Array<AssetDetailRow> }>('/api/assets');

  const q = quotes[symbol];
  const meta = data?.assets.find((a) => a.symbol === symbol);
  const holding = portfolio?.holdings.find((h) => h.symbol === symbol);

  const chartData = useMemo(() => {
    const spark = meta?.spark ?? [];
    if (spark.length < 2) return [];
    const points = RANGES.find((r) => r.key === range)?.points ?? 24;
    const slice = spark.slice(-points);
    return slice.map((p, i) => ({ x: i, v: p }));
  }, [meta, range]);

  const price = q?.price ?? meta?.price ?? 0;
  const change = q?.change24h ?? meta?.change24h ?? 0;
  const up = change >= 0;

  if (loading && !meta) {
    return (
      <div className="space-y-5">
        <SkeletonBlock className="h-8 w-32" />
        <SkeletonBlock className="h-24 w-56" />
        <SkeletonBlock className="h-56 w-full" />
      </div>
    );
  }
  if (!meta) {
    return (
      <div className="py-20 text-center">
        <p className="text-muted-foreground">Asset not found.</p>
        <Button variant="ghost" className="mt-4" onClick={() => navigate('markets')}>Back to markets</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-[860px]">
      {/* header */}
      <div className="flex items-center justify-between">
        <button onClick={() => navigate('markets')} className="inline-flex items-center gap-1.5 text-[13.5px] text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-4 h-4" /> Markets
        </button>
        <LiveBadge provider={provider} updatedAt={updatedAt} />
      </div>

      <div className="flex items-center gap-4">
        <AssetIcon symbol={meta.symbol} color={meta.color} size={52} />
        <div className="min-w-0">
          <h1 className="text-[22px] font-semibold tracking-tight flex items-center gap-2.5">
            {meta.name}
            <span className="text-[12px] font-medium text-muted-foreground bg-secondary rounded-full px-2.5 py-1 nums">{meta.symbol}</span>
          </h1>
          <div className="flex items-center gap-2 mt-1 text-[13px] text-muted-foreground">
            {meta.network && <span>{meta.network}</span>}
            {meta.network && <span>·</span>}
            <span>{meta.kind === 'CRYPTO' ? 'Crypto asset' : 'Cash'}</span>
          </div>
        </div>
      </div>

      {/* live price */}
      <div>
        <PriceText price={price} className="text-[36px] md:text-[42px] leading-none font-semibold" />
        <div className="flex items-center gap-2.5 mt-2.5">
          <PctBadge value={change} />
          <span className="text-[13px] text-muted-foreground nums">past 24 hours</span>
        </div>
      </div>

      {/* chart */}
      <div className="cp-card p-4 md:p-5">
        <div className="h-[220px] md:h-[280px]">
          {chartData.length > 2 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 6, right: 4, bottom: 0, left: 4 }}>
                <defs>
                  <linearGradient id={`ad-${symbol}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={meta.color} stopOpacity={0.28} />
                    <stop offset="100%" stopColor={meta.color} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="x" hide />
                <Tooltip
                  cursor={{ stroke: 'rgba(128,132,140,0.45)' }}
                  contentStyle={{ background: 'var(--popover)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 13 }}
                  formatter={(v: number) => [fmtPrice(v), meta.symbol]}
                  labelFormatter={() => ''}
                />
                <Area type="monotone" dataKey="v" stroke={meta.color} strokeWidth={2.2} fill={`url(#ad-${symbol})`} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-muted-foreground text-[13.5px]">
              Gathering price history…
            </div>
          )}
        </div>
        <div className="flex justify-center gap-1 mt-2">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={cn('px-3.5 py-1.5 rounded-full text-[12.5px] font-medium transition-colors', range === r.key ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground')}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* actions */}
      {meta.kind === 'CRYPTO' && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <Button className="h-12 rounded-xl font-semibold gap-2" onClick={() => navigate('trade', { side: 'BUY', symbol: meta.symbol })} disabled={!meta.tradeable}>
            <ArrowDownToLine className="w-4.5 h-4.5" /> Buy
          </Button>
          <Button variant="secondary" className="h-12 rounded-xl font-semibold gap-2" onClick={() => navigate('trade', { side: 'SELL', symbol: meta.symbol })} disabled={!meta.tradeable}>
            <ArrowUpFromLine className="w-4.5 h-4.5" /> Sell
          </Button>
          <Button variant="secondary" className="h-12 rounded-xl font-semibold gap-2" onClick={() => navigate('send', { symbol: meta.symbol })}>
            Send
          </Button>
          <Button variant="secondary" className="h-12 rounded-xl font-semibold gap-2" onClick={() => navigate('receive', { symbol: meta.symbol })}>
            <QrCode className="w-4.5 h-4.5" /> Receive
          </Button>
        </div>
      )}

      {/* your holding */}
      <div className="cp-card p-5">
        <div className="flex items-center justify-between">
          <div>
            <p className="micro-label">Your position</p>
            <p className="text-[24px] font-semibold nums mt-1.5">{fmtCrypto(holding?.total ?? 0, meta.symbol)}</p>
            <p className="text-[13px] text-muted-foreground nums mt-1">
              {fmtUsd(holding?.valueUsd ?? 0)}
              {holding && holding.reserved > 0 && <span className="ml-2">({fmtCrypto(holding.reserved, meta.symbol, 6)} reserved)</span>}
            </p>
          </div>
          <div className="text-right">
            <p className="micro-label">Value trend</p>
            <div className="mt-2 flex justify-end">
              <PctBadge value={change} />
            </div>
          </div>
        </div>
      </div>

      {/* stats */}
      <div className="cp-card p-5">
        <p className="micro-label mb-3">About this asset</p>
        <div className="grid grid-cols-2 gap-x-6 gap-y-4">
          <Stat label="Current price" value={fmtPrice(price)} />
          <Stat label="24h change" value={`${change >= 0 ? '+' : ''}${change.toFixed(2)}%`} tone={up ? 'up' : 'down'} />
          <Stat label="Network" value={meta.network ?? '-'} />
          <Stat label="Decimals" value={String(8)} />
          <Stat label="Status" value="" custom={<StatusPill status={meta.status} />} />
          <Stat label="Tradable" value={meta.tradeable ? 'Yes' : 'No'} />
        </div>
        <div className="mt-5 pt-4 border-t border-border flex gap-2.5 text-[12.5px] text-muted-foreground leading-relaxed">
          <Info className="w-4 h-4 shrink-0 mt-0.5" />
          <p>
            {meta.name} ({meta.symbol}) trades against the live provider feed.
            {meta.symbol === 'BTC' && ' Bitcoin is the original decentralized digital currency, secured by proof-of-work.'}
            {meta.symbol === 'ETH' && ' Ethereum is a programmable blockchain powering smart contracts and DeFi.'}
            {meta.symbol === 'SOL' && ' Solana is a high-throughput chain optimized for low fees and fast settlement.'}
            {meta.symbol === 'USDC' && ' USDC is a fully-reserved stablecoin pegged 1:1 to the US dollar.'}
            {!['BTC', 'ETH', 'SOL', 'USDC'].includes(meta.symbol) && ' Always do your own research before trading any asset.'}
          </p>
        </div>
      </div>

      {/* convert hint */}
      <button
        onClick={() => navigate('trade', { side: 'CONVERT', symbol: meta.symbol })}
        className="w-full cp-card cp-card-interactive p-4 flex items-center justify-between text-left"
      >
        <div className="flex items-center gap-3">
          <span className="w-10 h-10 rounded-full bg-primary/12 text-primary flex items-center justify-center">
            <ArrowLeftRight className="w-5 h-5" />
          </span>
          <div>
            <p className="font-medium text-[14.5px]">Convert {meta.symbol}</p>
            <p className="text-[12.5px] text-muted-foreground">Swap into or out of {meta.symbol} instantly</p>
          </div>
        </div>
        <ArrowLeftRight className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}

function Stat({ label, value, tone, custom }: { label: string; value: string; tone?: 'up' | 'down'; custom?: React.ReactNode }) {
  return (
    <div>
      <p className="text-[12px] text-muted-foreground">{label}</p>
      <p className={cn('text-[14.5px] font-medium nums mt-0.5', tone === 'up' && 'text-up', tone === 'down' && 'text-destructive')}>
        {custom ?? value}
      </p>
    </div>
  );
}

interface AssetDetailRow {
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
