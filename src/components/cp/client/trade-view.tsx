'use client';

// ============================================================
// Coin Private: Trade (Buy / Sell / Convert)
// Keypad-driven amount entry, live pricing from the provider,
// instant atomic settlement. Large orders route to compliance
// review with funds held: real pending state, no fake success.
// ============================================================
import { useMemo, useState } from 'react';
import { useUI } from '@/lib/store';
import { usePrices, usePortfolio } from '@/hooks/use-cp-data';
import {
  AssetIcon, Keypad, SegmentedTabs, PriceText, SkeletonBlock,
} from '@/components/cp/primitives';
import { fmtUsd, fmtCrypto, fmtPrice } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { ArrowLeftRight, CheckCircle2, Clock, ShieldCheck, ChevronDown, Gift } from 'lucide-react';
import { toast } from 'sonner';

type Side = 'BUY' | 'SELL' | 'CONVERT';

interface TradeResponse {
  status?: 'EXECUTED' | 'PENDING_APPROVAL';
  order?: { reference: string; amountBase: number; amountQuote: number; price: number; side: string; baseSymbol: string };
  message?: string;
  error?: string;
  promotion?: {
    kind: 'PROGRESS' | 'AWARDED';
    message: string;
    snapshot: { bonusUsd: number; unlockAt: string | null; streakDays: number; requiredDays: number };
  } | null;
}

