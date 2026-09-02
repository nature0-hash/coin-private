'use client';

// ============================================================
// Coin Private: Admin platform settings
// Price provider (simulated / coingecko / custom URL), fees,
// limits, risk thresholds, signups & maintenance mode.
// ============================================================
import { useEffect, useState } from 'react';
import { useFetch } from '@/hooks/use-cp-data';
import { SkeletonBlock, LiveBadge } from '@/components/cp/primitives';
import { AppearanceCard } from '@/components/cp/appearance-card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Save, RadioTower } from 'lucide-react';

interface SettingsData {
  settings: Record<string, string>;
  keys: string[];
  priceHealth: { provider: string; updatedAt: number; symbols: number };
}

const NUMERIC_KEYS = [
  { key: 'trade.feePercent', label: 'Trading fee (%)', step: '0.01' },
  { key: 'trade.minOrderUsd', label: 'Min order (USD)', step: '1' },
  { key: 'trade.maxOrderUsd', label: 'Max order (USD)', step: '1000' },
  { key: 'risk.flagThresholdUsd', label: 'Trade review threshold (USD)', step: '1000' },
  { key: 'transfer.sendFeePercent', label: 'Send fee (%)', step: '0.01' },
  { key: 'withdraw.feePercent', label: 'Withdrawal fee (%)', step: '0.01' },
  { key: 'withdraw.dailyLimitUsd', label: 'Daily withdrawal limit (USD)', step: '1000' },
  { key: 'platform.welcomeBonusUsd', label: 'Welcome bonus (USD)', step: '1' },
  { key: 'promo.firstWeekMatch.windowDays', label: 'Match eligibility window (days)', step: '1' },
  { key: 'promo.firstWeekMatch.streakDays', label: 'Required trading streak (days)', step: '1' },
  { key: 'promo.firstWeekMatch.minDailyUsd', label: 'Minimum daily traded value (USD)', step: '100' },
  { key: 'promo.firstWeekMatch.matchPercent', label: 'Trading match (%)', step: '1' },
  { key: 'promo.firstWeekMatch.maxBonusUsd', label: 'Maximum match (USD)', step: '1000' },
  { key: 'price.refreshMs', label: 'Price refresh interval (ms)', step: '500' },
];

export function AdminSettingsView() {
  const { data, loading, reload } = useFetch<SettingsData>('/api/admin/settings');
  const [form, setForm] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (data) setForm(data.settings);
  }, [data]);

  async function save() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (d.error) toast.error(d.error);
      else {
        toast.success('Settings saved: applied immediately');
        reload();
      }
    } finally {
      setBusy(false);
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <SkeletonBlock className="h-8 w-56" />
        <SkeletonBlock className="h-40 w-full" />
        <SkeletonBlock className="h-64 w-full" />
      </div>
    );
  }
  if (!data) return <p className="text-muted-foreground">Failed to load settings.</p>;

  const set = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  return (
    <div className="space-y-6 max-w-[760px]">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Platform settings</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">Everything here is live: changes apply to new orders instantly.</p>
        </div>
        <Button className="rounded-full gap-2" disabled={busy} onClick={save}>
          <Save className="w-4 h-4" /> {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {/* price provider */}
      <div className="cp-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-[15.5px] font-semibold flex items-center gap-2">
            <RadioTower className="w-4.5 h-4.5 text-primary" /> Market data provider
          </h2>
          <LiveBadge provider={data.priceHealth.provider} updatedAt={data.priceHealth.updatedAt} />
        </div>
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Provider</Label>
            <Select value={form['price.provider'] ?? 'simulated'} onValueChange={(v) => set('price.provider', v)}>
              <SelectTrigger className="h-11 rounded-xl bg-secondary/60"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="simulated">Simulated (built-in random walk)</SelectItem>
                <SelectItem value="coingecko">CoinGecko (live public API)</SelectItem>
                <SelectItem value="custom">Custom endpoint</SelectItem>
              </SelectContent>
            </Select>
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              If a provider fails, the platform falls back to the simulated feed so trading never freezes silently.
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="text-[12.5px]">Custom endpoint URL</Label>
            <Input
              className="h-11 bg-secondary/60 rounded-xl nums"
              placeholder="https://your-api.example.com/prices"
              value={form['price.customUrl'] ?? ''}
              onChange={(e) => set('price.customUrl', e.target.value)}
            />
            <p className="text-[11.5px] text-muted-foreground leading-relaxed">
              Must return JSON like <code className="nums">{'{"BTC":{"usd":78901,"usd_24h_change":1.2}}'}</code>. Used when provider = custom.
            </p>
          </div>
        </div>
        <p className="text-[12px] text-muted-foreground mt-3 nums">
          Health: {data.priceHealth.symbols} symbols quoted · provider {data.priceHealth.provider}
        </p>
      </div>

      {/* console appearance */}
      <AppearanceCard />

      {/* numeric settings */}
      <div className="cp-card p-5">
        <h2 className="text-[15.5px] font-semibold mb-4">Fees, limits & risk</h2>
        <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
          {NUMERIC_KEYS.map((k) => (
            <div key={k.key} className="space-y-1.5">
              <Label htmlFor={`set-${k.key}`} className="text-[12.5px]">{k.label}</Label>
              <Input
                id={`set-${k.key}`}
                type="number"
                step={k.step}
                min="0"
                className="h-10 bg-secondary/60 rounded-xl nums"
                value={form[k.key] ?? ''}
                onChange={(e) => set(k.key, e.target.value)}
              />
            </div>
          ))}
        </div>
      </div>

      {/* toggles */}
      <div className="cp-card p-5 space-y-5">
        <h2 className="text-[15.5px] font-semibold">Platform switches</h2>
        {[
          { key: 'platform.signups', label: 'Open registrations', desc: 'Allow new customers to create accounts.' },
          { key: 'platform.maintenance', label: 'Maintenance mode', desc: 'Pauses trading. Balances and history stay available.' },
          { key: 'promo.firstWeekMatch.enabled', label: 'First-week trading match', desc: 'Enables the consecutive-day promotional match for eligible customers.' },
        ].map((t) => (
          <div key={t.key} className="flex items-center justify-between gap-4">
            <div>
              <p className="font-medium text-[14px]">{t.label}</p>
              <p className="text-[12.5px] text-muted-foreground mt-0.5">{t.desc}</p>
            </div>
            <Switch checked={(form[t.key] ?? 'false') === 'true'} onCheckedChange={(v) => set(t.key, String(v))} aria-label={t.label} />
          </div>
        ))}
        <div className="space-y-1.5">
          <Label className="text-[12.5px]">Platform name</Label>
          <Input className="h-10 bg-secondary/60 rounded-xl" value={form['platform.name'] ?? ''} onChange={(e) => set('platform.name', e.target.value)} />
        </div>
      </div>
    </div>
  );
}
