'use client';

// ============================================================
// Coin Private: Receive
// Per-asset addresses with QR, copy + share, and internal
// hints. Addresses are real wallet records from the platform.
// ============================================================
import { useState } from 'react';
import { useUI } from '@/lib/store';
import { usePortfolio } from '@/hooks/use-cp-data';
import { AssetIcon, SkeletonBlock } from '@/components/cp/primitives';
import { fmtCrypto } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'sonner';
import { ArrowLeft, Copy, Check, Info } from 'lucide-react';

export function ReceiveView() {
  const { navigate, clientParams } = useUI();
  const { portfolio, loading } = usePortfolio();
  const paramSymbol = (clientParams.symbol || 'BTC').toUpperCase();
  const [symbol, setSymbol] = useState(paramSymbol);
  const [copied, setCopied] = useState(false);

  // Sync with navigation params during render (React-endorsed pattern)
  if (clientParams.symbol && paramSymbol !== symbol) {
    setSymbol(paramSymbol);
  }

  const holdings = portfolio?.holdings ?? [];

  // Derive the effective asset during render (no effect needed):
  // if the chosen asset has no wallet yet, fall back to the first one.
  const chosen = holdings.find((h) => h.symbol === symbol);
  const effective = chosen ?? holdings[0];
  const activeSymbol = effective?.symbol ?? symbol;
  const holding = effective;

  const address = holding?.address ?? '';

  async function copy() {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success('Address copied');
      setTimeout(() => setCopied(false), 1600);
    } catch {
      toast.error('Copy failed: select the address manually');
    }
  }

  if (loading && !portfolio) {
    return (
      <div className="max-w-[520px] mx-auto space-y-4">
        <SkeletonBlock className="h-8 w-32" />
        <SkeletonBlock className="h-80 w-full" />
      </div>
    );
  }

  return (
    <div className="max-w-[520px] mx-auto">
      <button onClick={() => navigate('home')} className="inline-flex items-center gap-1.5 text-[13.5px] text-muted-foreground hover:text-foreground mb-5 transition-colors">
        <ArrowLeft className="w-4 h-4" /> Home
      </button>
      <h1 className="text-[22px] font-semibold tracking-tight">Receive</h1>
      <p className="text-[13.5px] text-muted-foreground mt-1 mb-6">Share your wallet address to receive assets on Coin Private.</p>

      {/* asset chips */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1 mb-6 -mx-1 px-1">
        {holdings.map((h) => (
          <button
            key={h.symbol}
            onClick={() => setSymbol(h.symbol)}
            className={cn(
              'flex items-center gap-2 rounded-full pl-1.5 pr-3.5 py-1.5 border transition-all shrink-0',
              symbol === h.symbol ? 'border-primary bg-primary/8' : 'border-border bg-card hover:border-border-strong'
            )}
          >
            <AssetIcon symbol={h.symbol} color={h.color} size={26} />
            <span className="text-[13px] font-medium nums">{h.symbol}</span>
          </button>
        ))}
      </div>

      {/* QR card */}
      <div className="cp-card p-6 sm:p-8 flex flex-col items-center">
        <div className="flex items-center gap-3 mb-5">
          <AssetIcon symbol={activeSymbol} color={holding?.color} size={40} />
          <div>
            <p className="font-semibold text-[15px]">{holding?.name ?? activeSymbol} address</p>
            <p className="text-[12px] text-muted-foreground nums">{fmtCrypto(holding?.available ?? 0, activeSymbol, 6)} current balance</p>
          </div>
        </div>

        {address ? (
          <>
            <div className="p-4 bg-white rounded-2xl shadow-inner">
              <QRCodeSVG value={address} size={188} level="M" marginSize={0} />
            </div>
            <p className="mt-5 text-[13px] text-muted-foreground text-center break-all nums leading-relaxed px-2">
              {address}
            </p>
            <div className="grid grid-cols-2 gap-2.5 w-full mt-5">
              <Button variant="secondary" className="h-11 rounded-xl gap-2" onClick={copy}>
                {copied ? <Check className="w-4 h-4 text-up" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied' : 'Copy'}
              </Button>
              <Button
                className="h-11 rounded-xl"
                onClick={() => {
                  if (navigator.share) {
                    navigator.share({ title: `My ${activeSymbol} address`, text: address }).catch(() => {});
                  } else {
                    copy();
                  }
                }}
              >
                Share
              </Button>
            </div>
          </>
        ) : (
          <p className="text-muted-foreground text-[13.5px] py-10">No wallet available for this asset.</p>
        )}
      </div>

      <div className="flex items-start gap-2.5 p-3.5 rounded-xl bg-secondary/50 border border-border text-[12.5px] text-muted-foreground leading-relaxed mt-4">
        <Info className="w-4 h-4 shrink-0 mt-0.5" />
        <p>
          Only send {activeSymbol} to this address. Deposits from other Coin Private members arrive instantly; external
          network deposits are credited after standard compliance review.
        </p>
      </div>
    </div>
  );
}
