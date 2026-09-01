'use client';

// ============================================================
// Coin Private: Admin promotions
// Create fee-discount / bonus-credit promos, toggle activation.
// ============================================================
import { useState } from 'react';
import { useFetch } from '@/hooks/use-cp-data';
import { SkeletonBlock, EmptyState, StatusPill } from '@/components/cp/primitives';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Plus, Megaphone, Ticket } from 'lucide-react';

interface PromoRow {
  id: string; code: string; title: string; kind: string; value: number;
  bonusSymbol: string | null; active: boolean; startsAt: string; endsAt: string | null;
  maxRedemptions: number; usedCount: number; redemptions: number;
}

export function AdminPromotionsView() {
  const { data, loading, reload } = useFetch<{ promos: PromoRow[] }>('/api/admin/promos');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ code: '', title: '', kind: 'FEE_DISCOUNT', value: '', bonusSymbol: 'USDC', maxRedemptions: '0' });

  async function create() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/promos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          code: form.code, title: form.title, kind: form.kind, value: parseFloat(form.value),
          bonusSymbol: form.bonusSymbol, maxRedemptions: parseInt(form.maxRedemptions || '0', 10),
        }),
      });
      const d = await res.json();
      if (d.error) toast.error(d.error);
      else {
        toast.success(`Promotion ${form.code} created`);
        setOpen(false);
        setForm({ code: '', title: '', kind: 'FEE_DISCOUNT', value: '', bonusSymbol: 'USDC', maxRedemptions: '0' });
        reload();
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggle(p: PromoRow) {
    const res = await fetch('/api/admin/promos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: p.id, active: !p.active }),
    });
    const d = await res.json();
    if (d.error) toast.error(d.error);
    else {
      toast.success(`${p.code} ${!p.active ? 'activated' : 'deactivated'}`);
      reload();
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Promotions</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">Members redeem codes in Settings → Rewards. Fee discounts apply automatically at order time.</p>
        </div>
        <Button className="rounded-full gap-2" onClick={() => setOpen(true)}>
          <Plus className="w-4 h-4" /> New promotion
        </Button>
      </div>

      {loading && !data ? (
        <div className="cp-card p-4 space-y-3">{[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-16" />)}</div>
      ) : !data?.promos.length ? (
        <div className="cp-card"><EmptyState icon={<Megaphone className="w-5 h-5" />} title="No promotions yet" body="Create a fee discount or bonus credit code to drive activity." /></div>
      ) : (
        <div className="grid md:grid-cols-2 gap-3">
          {data.promos.map((p) => (
            <div key={p.id} className={cn('cp-card p-5', !p.active && 'opacity-70')}>
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <span className={cn('w-10 h-10 rounded-full flex items-center justify-center shrink-0', p.kind === 'FEE_DISCOUNT' ? 'bg-primary/12 text-primary' : 'bg-up/12 text-up')}>
                    <Ticket className="w-4.5 h-4.5" />
                  </span>
                  <div className="min-w-0">
                    <p className="font-semibold nums text-[14.5px]">{p.code}</p>
                    <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-snug">{p.title}</p>
                  </div>
                </div>
                <Switch checked={p.active} onCheckedChange={() => toggle(p)} aria-label={`Toggle ${p.code}`} />
              </div>
              <div className="flex items-center justify-between mt-4 pt-3 border-t border-border text-[12px] text-muted-foreground nums">
                <span>
                  {p.kind === 'FEE_DISCOUNT' ? `${p.value}% off fees` : `${p.value} ${p.bonusSymbol} bonus`}
                </span>
                <span>
                  {p.redemptions}/{p.maxRedemptions > 0 ? p.maxRedemptions : '∞'} redeemed
                </span>
                <StatusPill status={p.active ? 'ACTIVE' : 'DELISTED'} />
              </div>
              <p className="text-[10.5px] text-muted-foreground/70 mt-2 nums">
                Created {fmtDateTime(p.startsAt)}{p.endsAt ? ` · ends ${fmtDateTime(p.endsAt)}` : ''}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[400px]">
          <DialogHeader>
            <DialogTitle>New promotion</DialogTitle>
            <DialogDescription>Fee discounts stack with nothing else: the best discount applies automatically.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 mt-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Code</Label>
                <Input className="h-10 bg-secondary/60 rounded-xl uppercase nums" placeholder="SUMMER25" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Kind</Label>
                <Select value={form.kind} onValueChange={(v) => setForm({ ...form, kind: v })}>
                  <SelectTrigger className="h-10 rounded-xl bg-secondary/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="FEE_DISCOUNT">Fee discount</SelectItem>
                    <SelectItem value="BONUS_CREDIT">Bonus credit</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Title</Label>
              <Input className="h-10 bg-secondary/60 rounded-xl" placeholder="25% off trading fees in June" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">{form.kind === 'FEE_DISCOUNT' ? 'Discount (%)' : 'Bonus amount'}</Label>
                <Input className="h-10 bg-secondary/60 rounded-xl nums" type="number" min="0" step="any" value={form.value} onChange={(e) => setForm({ ...form, value: e.target.value })} />
              </div>
              {form.kind === 'BONUS_CREDIT' ? (
                <div className="space-y-1.5">
                  <Label className="text-[12.5px]">Bonus asset</Label>
                  <Input className="h-10 bg-secondary/60 rounded-xl uppercase nums" value={form.bonusSymbol} onChange={(e) => setForm({ ...form, bonusSymbol: e.target.value.toUpperCase() })} />
                </div>
              ) : (
                <div className="space-y-1.5">
                  <Label className="text-[12.5px]">Max redemptions</Label>
                  <Input className="h-10 bg-secondary/60 rounded-xl nums" type="number" min="0" value={form.maxRedemptions} onChange={(e) => setForm({ ...form, maxRedemptions: e.target.value })} />
                </div>
              )}
            </div>
            <Button className="w-full h-10 rounded-xl font-semibold" disabled={busy || form.code.length < 3 || form.title.length < 3 || !(parseFloat(form.value) > 0)} onClick={create}>
              {busy ? 'Creating…' : 'Create promotion'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
