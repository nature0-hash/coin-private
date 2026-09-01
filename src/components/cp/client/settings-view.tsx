'use client';

// ============================================================
// Coin Private: Settings & Rewards
// Profile fields, preferences, promotion code redemption.
// ============================================================
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/store';
import { useFetch } from '@/hooks/use-cp-data';
import { SkeletonBlock, StatusPill } from '@/components/cp/primitives';
import { AppearanceCard } from '@/components/cp/appearance-card';
import { fmtDateTime } from '@/lib/format';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Gift, User as UserIcon, Globe, TicketCheck } from 'lucide-react';

interface Redeemed {
  code: string;
  title: string;
  kind: string;
  value: number;
  bonusSymbol: string | null;
  redeemedAt: string;
}

export function SettingsView() {
  const { user, setUser } = useAuth();
  const { data: promoData, reload: reloadPromos } = useFetch<{ redemptions: Redeemed[] }>('/api/promo');

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [address, setAddress] = useState('');
  const [country, setCountry] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [hideBalances, setHideBalances] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name ?? '');
      setPhone(user.phone ?? '');
      setAddress(user.address ?? '');
      setCountry(user.country ?? '');
    }
  }, [user]);

  async function saveProfile() {
    setBusy(true);
    try {
      const res = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, phone, address, country }),
      });
      const d = await res.json();
      if (d.error) toast.error(d.error);
      else {
        setUser(d.user);
        toast.success('Profile updated');
      }
    } catch {
      toast.error('Network error');
    } finally {
      setBusy(false);
    }
  }

  async function redeem() {
    setBusy(true);
    try {
      const res = await fetch('/api/promo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      });
      const d = await res.json();
      if (d.error) toast.error(d.error);
      else {
        toast.success(d.message, { description: `${d.promo?.title ?? ''}` });
        setCode('');
        reloadPromos();
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
        <h1 className="text-[22px] font-semibold tracking-tight">Settings</h1>
        <p className="text-[13.5px] text-muted-foreground mt-1">Manage your profile, preferences and rewards.</p>
      </div>

      {/* profile */}
      <div className="cp-card p-5">
        <div className="flex items-start gap-3.5 mb-5">
          <span className="w-10 h-10 rounded-full bg-primary/12 text-primary flex items-center justify-center shrink-0">
            <UserIcon className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <p className="font-medium text-[14.5px]">Profile</p>
            <p className="text-[12.5px] text-muted-foreground">{user?.email}</p>
          </div>
          <StatusPill status={user?.kycStatus === 'VERIFIED' ? 'APPROVED' : 'PENDING'} />
        </div>
        <div className="grid sm:grid-cols-2 gap-3.5">
          <div className="space-y-1.5">
            <Label htmlFor="s-name" className="text-[12.5px]">Full name</Label>
            <Input id="s-name" className="h-11 bg-secondary/60 rounded-xl" value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="s-phone" className="text-[12.5px]">Phone</Label>
            <Input id="s-phone" className="h-11 bg-secondary/60 rounded-xl" placeholder="+1 …" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="s-addr" className="text-[12.5px]">Address</Label>
            <Input id="s-addr" className="h-11 bg-secondary/60 rounded-xl" placeholder="Street, city, state" value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <Label htmlFor="s-country" className="text-[12.5px]">Country</Label>
            <Input id="s-country" className="h-11 bg-secondary/60 rounded-xl" placeholder="United States" value={country} onChange={(e) => setCountry(e.target.value)} />
          </div>
        </div>
        <Button className="mt-4 h-11 rounded-xl font-semibold px-6" disabled={busy || name.trim().length < 2} onClick={saveProfile}>
          {busy ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      {/* appearance */}
      <AppearanceCard />

      {/* rewards */}
      <div className="cp-card p-5">
        <div className="flex items-start gap-3.5 mb-4">
          <span className="w-10 h-10 rounded-full bg-warn/12 text-warn flex items-center justify-center shrink-0">
            <Gift className="w-5 h-5" />
          </span>
          <div>
            <p className="font-medium text-[14.5px]">Rewards & promotions</p>
            <p className="text-[12.5px] text-muted-foreground mt-0.5">Redeem a code for fee discounts or bonus credits.</p>
          </div>
        </div>
        <div className="flex gap-2.5 max-w-[420px]">
          <Input
            className="h-11 bg-secondary/60 rounded-xl uppercase tracking-wider nums placeholder:normal-case placeholder:tracking-normal"
            placeholder="Enter code (try WELCOME50)"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            maxLength={20}
          />
          <Button className="h-11 rounded-xl font-semibold px-5 shrink-0" disabled={busy || code.length < 3} onClick={redeem}>
            Redeem
          </Button>
        </div>

        {promoData?.redemptions.length ? (
          <div className="mt-4 space-y-2">
            <p className="micro-label">Your rewards</p>
            {promoData.redemptions.map((r) => (
              <div key={r.code} className="flex items-center gap-3 p-3 rounded-xl bg-secondary/50 border border-border">
                <span className="w-9 h-9 rounded-full bg-up/12 text-up flex items-center justify-center shrink-0">
                  <TicketCheck className="w-4.5 h-4.5" />
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-[13.5px] font-medium truncate">{r.title}</p>
                  <p className="text-[11.5px] text-muted-foreground nums">
                    {r.code} · {r.kind === 'FEE_DISCOUNT' ? `${r.value}% fee discount` : `${r.value} ${r.bonusSymbol} bonus`} · {fmtDateTime(r.redeemedAt)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        ) : (
          !promoData && <SkeletonBlock className="h-12 mt-4" />
        )}
      </div>

      {/* preferences */}
      <div className="cp-card p-5">
        <div className="flex items-start gap-3.5">
          <span className="w-10 h-10 rounded-full bg-secondary text-muted-foreground flex items-center justify-center shrink-0">
            <Globe className="w-5 h-5" />
          </span>
          <div className="flex-1">
            <p className="font-medium text-[14.5px]">Privacy on shared screens</p>
            <p className="text-[12.5px] text-muted-foreground mt-0.5 leading-relaxed">Blur your balance on the home screen by default.</p>
          </div>
          <Switch checked={hideBalances} onCheckedChange={setHideBalances} aria-label="Hide balances preference" />
        </div>
        <p className="text-[11.5px] text-muted-foreground mt-3 pl-[56px]">
          Preference stored on this device. Use the eye toggle on Home anytime.
        </p>
      </div>

      <p className="text-[11.5px] text-muted-foreground/70 text-center pb-2">
        Coin Private · Member since {user?.createdAt ? fmtDateTime(user.createdAt) : '-'}
      </p>
    </div>
  );
}
