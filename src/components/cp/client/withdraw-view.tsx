'use client';

// ============================================================
// Coin Private: Withdraw
// Creates a withdrawal request, funds move available → reserved
// (real hold) and settle after compliance approval.
// ============================================================
import { useState } from 'react';
import { useUI } from '@/lib/store';
import { usePortfolio } from '@/hooks/use-cp-data';
import { AssetIcon, Keypad } from '@/components/cp/primitives';
import { fmtUsd, fmtCrypto } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { ArrowLeft, CheckCircle2, Clock, ShieldCheck, ChevronDown } from 'lucide-react';

export function WithdrawView() {
  const { navigate } = useUI();
  const { portfolio, reload } = usePortfolio();
  const [symbol, setSymbol] = useState('USD');
  const [raw, setRaw] = useState('');
  const [address, setAddress] = useState('');
  const [busy, setBusy] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [done, setDone] = useState<{ message: string } | null>(null);

  // Derive the effective symbol during render (no effect needed):
  // if the chosen symbol has no holding, fall back to the first one.
  const chosen = portfolio?.holdings.find((h) => h.symbol === symbol);
  const effective = chosen ?? portfolio?.holdings[0];
  const activeSymbol = effective?.symbol ?? symbol;
  const holding = effective;
  const amount = parseFloat(raw || '0') || 0;
  const fee = amount * 0.0005;
  const insufficient = holding ? amount + fee > holding.available + 1e-9 : false;
  const lockedMatch = activeSymbol === 'USD' && portfolio?.welcomeMatch.status === 'LOCKED'
    ? portfolio.welcomeMatch
    : null;
  const lockedUntil = lockedMatch?.unlockAt
    ? new Date(lockedMatch.unlockAt).toLocaleDateString('en-US', { timeZone: 'UTC', month: 'long', day: 'numeric', year: 'numeric' })
    : null;

  function press(k: string) {
    if (k === 'back') setRaw((r) => r.slice(0, -1));
    else if (k === '.') setRaw((r) => (r.includes('.') ? r : (r || '0') + '.'));
    else setRaw((r) => (r === '0' ? k : (r + k).slice(0, 12)));
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch('/api/withdrawals', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: activeSymbol, amount, address }),
      });
      const data = await res.json();
      if (data.error) toast.error(data.error);
      else {
        setDone({ message: data.message });
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
        <Clock className="w-14 h-14 mx-auto text-warn" />
        <h2 className="text-[22px] font-semibold tracking-tight mt-5">Withdrawal requested</h2>
        <p className="text-[14px] text-muted-foreground mt-2 leading-relaxed">{done.message}</p>
        <div className="grid grid-cols-2 gap-2.5 mt-8">
          <Button variant="secondary" className="h-12 rounded-xl" onClick={() => { setDone(null); setRaw(''); setAddress(''); }}>
            New withdrawal
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
      <h1 className="text-[22px] font-semibold tracking-tight">Withdraw</h1>
      <p className="text-[13.5px] text-muted-foreground mt-1 mb-6">Funds are held safely and sent after a quick compliance check.</p>

      {/* asset selector */}
      <div className="relative mb-5">
        <Label className="text-[12.5px] text-muted-foreground">Asset</Label>
        <button
          onClick={() => setPickerOpen(!pickerOpen)}
          className="w-full mt-1.5 flex items-center gap-3 cp-card p-3.5 cp-card-interactive text-left"
        >
          <AssetIcon symbol={symbol} color={holding?.color} size={36} />
          <div className="flex-1">
            <p className="font-medium text-[14.5px]">{holding?.name ?? activeSymbol}</p>
            <p className="text-[12px] text-muted-foreground nums">{fmtCrypto(holding?.available ?? 0, activeSymbol, 6)} available</p>
          </div>
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        </button>
        {pickerOpen && (
          <div className="absolute z-20 left-0 right-0 mt-2 cp-card p-1.5 shadow-xl max-h-[260px] overflow-y-auto">
            {portfolio?.holdings.filter((h) => h.available > 0).map((h) => (
              <button
                key={h.symbol}
                onClick={() => { setSymbol(h.symbol); setPickerOpen(false); setRaw(''); }}
                className={cn('w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-secondary text-left', symbol === h.symbol && 'bg-secondary')}
              >
                <AssetIcon symbol={h.symbol} color={h.color} size={30} />
                <div className="flex-1">
                  <p className="font-medium text-[13.5px]">{h.symbol}</p>
                  <p className="text-[11.5px] text-muted-foreground nums">{fmtCrypto(h.available, h.symbol, 6)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* destination */}
      <div className="mb-5">
        <Label htmlFor="dest" className="text-[12.5px] text-muted-foreground">
          {activeSymbol === 'USD' ? 'Bank account / destination' : 'Destination address'}
        </Label>
        <Input
          id="dest"
          className="h-12 mt-1.5 bg-secondary/60 rounded-xl nums"
          placeholder={activeSymbol === 'USD' ? '•••• 4821' : 'bc1q… / 0x… / So1u…'}
          value={address}
          onChange={(e) => setAddress(e.target.value)}
        />
      </div>

      {/* amount */}
      <div className="text-center py-4">
        <p className="text-[13px] text-muted-foreground mb-2">Amount</p>
        <p className={cn('text-[38px] font-semibold nums tracking-tight leading-none min-h-[46px]', !amount && 'text-muted-foreground/50')}>
          {raw || '0'} <span className="text-[20px] text-muted-foreground">{activeSymbol}</span>
        </p>
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
        <div className="flex justify-between"><span>Withdrawal fee</span><span className="nums">{fmtUsd(fee)}</span></div>
        <div className="flex justify-between"><span>Total held</span><span className="nums text-foreground">{fmtCrypto(amount + fee, activeSymbol, 6)}</span></div>
        {insufficient && lockedMatch && lockedUntil ? (
          <p className="text-warn">
            {fmtUsd(lockedMatch.bonusUsd)} in promotional funds is locked until {lockedUntil}. You can currently withdraw up to {fmtUsd(Math.max((holding?.available ?? 0) - fee, 0))}.
          </p>
        ) : insufficient ? (
          <p className="text-destructive">Insufficient available balance.</p>
        ) : null}
      </div>

      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-secondary/50 border border-border text-[12.5px] text-muted-foreground leading-relaxed mb-4">
        <ShieldCheck className="w-4 h-4 shrink-0 mt-0.5 text-muted-foreground" />
        <p>While pending, the total is reserved from your available balance. If the request is rejected, the hold releases instantly back to your wallet.</p>
      </div>

      <Button className="w-full h-12 rounded-2xl text-[15px] font-semibold" disabled={busy || !(amount > 0) || address.length < 4 || insufficient} onClick={submit}>
        {busy ? 'Submitting…' : 'Request withdrawal'}
      </Button>
      <p className="text-center text-[11.5px] text-muted-foreground mt-3 flex items-center justify-center gap-1.5">
        <CheckCircle2 className="w-3.5 h-3.5" /> Settles through the atomic ledger once approved
      </p>
    </div>
  );
}
