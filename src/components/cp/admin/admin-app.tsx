'use client';

// ============================================================
// Coin Private: Admin console shell
// Desktop sidebar + mobile topbar/drawer. Console-style density.
// ============================================================
import { useEffect, useState } from 'react';
import { useUI, AdminView } from '@/lib/store';
import { useAuth } from '@/lib/store';
import { CoinPrivateLogo } from '@/components/cp/primitives';
import { cn } from '@/lib/utils';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import {
  LayoutDashboard, Users, Wallet, Coins, Receipt, ClipboardCheck,
  Megaphone, ShieldAlert, ScrollText, Settings, LogOut, Menu, Bell,
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useFetch } from '@/hooks/use-cp-data';

import { AdminOverviewView } from '@/components/cp/admin/overview-view';
import { AdminUsersView } from '@/components/cp/admin/users-view';
import { AdminUserDetailView } from '@/components/cp/admin/user-detail-view';
import { AdminWalletsView } from '@/components/cp/admin/wallets-view';
import { AdminAssetsView } from '@/components/cp/admin/assets-view';
import { AdminTransactionsView } from '@/components/cp/admin/transactions-view';
import { AdminApprovalsView } from '@/components/cp/admin/approvals-view';
import { AdminPromotionsView } from '@/components/cp/admin/promotions-view';
import { AdminRiskView } from '@/components/cp/admin/risk-view';
import { AdminAuditView } from '@/components/cp/admin/audit-view';
import { AdminSettingsView } from '@/components/cp/admin/settings-view';
import { AdminNotificationsView } from '@/components/cp/admin/notifications-view';

const NAV: Array<{ view: AdminView; label: string; icon: React.ReactNode; group: string }> = [
  { view: 'overview', label: 'Overview', icon: <LayoutDashboard className="w-[19px] h-[19px]" />, group: 'Platform' },
  { view: 'users', label: 'Users', icon: <Users className="w-[19px] h-[19px]" />, group: 'Customers' },
  { view: 'wallets', label: 'Wallets', icon: <Wallet className="w-[19px] h-[19px]" />, group: 'Customers' },
  { view: 'approvals', label: 'Approvals', icon: <ClipboardCheck className="w-[19px] h-[19px]" />, group: 'Operations' },
  { view: 'transactions', label: 'Transactions', icon: <Receipt className="w-[19px] h-[19px]" />, group: 'Operations' },
  { view: 'assets', label: 'Assets', icon: <Coins className="w-[19px] h-[19px]" />, group: 'Operations' },
  { view: 'promotions', label: 'Promotions', icon: <Megaphone className="w-[19px] h-[19px]" />, group: 'Growth' },
  { view: 'risk', label: 'Risk tools', icon: <ShieldAlert className="w-[19px] h-[19px]" />, group: 'Growth' },
  { view: 'audit', label: 'Audit log', icon: <ScrollText className="w-[19px] h-[19px]" />, group: 'Platform' },
  { view: 'settings-admin', label: 'Platform settings', icon: <Settings className="w-[19px] h-[19px]" />, group: 'Platform' },
];

const MOBILE_NAV = NAV;