export function TradeView() {
  const { clientParams, navigate } = useUI();
  const { quotes, provider } = usePrices(3000);
  const { portfolio, reload: reloadPortfolio } = usePortfolio(5000);

  // navigation params → state, synced during render
  const paramSide = (clientParams.side as Side) || null;
  const paramSymbol = clientParams.symbol ? clientParams.symbol.toUpperCase() : null;

  const [side, setSide] = useState<Side>(paramSide || 'BUY');
  const [symbol, setSymbol] = useState(paramSymbol || 'BTC');
  const [targetSymbol, setTargetSymbol] = useState('USDC');
  const [raw, setRaw] = useState('');
  const [mode, setMode] = useState<'QUOTE' | 'BASE'>('QUOTE');
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<TradeResponse | null>(null);
  const [pickerFor, setPickerFor] = useState<'base' | 'target' | null>(null);

  if ((paramSide && paramSide !== side) || (paramSymbol && paramSymbol !== symbol)) {
    if (paramSide && paramSide !== side) setSide(paramSide);
    if (paramSymbol && paramSymbol !== symbol) setSymbol(paramSymbol);
    setRaw('');
  }

  const holdings = portfolio?.holdings ?? [];
  const cryptoAssets = holdings.filter((h) => h.kind === 'CRYPTO' && h.tradeable);
  const fiatHoldings = holdings.filter((h) => h.kind === 'FIAT');
  const payAssets = [...fiatHoldings, ...holdings.filter((h) => h.kind === 'CRYPTO')];

  const baseQ = quotes[symbol];
  const baseMeta = holdings.find((h) => h.symbol === symbol);
  const price = baseQ?.price ?? baseMeta?.price ?? 0;

  const convertSource = side === 'CONVERT' ? targetSymbol : null;

  const amount = parseFloat(raw || '0') || 0;

  const derived = useMemo(() => {
    // amount is expressed either in quote (USD) or base (coin)
    if (side === 'BUY') {
      const quote = mode === 'QUOTE' ? amount : amount * price;
      const base = mode === 'QUOTE' ? (price > 0 ? amount / price : 0) : amount;
      return { quote, base, sourceSymbol: 'USD', sourceAmount: quote };
    }
    if (side === 'SELL') {
      const base = mode === 'BASE' ? amount : (price > 0 ? amount / price : 0);
      const quote = mode === 'BASE' ? amount * price : amount;
      return { quote, base, sourceSymbol: symbol, sourceAmount: base };
    }
    // CONVERT: amount is in source (targetSymbol) units
    const srcPrice = quotes[targetSymbol]?.price ?? holdings.find((h) => h.symbol === targetSymbol)?.price ?? 0;
    const quote = amount * srcPrice;
    const base = price > 0 ? quote / price : 0;
    return { quote, base, sourceSymbol: targetSymbol, sourceAmount: amount };
  }, [side, mode, amount, price, symbol, targetSymbol, quotes, holdings]);

  const fee = derived.quote * 0.0035; // display estimate; server applies exact platform fee
  const sourceBalance = holdings.find((h) => h.symbol === derived.sourceSymbol)?.available ?? 0;
  const insufficient = side === 'BUY'
    ? sourceBalance + 1e-9 < derived.quote + fee
    : sourceBalance + 1e-9 < derived.sourceAmount;

  function press(k: string) {
    if (k === 'back') {
      setRaw((r) => r.slice(0, -1));
    } else if (k === '.') {
      setRaw((r) => (r.includes('.') ? r : (r || '0') + '.'));
    } else {
      setRaw((r) => (r === '0' && k !== '.' ? k : (r + k).slice(0, 12)));
    }
  }

  function setPercent(p: number) {
    if (side === 'BUY') {
      const spendable = Math.max(sourceBalance - fee, 0);
      setRaw((spendable * p).toFixed(2));
    } else {
      setRaw(String(Number((sourceBalance * p).toPrecision(8))));
    }
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch('/api/trade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          side,
          baseSymbol: symbol,
          quoteSymbol: 'USD',
          sourceSymbol: side === 'CONVERT' ? derived.sourceSymbol : undefined,
          amount: side === 'CONVERT' ? amount : mode === 'BASE' ? amount : amount,
          amountMode: side === 'CONVERT' ? 'BASE' : mode === 'BASE' ? 'BASE' : 'QUOTE',
        }),
      });
      const data: TradeResponse = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setReceipt(data);
        setRaw('');
        reloadPortfolio();
        if (data.status === 'EXECUTED') toast.success(data.message ?? 'Order executed');
        else toast.info(data.message ?? 'Order queued for review');
        if (data.promotion) toast.success(data.promotion.message, { duration: 8000 });
      }
    } catch {
      toast.error('Network error: try again');
    } finally {
      setBusy(false);
    }
  }

  const displayAmount = side === 'CONVERT'
    ? `${fmtCrypto(amount, derived.sourceSymbol)}`
    : mode === 'QUOTE'
      ? fmtUsd(amount)
      : `${fmtCrypto(amount, undefined, 6)} ${symbol}`;

  const secondary = side === 'CONVERT'
    ? `≈ ${fmtCrypto(derived.base, symbol, 6)}`
    : mode === 'QUOTE'
      ? `≈ ${fmtCrypto(derived.base, symbol, 6)}`
      : `≈ ${fmtUsd(derived.quote)}`;

  const payLabel = side === 'BUY' ? 'You pay' : side === 'SELL' ? 'You sell' : 'You convert';
  const receiveLabel = 'You receive';

  return (
    <div className="max-w-[520px] mx-auto">
      {/* side tabs */}
      <div className="flex justify-center mb-6">
        <SegmentedTabs
          items={[
            { value: 'BUY', label: 'Buy' },
            { value: 'SELL', label: 'Sell' },
            { value: 'CONVERT', label: 'Convert' },
          ]}
          value={side}
          onChange={(v) => {
            setSide(v as Side);
            setRaw('');
            setMode('QUOTE');
          }}
          className="w-full [&>button]:flex-1 [&>button]:text-center"
        />
      </div>

      {/* asset picker row */}
      <div className="flex items-center justify-center gap-3 mb-2">
        {side === 'CONVERT' ? (
          <>
            <AssetPicker
              label="From"
              symbol={targetSymbol}
              color={quotes[targetSymbol]?.color ?? holdings.find((h) => h.symbol === targetSymbol)?.color}
              onPick={() => setPickerFor('target')}
            />
            <button
              onClick={() => {
                const t = targetSymbol;
                setTargetSymbol(symbol);
                setSymbol(t);
                setRaw('');
              }}
              className="w-9 h-9 rounded-full bg-secondary border border-border flex items-center justify-center hover:bg-accent transition-colors"
              aria-label="Swap direction"
            >
              <ArrowLeftRight className="w-4 h-4" />
            </button>
            <AssetPicker
              label="To"
              symbol={symbol}
              color={quotes[symbol]?.color ?? baseMeta?.color}
              onPick={() => setPickerFor('base')}
            />
          </>
        ) : (
          <AssetPicker
            label={side === 'BUY' ? 'Buying' : 'Selling'}
            symbol={symbol}
            color={quotes[symbol]?.color ?? baseMeta?.color}
            onPick={() => setPickerFor('base')}
          />
        )}
      </div>

      {/* price line */}
      <p className="text-center text-[13px] text-muted-foreground nums mb-6">
        {price > 0 ? <>1 {symbol} = <PriceText price={price} format={(n) => fmtPrice(n)} /></> : 'Waiting for price…'}
        {provider && <span className="ml-2 opacity-60">· {provider}</span>}
      </p>

      {/* big amount */}
      <div className="text-center py-6">
        <p className="text-[13px] text-muted-foreground mb-2">{payLabel}</p>
        <p className={cn('text-[40px] md:text-[46px] font-semibold nums tracking-tight leading-none min-h-[48px]', !amount && 'text-muted-foreground/50')}>
          {amount ? displayAmount : side === 'CONVERT' ? `${fmtCrypto(0, derived.sourceSymbol)}` : mode === 'QUOTE' ? fmtUsd(0) : `0 ${symbol}`}
        </p>
        <p className="text-[14px] text-muted-foreground nums mt-3">{amount ? secondary : 'Enter an amount'}</p>
      </div>

      {/* balance + quick % */}
      <div className="flex items-center justify-between mb-2 px-1">
        <p className="text-[12.5px] text-muted-foreground nums">
          Available: {fmtCrypto(sourceBalance, derived.sourceSymbol, 6)}
        </p>
        <div className="flex gap-1.5">
          {[25, 50, 100].map((p) => (
            <button
              key={p}
              onClick={() => setPercent(p / 100)}
              className="text-[11.5px] font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-full px-2.5 py-1 transition-colors"
            >
              {p === 100 ? 'Max' : `${p}%`}
            </button>
          ))}
        </div>
      </div>

      {/* keypad */}
      <div className="cp-card p-2 mb-4">
        <Keypad onKey={press} disabled={busy} />
      </div>

      {/* summary */}
      <div className="px-1 space-y-1.5 text-[12.5px] text-muted-foreground mb-5">
        {side !== 'CONVERT' && (
          <div className="flex justify-between">
            <span>Estimated fee</span>
            <span className="nums">{fmtUsd(fee)}</span>
          </div>
        )}
        <div className="flex justify-between">
          <span>{receiveLabel}</span>
          <span className="nums text-foreground">
            {side === 'BUY' ? fmtCrypto(derived.base, symbol, 6) : side === 'SELL' ? fmtUsd(Math.max(derived.quote - fee, 0)) : fmtCrypto(derived.base, symbol, 6)}
          </span>
        </div>
        {insufficient && amount > 0 && (
          <p className="text-destructive text-[12.5px]">Insufficient {derived.sourceSymbol} balance for this order.</p>
        )}
      </div>

      <Button
        className="w-full h-12 py-4 rounded-2xl text-[15.5px] font-semibold"
        disabled={busy || !(amount > 0) || insufficient}
        onClick={submit}
      >
        {busy ? 'Placing order…' : side === 'BUY' ? `Buy ${symbol}` : side === 'SELL' ? `Sell ${symbol}` : `Convert to ${symbol}`}
      </Button>
      <p className="text-center text-[11.5px] text-muted-foreground mt-3">
        Market order · settles instantly on the atomic ledger
      </p>

      {/* asset picker modal */}
      <Dialog open={pickerFor !== null} onOpenChange={(o) => !o && setPickerFor(null)}>
        <DialogContent className="max-w-[380px] p-0 overflow-hidden">
          <DialogHeader className="p-5 pb-3">
            <DialogTitle>{pickerFor === 'target' ? 'Convert from' : 'Select asset'}</DialogTitle>
            <DialogDescription className="text-[12.5px]">Only assets you hold with live prices are listed.</DialogDescription>
          </DialogHeader>
          <div className="max-h-[360px] overflow-y-auto px-2 pb-3">
            {(pickerFor === 'target' ? (side === 'CONVERT' ? cryptoAssets : payAssets) : cryptoAssets.length ? cryptoAssets : holdings).map((h) => (
              <button
                key={h.symbol}
                onClick={() => {
                  if (pickerFor === 'target') setTargetSymbol(h.symbol);
                  else setSymbol(h.symbol);
                  setPickerFor(null);
                  setRaw('');
                }}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-3 rounded-xl hover:bg-secondary transition-colors text-left',
                  ((pickerFor === 'target' && targetSymbol === h.symbol) || (pickerFor === 'base' && symbol === h.symbol)) && 'bg-secondary'
                )}
              >
                <AssetIcon symbol={h.symbol} color={h.color} size={36} />
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-[14px]">{h.name}</p>
                  <p className="text-[12px] text-muted-foreground nums">{fmtCrypto(h.available, h.symbol, 6)} available</p>
                </div>
                <PriceText price={quotes[h.symbol]?.price ?? h.price} className="text-[13px] text-muted-foreground" />
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* receipt dialog */}
      <Dialog open={receipt !== null} onOpenChange={(o) => !o && setReceipt(null)}>
        <DialogContent className="max-w-[400px]">
          {receipt?.status === 'EXECUTED' ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5">
                  <CheckCircle2 className="w-5.5 h-5.5 text-up" /> Order settled
                </DialogTitle>
                <DialogDescription>{receipt.message}</DialogDescription>
              </DialogHeader>
              <div className="cp-card p-4 space-y-2 text-[13.5px] mt-1">
                <Row label="Reference" value={receipt.order?.reference ?? '-'} />
                <Row label="Price" value={fmtPrice(receipt.order?.price ?? 0)} />
                <Row label="Amount" value={fmtCrypto(receipt.order?.amountBase ?? 0, receipt.order?.baseSymbol, 8)} />
                <Row label="Notional" value={fmtUsd(receipt.order?.amountQuote ?? 0)} />
              </div>
              {receipt.promotion && (
                <div className="rounded-xl border border-primary/25 bg-primary/10 p-3.5 text-[12.5px] leading-relaxed mt-2">
                  <p className="font-semibold text-foreground flex items-center gap-2">
                    <Gift className="w-4 h-4 text-primary" /> First-week trading match
                  </p>
                  <p className="text-muted-foreground mt-1">{receipt.promotion.message}</p>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2.5 mt-2">
                <Button variant="secondary" className="rounded-xl" onClick={() => setReceipt(null)}>Done</Button>
                <Button className="rounded-xl" onClick={() => { setReceipt(null); navigate('activity'); }}>View activity</Button>
              </div>
            </>
          ) : receipt ? (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2.5">
                  <Clock className="w-5.5 h-5.5 text-warn" /> Queued for review
                </DialogTitle>
                <DialogDescription>{receipt.message}</DialogDescription>
              </DialogHeader>
              <div className="cp-card p-4 space-y-2 text-[13.5px] mt-1">
                <Row label="Reference" value={receipt.order?.reference ?? '-'} />
                <Row label="Notional" value={fmtUsd(receipt.order?.amountQuote ?? 0)} />
              </div>
              <div className="flex items-start gap-2 text-[12px] text-muted-foreground mt-3">
                <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5" />
                <p>Orders above the platform review threshold are settled after compliance approval. Your funds are held safely: you can track this in Activity.</p>
              </div>
              <Button className="w-full rounded-xl mt-2" onClick={() => { setReceipt(null); navigate('activity'); }}>Track in activity</Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="nums font-medium">{value}</span>
    </div>
  );
}

function AssetPicker({ label, symbol, color, onPick }: { label: string; symbol: string; color?: string; onPick: () => void }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <span className="text-[11px] text-muted-foreground uppercase tracking-wide">{label}</span>
      <button
        onClick={onPick}
        className="flex items-center gap-2.5 cp-card cp-card-interactive px-4 py-2.5"
        aria-label={`${label}: ${symbol}. Change`}
      >
        <AssetIcon symbol={symbol} color={color} size={30} />
        <span className="font-semibold text-[15px] nums">{symbol}</span>
        <ChevronDown className="w-4 h-4 text-muted-foreground" />
      </button>
    </div>
  );
}
