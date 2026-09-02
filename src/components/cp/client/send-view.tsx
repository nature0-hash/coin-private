'use client';

// ============================================================
// Coin Private: Send
// Send crypto to an external address or another Coin Private
// user (internal transfers credit instantly, atomically).
// ============================================================
import { useState } from 'react';
import { useUI } from '@/lib/store';
import { usePortfolio, usePrices } from '@/hooks/use-cp-data';
import { AssetIcon, Keypad } from '@/components/cp/primitives';
import { fmtUsd, fmtCrypto, maskAddress } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Zap, Users, ChevronDown } from 'lucide-react';

export function SendView() {
  const { navigate, clientParams } = useUI();
  const { portfolio, reload } = usePortfolio();
  const { quotes } = usePrices(6000);
  const paramSymbol = clientParams.symbol ? clientParams.symbol.toUpperCase() : null;
  const [symbol, setSymbol] = useState(paramSymbol || 'BTC');
  const [raw, setRaw] = useState('');
  const [toAddress, setToAddress] = useState('');
  const [memo, setMemo] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [done, setDone] = useState<{ message: string; address: string } | null>(null);

  // navigation param → state, synced during render
  if (paramSymbol && paramSymbol !== symbol) {
    setSymbol(paramSymbol);
    setRaw('');
  }

  const cryptoHoldings = portfolio?.holdings.filter((h) => h.kind === 'CRYPTO') ?? [];
  const holding = cryptoHoldings.find((h) => h.symbol === symbol) ?? cryptoHoldings[0];
  const amount = parseFloat(raw || '0') || 0;
  const price = quotes[symbol]?.price ?? holding?.price ?? 0;
  const fee = amount * 0.001;
  const insufficient = holding ? amount + fee > holding.available + 1e-9 : false;

  function press(k: string) {
    if (k === 'back') setRaw((r) => r.slice(0, -1));
    else if (k === '.') setRaw((r) => (r.includes('.') ? r : (r || '0') + '.'));
    else setRaw((r) => (r === '0' ? k : (r + k).slice(0, 12)));
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch('/api/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol, amount, toAddress, memo: memo || undefined }),
      });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else {
        setDone({ message: data.message, address: toAddress });
        reload();
      }
    } catch {
      toast.error('Network error: try again');
    } finally {
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-[440px] mx-auto text-center py-10">
        <CheckCircle2 className="w-14 h-14 mx-auto text-up" />
        <h2 className="text-[22px] font-semibold tracking-tight mt-5">Send confirmed</h2>
        <p className="text-[14px] text-muted-foreground mt-2 leading-relaxed">{done.message}</p>
        <p className="text-[12px] text-muted-foreground nums mt-1">To {maskAddress(done.address)}</p>
        <div className="grid grid-cols-2 gap-2.5 mt-8">
          <Button variant="secondary" className="h-12 rounded-xl" onClick={() => { setDone(null); setRaw(''); setToAddress(''); setMemo(''); }}>
            New send
          </Button>
          <Button className="h-12 rounded-xl" onClick={() => navigate('activity')}>View activity</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-[520px] mx-auto">
      <button onClick={() => navigate('home')} className="inline-flex items-center gap-1.5 text-[13.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Home
      </button>
      <h1 className="text-[22px] font-semibold tracking-tight">Send</h1>
      <p className="text-[13.5px] text-muted-foreground mt-1 mb-6">Internal transfers land instantly. External sends broadcast with a real transaction hash.</p>

      {/* asset selector */}
      <div className="relative mb-5">
        <Label className="text-[12.5px] text-muted-foreground">Asset</Label>
        <button onClick={() => setPickerOpen(!pickerOpen)} className="w-full mt-1.5 flex items-center gap-3 cp-card p-3.5 cp-card-interactive text-left">
          <AssetIcon symbol={symbol} color={holding?.color} size={36} />
          <div className="flex-1">
            <p className="font-medium text-[14.5px]">{holding?.name ?? symbol}</p>
            <p className="text-[12px] text-muted-foreground nums">{fmtCrypto(holding?.available ?? 0, symbol, 6)} available</p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        {pickerOpen && (
          <div className="absolute z-20 left-0 right-0 mt-2 cp-card p-1.5 shadow-xl">
            {cryptoHoldings.map((h) => (
              <button
                key={h.symbol}
                onClick={() => { setSymbol(h.symbol); setPickerOpen(false); setRaw(''); }}
                className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary text-left', symbol === h.symbol && 'bg-secondary')}
              >
                <AssetIcon symbol={h.symbol} color={h.color} size={30} />
                <p className="flex-1 font-medium text-[13.5px]">{h.symbol}</p>
                <p className="text-[11.5px] text-muted-foreground nums">{fmtCrypto(h.available, h.symbol, 6)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* destination */}
      <div className="mb-5">
        <Label htmlFor="to" className="text-[12.5px] text-muted-foreground">Recipient address</Label>
        <Input
          id="to"
          className="h-12 mt-1.5 bg-secondary/60 rounded-xl nums"
          placeholder="Paste address or Coin Private handle"
          value={toAddress}
          onChange={(e) => setToAddress(e.target.value)}
        />
        <p className="text-[11.5px] text-muted-foreground mt-1.5 flex items-center gap-1.5">
          <Users className="w-3.5 h-3.5" /> On-platform addresses (from the Receive screen) credit the recipient instantly.
        </p>
      </div>

      {/* memo (optional) */}
      <div className="mb-5">
        <Label htmlFor="memo" className="text-[12.5px] text-muted-foreground">Memo (optional)</Label>
        <Input id="memo" className="h-11 mt-1.5 bg-secondary/60 rounded-xl" placeholder="What's this for?" value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={80} />
      </div>

      {/* amount */}
      <div className="text-center py-4">
        <p className="text-[13px] text-muted-foreground mb-2">Amount</p>
        <p className={cn('text-[38px] font-semibold nums tracking-tight leading-none min-h-[46px]', !amount && 'text-muted-foreground/50')}>
          {raw || '0'} <span className="text-[20px] text-muted-foreground">{symbol}</span>
        </p>
        <p className="text-[13px] text-muted-foreground nums mt-2">{fmtUsd(amount * price)}</p>
        <div className="flex justify-center gap-1.5 mt-3">
          {[25, 50, 100].map((p) => (
            <button
              key={p}
              onClick={() => setRaw(String(Number(((holding?.available ?? 0) * p / 100).toPrecision(8))))}
              className="text-[11.5px] font-medium text-primary bg-primary/10 hover:bg-primary/20 rounded-full px-2.5 py-1 transition-colors"
            >
              {p === 100 ? 'Max' : `${p}%`}
            </button>
          ))}
        </div>
      </div>

      <div className="cp-card p-2 my-3">
        <Keypad onKey={press} disabled={busy} />
      </div>

      <div className="px-1 space-y-1.5 text-[12.5px] text-muted-foreground mb-5">
        <div className="flex justify-between"><span>Network fee</span><span className="nums">{fmtCrypto(fee, symbol, 6)}</span></div>
        <div className="flex justify-between"><span>Total debit</span><span className="nums text-foreground">{fmtCrypto(amount + fee, symbol, 6)}</span></div>
        {insufficient && <p className="text-destructive">Insufficient balance (amount + fee).</p>}
      </div>

      <Button className="w-full h-12 rounded-2xl text-[15px] font-semibold" disabled={busy || !(amount > 0) || toAddress.length < 8 || insufficient} onClick={submit}>
        {busy ? 'Sending…' : `Send ${symbol}`}
      </Button>
      <p className="text-center text-[11.5px] text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
        <Zap className="w-3.5 h-3.5" /> Settles atomically: funds either move completely or not at all
      </p>
    </div>
  );
}