export function AdminApp() {
  const { adminView, adminNavigate, sidebarOpen, setSidebarOpen } = useUI();
  const { user, logout } = useAuth();
  const [badgeTick, setBadgeTick] = useState(0);
  const { data: notifData } = useFetch<{ unread: number }>('/api/notifications', [badgeTick]);
  const pendingApprovals = useFetch<{ approvals: unknown[] }>('/api/admin/approvals?status=PENDING', [badgeTick]);

  // keep queue/unread badges fresh
  useEffect(() => {
    const t = setInterval(() => setBadgeTick((n) => n + 1), 20000);
    return () => clearInterval(t);
  }, []);

  const unread = notifData?.unread ?? 0;
  const initials = (user?.name ?? 'A').split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  const body = (() => {
    switch (adminView) {
      case 'overview': return <AdminOverviewView />;
      case 'users': return <AdminUsersView />;
      case 'user-detail': return <AdminUserDetailView />;
      case 'wallets': return <AdminWalletsView />;
      case 'assets': return <AdminAssetsView />;
      case 'transactions': return <AdminTransactionsView />;
      case 'approvals': return <AdminApprovalsView />;
      case 'promotions': return <AdminPromotionsView />;
      case 'risk': return <AdminRiskView />;
      case 'audit': return <AdminAuditView />;
      case 'settings-admin': return <AdminSettingsView />;
      case 'notifications': return <AdminNotificationsView />;
      default: return <AdminOverviewView />;
    }
  })();

  const groups = ['Platform', 'Customers', 'Operations', 'Growth'];

  const navList = (mobile = false) => (
    <div className="px-3 space-y-4">
      {groups.map((g) => (
        <div key={g}>
          <p className="micro-label px-3 mb-1.5">{g}</p>
          <div className="space-y-0.5">
            {NAV.filter((n) => n.group === g).map((n) => (
              <button
                key={n.view}
                onClick={() => adminNavigate(n.view)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors',
                  adminView === n.view || (n.view === 'users' && adminView === 'user-detail')
                    ? 'bg-sidebar-accent text-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60'
                )}
              >
                <span className={cn(adminView === n.view && 'text-primary')}>{n.icon}</span>
                {n.label}
                {n.view === 'approvals' && (pendingApprovals.data?.approvals.length ?? 0) > 0 && (
                  <span className="ml-auto bg-primary text-primary-foreground text-[10px] font-bold px-1.5 py-0.5 rounded-full nums">
                    {pendingApprovals.data!.approvals.length}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
      ))}
      {mobile && (
        <button
          onClick={() => adminNavigate('notifications')}
          className={cn(
            'w-full flex items-center gap-3 px-3 py-2 rounded-lg text-[13.5px] font-medium transition-colors',
            adminView === 'notifications' ? 'bg-sidebar-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <Bell className="w-[19px] h-[19px]" /> Notifications
          {unread > 0 && <span className="ml-auto bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full nums">{unread}</span>}
        </button>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* sidebar */}
      <aside className="fixed left-0 top-0 bottom-0 z-40 w-[228px] bg-sidebar border-r border-sidebar-border hidden lg:flex flex-col">
        <div className="p-5 pb-5">
          <div className="flex items-center justify-between">
            <CoinPrivateLogo size={26} />
            <span className="text-[10px] font-bold tracking-widest text-primary bg-primary/10 rounded px-1.5 py-0.5 uppercase">Management</span>
          </div>
        </div>
        <div className="flex-1 overflow-y-auto pb-4">{navList()}</div>
        <div className="p-3 border-t border-sidebar-border">
          <div className="flex items-center gap-3 px-2 py-1.5">
            <Avatar className="w-8 h-8">
              <AvatarFallback className="bg-primary/15 text-primary text-[11px] font-semibold">{initials}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="text-[12.5px] font-medium truncate">{user?.name}</p>
              <p className="text-[10.5px] text-muted-foreground truncate">{user?.email}</p>
            </div>
            <button onClick={logout} className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors" aria-label="Sign out">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* main */}
      <div className="lg:pl-[228px] pb-16 lg:pb-8 min-h-screen flex flex-col">
        <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border/60">
          <div className="flex items-center gap-3 px-4 md:px-7 h-14">
            <button className="lg:hidden p-2 -ml-2 rounded-lg" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
              <Menu className="w-5.5 h-5.5" />
            </button>
            <div className="lg:hidden"><CoinPrivateLogo withWordmark={false} size={26} /></div>
            <div className="lg:hidden text-[10px] font-bold tracking-widest text-primary bg-primary/10 rounded px-1.5 py-0.5 uppercase">Management</div>
            <div className="flex-1" />
            <button
              onClick={() => adminNavigate('notifications')}
              className="relative p-2.5 rounded-full hover:bg-secondary transition-colors"
              aria-label="Notifications"
            >
              <Bell className="w-4.5 h-4.5" />
              {unread > 0 && <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-primary" />}
            </button>
            <button onClick={logout} className="lg:hidden p-2.5 rounded-full hover:bg-secondary transition-colors" aria-label="Sign out">
              <LogOut className="w-4.5 h-4.5" />
            </button>
          </div>
        </header>

        <main className="flex-1 px-4 md:px-7 py-6">{body}</main>

        {/* mobile bottom bar */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar/95 backdrop-blur-lg border-t border-border safe-bottom" aria-label="Management navigation">
          <div className="grid grid-cols-5 pt-1.5 pb-2">
            {MOBILE_NAV.filter((n) => ['overview', 'users', 'approvals', 'transactions', 'risk'].includes(n.view)).map((n) => (
              <button
                key={n.view}
                onClick={() => adminNavigate(n.view)}
                className={cn('flex flex-col items-center gap-1 py-1 transition-colors', adminView === n.view ? 'text-primary' : 'text-muted-foreground')}
                aria-label={n.label}
              >
                {n.icon}
                <span className="text-[9.5px] font-medium">{n.label}</span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* mobile drawer */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="bg-sidebar border-sidebar-border p-0 w-[272px] overflow-y-auto">
          <SheetHeader className="p-5 pb-4 border-b border-sidebar-border">
            <SheetTitle className="text-left flex items-center gap-2">
              <CoinPrivateLogo size={26} />
              <span className="text-[10px] font-bold tracking-widest text-primary bg-primary/10 rounded px-1.5 py-0.5 uppercase">Management</span>
            </SheetTitle>
          </SheetHeader>
          <div className="py-3">{navList(true)}</div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
