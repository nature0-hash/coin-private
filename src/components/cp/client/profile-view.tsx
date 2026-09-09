'use client';

// ============================================================
// Coin Private: Profile hub (screenshot 1 inspiration)
// Identity header + "More you can do" navigation rows.
// ============================================================
import { useUI } from '@/lib/store';
import { useAuth } from '@/lib/store';
import { usePortfolio } from '@/hooks/use-cp-data';
import { AssetIcon } from '@/components/cp/primitives';
import { fmtUsd, fmtDateTime } from '@/lib/format';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import {
  ChevronRight, Bell, ShieldCheck, Settings, LogOut, ArrowLeftRight,
  Receipt, QrCode, BadgeCheck, Clock, Copy, Sparkles,
} from 'lucide-react';

export function ProfileView() {
  const { navigate } = useUI();
  const { user, logout } = useAuth();
  const { portfolio } = usePortfolio(30000);

  const initials = (user?.name ?? 'U').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  async function copyEmail() {
    if (!user?.email) return;
    try {
      await navigator.clipboard.writeText(user.email);
      toast.success('Email copied');
    } catch {
      /* noop */
    }
  }

  const rows: Array<{ icon: React.ReactNode; label: string; desc?: string; view: 'notifications' | 'security' | 'settings' | 'activity' | 'receive' | 'trade' }> = [
    { icon: <ArrowLeftRight className="w-5 h-5" />, label: 'Trade & convert', desc: 'Buy, sell and swap assets', view: 'trade' },
    { icon: <Receipt className="w-5 h-5" />, label: 'Transactions', desc: 'Full activity and ledger entries', view: 'activity' },
    { icon: <QrCode className="w-5 h-5" />, label: 'Receive crypto', desc: 'Your wallet addresses & QR codes', view: 'receive' },
    { icon: <Bell className="w-5 h-5" />, label: 'Notifications', desc: 'Trades, deposits and security alerts', view: 'notifications' },
    { icon: <ShieldCheck className="w-5 h-5" />, label: 'Security', desc: 'Password, 2FA and device history', view: 'security' },
    { icon: <Settings className="w-5 h-5" />, label: 'Account & settings', desc: 'Profile, preferences and rewards', view: 'settings' },
  ];

  return (
    <div className="space-y-7 max-w-[640px]">
      {/* identity card */}
      <section className="flex items-center gap-4">
        <Avatar className="w-16 h-16">
          <AvatarFallback className="bg-primary/15 text-primary text-[20px] font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <h1 className="text-[21px] font-semibold tracking-tight flex items-center gap-2 truncate">
            {user?.name}
            {user?.kycStatus === 'VERIFIED' && <BadgeCheck className="w-5 h-5 text-primary shrink-0" />}
          </h1>
          <button onClick={copyEmail} className="text-[13px] text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5 mt-0.5">
            {user?.email} <Copy className="w-3 h-3 opacity-60" />
          </button>
          <p className="text-[12px] text-muted-foreground mt-1 flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Member since {user?.createdAt ? fmtDateTime(user.createdAt) : '-'}
          </p>
        </div>
        <Button variant="ghost" size="sm" className="rounded-full gap-1.5 text-[13px] text-muted-foreground hover:text-destructive" onClick={logout}>
          <LogOut className="w-4 h-4" /> Sign out
        </Button>
      </section>

      {/* tier card */}
      <section className="cp-card p-5 relative overflow-hidden">
        <div className="absolute inset-0 opacity-40 pointer-events-none" style={{ background: 'radial-gradient(70% 90% at 85% 10%, rgba(55,115,245,0.18) 0%, transparent 60%)' }} />
        <div className="relative flex items-center justify-between gap-4">
          <div>
            <p className="micro-label flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-primary" /> Private tier
            </p>
            <p className="text-[19px] font-semibold tracking-tight mt-2">
              {portfolio ? fmtUsd(portfolio.totalUsd, { compact: true }) : '-'} total portfolio value
            </p>
            <p className="text-[12.5px] text-muted-foreground mt-1">
              KYC {user?.kycStatus === 'VERIFIED' ? 'verified' : 'pending'} · Tier {user?.kycTier ?? 1} · {portfolio?.holdings.length ?? 0} wallets
            </p>
          </div>
          <div className="hidden sm:flex gap-1.5">
            {portfolio?.holdings.slice(0, 4).map((h) => (
              <AssetIcon key={h.symbol} symbol={h.symbol} color={h.color} size={34} />
            ))}
          </div>
        </div>
      </section>

      {/* rows */}
      <section>
        <p className="micro-label mb-3">More you can do</p>
        <div className="cp-card divide-y divide-border overflow-hidden">
          {rows.map((r) => (
            <button key={r.label} onClick={() => navigate(r.view)} className="w-full flex items-center gap-4 px-4 md:px-5 py-4 hover:bg-hover transition-colors text-left">
              <span className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center text-foreground/80 shrink-0">{r.icon}</span>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-[14.5px]">{r.label}</p>
                {r.desc && <p className="text-[12.5px] text-muted-foreground truncate">{r.desc}</p>}
              </div>
              <ChevronRight className="w-4 h-4 text-muted-foreground/60" />
            </button>
          ))}
        </div>
      </section>

      <Button variant="outline" className="w-full h-12 rounded-2xl text-[14px] font-medium text-destructive border-destructive/25 hover:bg-destructive/10 hover:text-destructive" onClick={logout}>
        <LogOut className="w-4.5 h-4.5 mr-2" /> Sign out of this session
      </Button>
    </div>
  );
}
