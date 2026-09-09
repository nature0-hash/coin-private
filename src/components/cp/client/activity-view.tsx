'use client';

// ============================================================
// Coin Private: Activity feed
// Unified history: orders, transfers, deposits, withdrawals,
// ledger entries. Filters + detail dialog with ledger entries.
// Customers may hide selected rows from their own view; the
// underlying financial records remain intact internally.
// ============================================================
import { useMemo, useState } from 'react';
import { useFetch } from '@/hooks/use-cp-data';
import { SegmentedTabs, SkeletonBlock, StatusPill, EmptyState } from '@/components/cp/primitives';
import { fmtDateTime, fmtUsd, fmtCrypto, maskAddress } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Activity, ArrowDownToLine, ArrowUpFromLine, ArrowLeftRight, Send, Receipt, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';

interface ActivityItem {
  id: string;
  kind: 'ORDER' | 'TRANSFER' | 'DEPOSIT' | 'WITHDRAWAL' | 'LEDGER';
  reference: string;
  title: string;
  subtitle: string;
  amount: number;
  symbol: string;
  status: string;
  type: string;
  createdAt: string;
  meta?: { fee?: number; txHash?: string; memo?: string; fundingSource?: string; entries?: Array<{ direction: string; amount: number; symbol: string; before: number; after: number }>; corrections?: Array<{ note: string; reason: string; at: string }> };
}

const FILTERS = [
  { value: 'all', label: 'All' },
  { value: 'trades', label: 'Trades' },
  { value: 'transfers', label: 'Transfers' },
  { value: 'deposits', label: 'Deposits' },
  { value: 'withdrawals', label: 'Withdrawals' },
  { value: 'ledger', label: 'Ledger' },
];

const KIND_ICON: Record<string, React.ReactNode> = {
  ORDER: <ArrowLeftRight className="w-4.5 h-4.5" />,
  TRANSFER: <Send className="w-4.5 h-4.5" />,
  DEPOSIT: <ArrowDownToLine className="w-4.5 h-4.5" />,
  WITHDRAWAL: <ArrowUpFromLine className="w-4.5 h-4.5" />,
  LEDGER: <Receipt className="w-4.5 h-4.5" />,
};

