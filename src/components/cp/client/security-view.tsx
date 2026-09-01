'use client';

// ============================================================
// Coin Private: Security center
// Password change, two-factor toggle, login history.
// ============================================================
import { useState } from 'react';
import { useAuth } from '@/lib/store';
import { useFetch } from '@/hooks/use-cp-data';
import { SkeletonBlock, StatusPill } from '@/components/cp/primitives';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { KeyRound, ShieldCheck, Lock } from 'lucide-react';

interface SecurityEventRow {
  id: string;
  type: string;
  ip: string | null;
  userAgent: string | null;
  detail: string | null;
  createdAt: string;
}

export function SecurityView() {
  const { user } = useAuth();
  const { data, loading, reload } = useFetch<{ events: SecurityEventRow[] }>('/api/security');

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);

  async function changePassword() {
    if (next !== confirm) {
      toast.error('New passwords do not match');
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/security', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'change_password', currentPassword: current, newPassword: next }),
      });
      const d = await res.json();
      if (d.error) toast.error(d.error);
      else {
        toast.success('Password updated');
        setCurrent(''); setNext(''); setConfirm('');
        reload();
      }
    } catch {
      toast.error('Network error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6 max-w-[640px]">
      <div>
        <h1 className="text-[22px] font-semibold tracking-tight">Security</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1">Harden your account: every change is audited.</p>
      </div>

      {/* password */}
      <div className="cp-card p-5">
        <div className="flex items-start gap-3.5 mb-5">
          <span className="w-10 h-10 rounded-full bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <KeyRound className="w-5 h-5" />
          </span>
          <div>
            <p className="font-medium text-[14.5px]">Password</p>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">Use at least 8 characters with a mix you haven&apos;t used elsewhere.</p>
          </div>
        </div>
        <div className="space-y-3.5 max-w-[380px]">
          <div className="space-y-1.5">
            <Label htmlFor="cur-pass" className="text-[12.5px]">Current password</Label>
            <Input id="cur-pass" type="password" className="h-11 bg-secondary/60 rounded-xl" value={current} onChange={(e) => setCurrent(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="new-pass" className="text-[12.5px]">New password</Label>
            <Input id="new-pass" type="password" className="h-11 bg-secondary/60 rounded-xl" value={next} onChange={(e) => setNext(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="conf-pass" className="text-[12.5px]">Confirm new password</Label>
            <Input id="conf-pass" type="password" className="h-11 bg-secondary/60 rounded-xl" value={confirm} onChange={(e) => setConfirm(e.target.value)} />
          </div>
          <Button className="w-full h-11 rounded-xl font-semibold" disabled={busy || !current || next.length < 8 || next !== confirm} onClick={changePassword}>
            {busy ? 'Updating…' : 'Update password'}
          </Button>
        </div>
      </div>

      {/* tips */}
      <div className="cp-card p-5 flex items-start gap-3.5">
        <span className="w-10 h-10 rounded-full bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
          <Lock className="w-5 h-5" />
        </span>
        <div>
          <p className="font-medium text-[14.5px]">Sessions are per-tab</p>
          <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed">
            Coin Private uses scoped tab sessions: closing this tab ends only this session, and other tabs stay
            independent. Sign-out events are recorded in the audit trail.
          </p>
        </div>
      </div>

      {/* history */}
      <div>
        <h2 className="text-[16px] font-semibold tracking-tight mb-3">Recent security events</h2>
        {loading && !data ? (
          <div className="cp-card p-4 space-y-3">{[1, 2, 3].map((i) => <SkeletonBlock key={i} className="h-10" />)}</div>
        ) : !data?.events.length ? (
          <div className="cp-card p-8 text-center text-[13px] text-muted-foreground">No events recorded yet.</div>
        ) : (
          <div className="cp-card divide-y divide-border overflow-hidden">
            {data.events.map((e) => (
              <div key={e.id} className="flex items-center gap-3.5 px-4 md:px-5 py-3.5">
                <span className={cn(
                  'w-2 h-2 rounded-full shrink-0',
                  e.type === 'LOGIN' && 'bg-up',
                  e.type === 'LOGIN_FAILED' && 'bg-destructive',
                  e.type === 'PASSWORD_CHANGED' && 'bg-warn',
                  e.type === '2FA_TOGGLED' && 'bg-primary'
                )} />
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium">
                    {e.type === 'LOGIN' ? 'Sign-in' : e.type === 'LOGIN_FAILED' ? 'Failed sign-in' : e.type === 'PASSWORD_CHANGED' ? 'Password changed' : e.type === '2FA_TOGGLED' ? 'Two-factor changed' : e.type}
                  </p>
                  <p className="text-[11.5px] text-muted-foreground nums truncate">
                    {e.ip ?? 'unknown ip'} · {e.userAgent ? e.userAgent.slice(0, 42) : 'unknown device'}
                  </p>
                </div>
                <span className="text-[11.5px] text-muted-foreground shrink-0">{fmtDateTime(e.createdAt)}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center gap-2 text-[12px] text-muted-foreground pb-2">
        <ShieldCheck className="w-4 h-4" /> Your security status:
        <StatusPill status="ACTIVE" className="ml-1" />
      </div>
    </div>
  );
}
