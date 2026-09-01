'use client';

// ============================================================
// Coin Private: Deposit
// Bank/Card (instant demo rail, posted atomically) and crypto
// deposit request (pending admin approval: real pending state).
// ============================================================
import { useState } from 'react';
import { useUI } from '@/lib/store';
import { usePortfolio } from '@/hooks/use-cp-data';
import { Keypad } from '@/components/cp/primitives';
import { fmtUsd, fmtCrypto } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { ArrowLeft, Building2, CreditCard, Coins, CheckCircle2, Clock, Info } from 'lucide-react';

type Method = 'BANK' | 'CARD' | 'CRYPTO';

export function DepositView() {
  const { navigate } = useUI();
  const { portfolio, reload } = usePortfolio();
  const [method, setMethod] = useState<Method>('BANK');
  const [raw, setRaw] = useState('');
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ pending: boolean; message: string } | null>(null);

  const usdHolding = portfolio?.holdings.find((h) => h.symbol === 'USD');
  const amount = parseFloat(raw || '0') || 0;

  function press(k: string) {
    if (k === 'back') setRaw((r) => r.slice(0, -1));
    else if (k === '.') setRaw((r) => (r.includes('.') ? r : (r || '0') + '.'));
    else setRaw((r) => (r === '0' ? k : (r + k).slice(0, 10)));
  }

  async function submit() {
    setBusy(true);
    try {
      const res = await fetch('/api/deposits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ symbol: method === 'CRYPTO' ? 'USDC' : 'USD', amount, method }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        setDone({ pending: data.pending, message: data.message });
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
        <h2 className="text-[22px] font-semibold tracking-tight mt-5">{done.pending ? 'Deposit submitted' : 'Deposit credited'}</h2>
        <p className="text-[14px] text-muted-foreground mt-2 leading-relaxed">{done.message}</p>
        <div className="grid grid-cols-2 gap-2.5 mt-8">
          <Button variant="secondary" className="h-12 rounded-xl" onClick={() => { setDone(null); setRaw(''); }}>
            New deposit
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
      <h1 className="text-[22px] font-semibold tracking-tight">Deposit</h1>
      <p className="text-[13.5px] text-muted-foreground mt-1 mb-6">Add cash or crypto to your Coin Private wallets.</p>

      {/* method picker */}
      <div className="grid grid-cols-3 gap-2.5 mb-6">
        {[
          { key: 'BANK' as Method, icon: <Building2 className="w-5 h-5" />, label: 'Bank', sub: 'Instant rail' },
          { key: 'CARD' as Method, icon: <CreditCard className="w-5 h-5" />, label: 'Card', sub: 'Instant rail' },
          { key: 'CRYPTO' as Method, icon: <Coins className="w-5 h-5" />, label: 'Crypto', sub: 'Needs approval' },
        ].map((m) => (
          <button
            key={m.key}
            onClick={() => setMethod(m.key)}
            className={cn(
              'cp-card p-4 text-left transition-all',
              method === m.key ? 'border-primary bg-primary/5' : 'cp-card-interactive'
            )}
          >
            <span className={cn('w-9 h-9 rounded-full flex items-center justify-center mb-2.5', method === m.key ? 'bg-primary/15 text-primary' : 'bg-secondary text-muted-foreground')}>
              {m.icon}
            </span>
            <p className="font-medium text-[14px]">{m.label}</p>
            <p className="text-[11.5px] text-muted-foreground">{m.sub}</p>
          </button>
        ))}
      </div>

      {/* amount */}
      <div className="text-center py-5">
        <p className="text-[13px] text-muted-foreground mb-2">
          {method === 'CRYPTO' ? 'USDC amount' : 'USD amount'}
        </p>
        <p className={cn('text-[42px] font-semibold nums tracking-tight leading-none min-h-[48px]', !amount && 'text-muted-foreground/50')}>
          {method === 'CRYPTO' ? `${raw || '0'} USDC` : fmtUsd(amount)}
        </p>
        {method !== 'CRYPTO' && usdHolding && (
          <p className="text-[13px] text-muted-foreground nums mt-3">
            Current balance: {fmtCrypto(usdHolding.available, 'USD', 2)}
          </p>
        )}
      </div>

      <div className="cp-card p-2 mb-4">
        <Keypad onKey={press} disabled={busy} />
      </div>

      {method === 'CRYPTO' && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-warn/8 border border-warn/20 text-[12.5px] text-muted-foreground leading-relaxed mb-4">
          <Clock className="w-4 h-4 text-warn shrink-0 mt-0.5" />
          <p>Crypto deposits credit after compliance approval: usually minutes. You&apos;ll get a notification the moment it lands. This is a real pending state, not an instant fake confirmation.</p>
        </div>
      )}
      {method !== 'CRYPTO' && (
        <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-primary/8 border border-primary/20 text-[12.5px] text-muted-foreground leading-relaxed mb-4">
          <Info className="w-4 h-4 text-primary shrink-0 mt-0.5" />
          <p>Bank and card deposits use the instant demo rail and settle immediately through the atomic ledger.</p>
        </div>
      )}

      <Button className="w-full h-12 rounded-2xl text-[15px] font-semibold" disabled={busy || !(amount > 0)} onClick={submit}>
        {busy ? 'Processing…' : method === 'CRYPTO' ? 'Submit deposit request' : `Deposit ${method === 'CARD' ? 'with card' : 'from bank'}`}
      </Button>
    </div>
  );
}