export function ActivityView() {
  const [filter, setFilter] = useState('all');
  const { data, loading, reload } = useFetch<{ items: ActivityItem[] }>(`/api/activity?filter=${filter}`, [filter]);
  const [selected, setSelected] = useState<ActivityItem | null>(null);
  const [selectMode, setSelectMode] = useState(false);
  const [checked, setChecked] = useState<Set<string>>(new Set());
  const [deleting, setDeleting] = useState(false);

  const checkedCount = checked.size;
  const allVisibleSelected = useMemo(() => !!data?.items.length && data.items.every((item) => checked.has(item.id)), [data?.items, checked]);

  function leaveSelectMode() {
    setSelectMode(false);
    setChecked(new Set());
  }

  function toggleChecked(id: string) {
    setChecked((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAllVisible() {
    if (!data?.items.length) return;
    if (allVisibleSelected) {
      setChecked(new Set());
      return;
    }
    setChecked(new Set(data.items.map((item) => item.id)));
  }

  async function deleteSelected() {
    if (!checkedCount) return;
    setDeleting(true);
    try {
      const res = await fetch('/api/activity', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(checked) }),
      });
      const body = await res.json();
      if (!res.ok || body.error) {
        toast.error(body.error ?? 'Could not update activity');
        return;
      }
      toast.success(`${checkedCount} ${checkedCount === 1 ? 'item' : 'items'} removed from Activity`);
      leaveSelectMode();
      reload();
    } catch {
      toast.error('Network error');
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="space-y-5 max-w-[760px]">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Activity</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">Your complete account activity in one place.</p>
        </div>
        {!!data?.items.length && (
          <div className="flex items-center gap-2 shrink-0">
            {selectMode ? (
              <>
                <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-[12.5px]" onClick={leaveSelectMode} disabled={deleting}>
                  <X className="w-4 h-4" /> Cancel
                </Button>
                <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-[12.5px] text-destructive hover:text-destructive hover:bg-destructive/10" onClick={deleteSelected} disabled={!checkedCount || deleting}>
                  <Trash2 className="w-4 h-4" /> {deleting ? 'Deleting…' : `Delete${checkedCount ? ` (${checkedCount})` : ''}`}
                </Button>
              </>
            ) : (
              <Button variant="ghost" size="sm" className="rounded-full text-[12.5px]" onClick={() => setSelectMode(true)}>
                Select
              </Button>
            )}
          </div>
        )}
      </div>

      <div className="overflow-x-auto no-scrollbar -mx-1 px-1">
        <SegmentedTabs items={FILTERS} value={filter} onChange={(value) => { setFilter(value); setChecked(new Set()); }} />
      </div>

      {selectMode && !!data?.items.length && (
        <div className="flex items-center gap-2 px-1 text-[12.5px] text-muted-foreground">
          <Checkbox checked={allVisibleSelected} onCheckedChange={toggleAllVisible} aria-label="Select all visible activity" />
          <button type="button" className="hover:text-foreground transition-colors" onClick={toggleAllVisible}>
            {allVisibleSelected ? 'Deselect all' : 'Select all visible'}
          </button>
        </div>
      )}

      {loading && !data ? (
        <div className="cp-card p-4 space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <SkeletonBlock key={i} className="h-12" />)}
        </div>
      ) : !data?.items.length ? (
        <div className="cp-card">
          <EmptyState
            icon={<Activity className="w-5 h-5" />}
            title="No activity yet"
            body="Your trades, deposits, sends and ledger entries will appear here."
          />
        </div>
      ) : (
        <div className="cp-card divide-y divide-border overflow-hidden">
          {data.items.map((item) => {
            const isChecked = checked.has(item.id);
            return (
              <div
                key={item.id}
                role="button"
                tabIndex={0}
                onClick={() => selectMode ? toggleChecked(item.id) : setSelected(item)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    if (selectMode) toggleChecked(item.id); else setSelected(item);
                  }
                }}
                className={cn(
                  'w-full flex items-center gap-4 px-4 md:px-5 py-4 hover:bg-hover transition-colors text-left cursor-pointer',
                  selectMode && isChecked && 'bg-primary/[0.045]'
                )}
              >
                {selectMode && (
                  <Checkbox
                    checked={isChecked}
                    onCheckedChange={() => toggleChecked(item.id)}
                    onClick={(event) => event.stopPropagation()}
                    aria-label={`Select ${item.title}`}
                    className="shrink-0"
                  />
                )}
                <span
                  className={cn(
                    'w-10 h-10 rounded-full flex items-center justify-center shrink-0',
                    item.kind === 'DEPOSIT' && 'bg-up/12 text-up',
                    item.kind === 'WITHDRAWAL' && 'bg-warn/12 text-warn',
                    item.kind === 'TRANSFER' && 'bg-[#3773f5]/12 text-[#3773f5]',
                    item.kind === 'ORDER' && 'bg-[#9945ff]/12 text-[#9945ff]',
                    item.kind === 'LEDGER' && 'bg-secondary text-muted-foreground'
                  )}
                >
                  {KIND_ICON[item.kind]}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-[14.5px] truncate">{item.title}</p>
                    {(item.status !== 'COMPLETED' && item.status !== 'EXECUTED' && item.status !== 'POSTED') && (
                      <StatusPill status={item.status} />
                    )}
                  </div>
                  <p className="text-[12.5px] text-muted-foreground truncate nums">{item.subtitle}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-medium text-[14px] nums">
                    {item.kind === 'DEPOSIT' ? '+' : item.kind === 'WITHDRAWAL' ? '-' : item.type === 'BUY' ? '+' : item.type === 'SELL' ? '+' : ''}
                    {fmtCrypto(item.amount, item.symbol, 6)}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground">{fmtDateTime(item.createdAt)}</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* detail dialog */}
      <Dialog open={selected !== null} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-[440px]">
          {selected && (
            <>
              <DialogHeader>
                <DialogTitle className="flex items-center gap-3">
                  {selected.title}
                  <StatusPill status={selected.status} />
                </DialogTitle>
                <DialogDescription>{selected.subtitle}</DialogDescription>
              </DialogHeader>
              <div className="space-y-1 mt-1">
                <Row label="Reference" value={selected.reference} />
                <Row label="Date" value={fmtDateTime(selected.createdAt)} />
                <Row label="Amount" value={fmtCrypto(selected.amount, selected.symbol, 8)} />
                {selected.meta?.fee ? <Row label="Fee" value={fmtUsd(selected.meta.fee)} /> : null}
                {selected.meta?.txHash && <Row label="Transaction hash" value={maskAddress(selected.meta.txHash)} />}
                {selected.meta?.memo && <Row label="Memo" value={selected.meta.memo} />}
                {selected.meta?.fundingSource && <Row label="Source" value={selected.meta.fundingSource} />}
              </div>
              {selected.meta?.entries && selected.meta.entries.length > 0 && (
                <div className="mt-3">
                  <p className="micro-label mb-2">Ledger entries</p>
                  <div className="cp-card divide-y divide-border overflow-hidden">
                    {selected.meta.entries.map((e, i) => (
                      <div key={i} className="flex items-center justify-between px-3.5 py-2.5 text-[12.5px]">
                        <span className={cn('font-semibold', e.direction === 'DEBIT' ? 'text-destructive' : 'text-up')}>
                          {e.direction === 'DEBIT' ? '−' : '+'} {fmtCrypto(e.amount, e.symbol, 8)}
                        </span>
                        <span className="text-muted-foreground nums">
                          {fmtCrypto(e.before, e.symbol, 4)} → {fmtCrypto(e.after, e.symbol, 4)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {selected.meta?.corrections && selected.meta.corrections.length > 0 && (
                <div className="mt-3">
                  <p className="micro-label mb-2">Correction notes</p>
                  <div className="space-y-2">
                    {selected.meta.corrections.map((correction, i) => (
                      <div key={`${correction.at}-${i}`} className="rounded-xl border border-primary/15 bg-primary/5 p-3 text-[12px]">
                        <p className="font-medium">{correction.note}</p>
                        <p className="text-muted-foreground mt-1">Reason: {correction.reason} · {fmtDateTime(correction.at)}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <span className="text-[13px] text-muted-foreground">{label}</span>
      <span className="text-[13px] font-medium nums text-right">{value}</span>
    </div>
  );
}
