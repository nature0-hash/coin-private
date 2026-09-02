'use client';

// ============================================================
// Coin Private: Client app shell
// Desktop: sidebar · Tablet: icon rail · Mobile: bottom tabs
// ============================================================
import { useUI, ClientView } from '@/lib/store';
import { useAuth } from '@/lib/store';
import { useNotifications, usePrices } from '@/hooks/use-cp-data';
import { CoinPrivateLogo, LiveBadge } from '@/components/cp/primitives';
import {
  Home, LineChart, ArrowLeftRight, Activity, User, Bell,
  ArrowDownToLine, ArrowUpFromLine, Send, QrCode, Settings, Shield,
  LogOut, Menu,
} from 'lucide-react';
import { HomeView } from '@/components/cp/client/home-view';
import { MarketsView } from '@/components/cp/client/markets-view';
import { AssetDetailView } from '@/components/cp/client/asset-detail-view';
import { TradeView } from '@/components/cp/client/trade-view';
import { ActivityView } from '@/components/cp/client/activity-view';
import { DepositView } from '@/components/cp/client/deposit-view';
import { WithdrawView } from '@/components/cp/client/withdraw-view';
import { SendView } from '@/components/cp/client/send-view';
import { ReceiveView } from '@/components/cp/client/receive-view';
import { NotificationsView } from '@/components/cp/client/notifications-view';
import { SecurityView } from '@/components/cp/client/security-view';
import { SettingsView } from '@/components/cp/client/settings-view';
import { ProfileView } from '@/components/cp/client/profile-view';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { cn } from '@/lib/utils';

const NAV: Array<{ view: ClientView; label: string; icon: React.ReactNode }> = [
  { view: 'home', label: 'Home', icon: <Home className="w-[22px] h-[22px]" /> },
  { view: 'markets', label: 'Markets', icon: <LineChart className="w-[22px] h-[22px]" /> },
  { view: 'trade', label: 'Trade', icon: <ArrowLeftRight className="w-[22px] h-[22px]" /> },
  { view: 'activity', label: 'Activity', icon: <Activity className="w-[22px] h-[22px]" /> },
  { view: 'profile', label: 'Profile', icon: <User className="w-[22px] h-[22px]" /> },
];

const MOBILE_NAV = NAV;

const QUICK_ACTIONS: Array<{ view: ClientView; label: string; icon: React.ReactNode; cls: string }> = [
  { view: 'deposit', label: 'Deposit', icon: <ArrowDownToLine className="w-5 h-5" />, cls: 'text-up bg-up/12' },
  { view: 'withdraw', label: 'Withdraw', icon: <ArrowUpFromLine className="w-5 h-5" />, cls: 'text-warn bg-warn/12' },
  { view: 'send', label: 'Send', icon: <Send className="w-5 h-5" />, cls: 'text-[#3773f5] bg-[#3773f5]/12' },
  { view: 'receive', label: 'Receive', icon: <QrCode className="w-5 h-5" />, cls: 'text-[#9945ff] bg-[#9945ff]/12' },
];

export function ClientApp() {
  const { clientView, navigate } = useUI();
  const { user, logout } = useAuth();
  const { items: notifications, unread } = useNotifications();
  const { provider } = usePrices(10000);
  const sidebarOpen = useUI((s) => s.sidebarOpen);
  const setSidebarOpen = useUI((s) => s.setSidebarOpen);

  const initials = (user?.name ?? 'U')
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const body = (() => {
    switch (clientView) {
      case 'home': return <HomeView />;
      case 'markets': return <MarketsView />;
      case 'asset': return <AssetDetailView />;
      case 'trade': return <TradeView />;
      case 'activity': return <ActivityView />;
      case 'deposit': return <DepositView />;
      case 'withdraw': return <WithdrawView />;
      case 'send': return <SendView />;
      case 'receive': return <ReceiveView />;
      case 'notifications': return <NotificationsView />;
      case 'security': return <SecurityView />;
      case 'settings': return <SettingsView />;
      case 'profile': return <ProfileView />;
      default: return <HomeView />;
    }
  })();

  const showTopbar = true;

  return (
    <div className="min-h-screen bg-background">
      {/* ============ Desktop / tablet sidebar ============ */}
      <aside
        className={cn(
          'fixed left-0 top-0 bottom-0 z-40 w-[240px] bg-sidebar border-r border-sidebar-border hidden md:flex flex-col',
        )}
      >
        <div className="p-5 pb-6">
          <CoinPrivateLogo />
        </div>

        {/* quick actions */}
        <div className="px-3 grid grid-cols-4 gap-1.5 mb-5">
          {QUICK_ACTIONS.map((a) => (
            <button
              key={a.view}
              onClick={() => navigate(a.view)}
              title={a.label}
              className={cn('flex flex-col items-center gap-1.5 py-2.5 rounded-xl transition-colors hover:bg-sidebar-accent group')}
            >
              <span className={cn('w-9 h-9 rounded-full flex items-center justify-center transition-transform group-hover:scale-105', a.cls)}>{a.icon}</span>
              <span className="text-[10.5px] text-muted-foreground">{a.label}</span>
            </button>
          ))}
        </div>

        <nav className="px-3 space-y-1" aria-label="Main">
          {NAV.map((n) => (
            <button
              key={n.view}
              onClick={() => navigate(n.view)}
              className={cn(
                'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors',
                clientView === n.view || (n.view === 'markets' && clientView === 'asset')
                  ? 'bg-sidebar-accent text-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60'
              )}
            >
              <span className={cn(clientView === n.view && 'text-primary')}>{n.icon}</span>
              {n.label}
              {n.view === 'profile' && <span className="ml-auto" />}
            </button>
          ))}
        </nav>

        <div className="mt-auto p-3 space-y-1">
          <button
            onClick={() => navigate('security')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors',
              clientView === 'security' ? 'bg-sidebar-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60'
            )}
          >
            <Shield className="w-[20px] h-[20px]" /> Security
          </button>
          <button
            onClick={() => navigate('settings')}
            className={cn(
              'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors',
              clientView === 'settings' ? 'bg-sidebar-accent text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-sidebar-accent/60'
            )}
          >
            <Settings className="w-[20px] h-[20px]" /> Settings
          </button>

          <div className="mt-3 pt-3 border-t border-sidebar-border px-1">
            <div className="flex items-center gap-3 px-2 py-2">
              <Avatar className="w-9 h-9">
                <AvatarFallback className="bg-primary/15 text-primary text-[13px] font-semibold">{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="text-[13.5px] font-medium truncate">{user?.name}</p>
                <p className="text-[11.5px] text-muted-foreground truncate">{user?.email}</p>
              </div>
              <button onClick={logout} className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-sidebar-accent transition-colors" aria-label="Sign out" title="Sign out">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </aside>

      {/* ============ Main column ============ */}
      <div className="md:pl-[240px] pb-24 md:pb-10 min-h-screen flex flex-col">
        {/* topbar */}
        {showTopbar && (
          <header className="sticky top-0 z-30 bg-background/85 backdrop-blur-md border-b border-border/60">
            <div className="flex items-center gap-3 px-4 md:px-8 h-16">
              {/* mobile hamburger */}
              <button className="md:hidden p-2 -ml-2 rounded-lg text-foreground" onClick={() => setSidebarOpen(true)} aria-label="Open menu">
                <Menu className="w-6 h-6" />
              </button>

              {/* mobile logo */}
              <div className="md:hidden"><CoinPrivateLogo withWordmark={false} size={30} /></div>

              <div className="flex-1" />

              <LiveBadge provider={provider} />

              <button
                onClick={() => navigate('notifications')}
                className="relative p-2.5 rounded-full hover:bg-secondary transition-colors"
                aria-label={`Notifications${unread ? ` (${unread} unread)` : ''}`}
              >
                <Bell className="w-5 h-5" />
                {unread > 0 && (
                  <span className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center nums">
                    {unread > 9 ? '9+' : unread}
                  </span>
                )}
              </button>

              <button onClick={() => navigate('profile')} className="hidden md:flex items-center gap-2 pl-1 pr-3 py-1 rounded-full hover:bg-secondary transition-colors" aria-label="Profile">
                <Avatar className="w-8 h-8">
                  <AvatarFallback className="bg-primary/15 text-primary text-[12px] font-semibold">{initials}</AvatarFallback>
                </Avatar>
                <span className="text-[13.5px] font-medium max-w-[140px] truncate">{user?.name}</span>
              </button>
            </div>
          </header>
        )}

        <main className="flex-1 px-4 md:px-8 py-5 md:py-7 max-w-[1080px] w-full mx-auto">{body}</main>
      </div>

      {/* ============ Mobile bottom tabs ============ */}
      <nav
        className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-sidebar/95 backdrop-blur-lg border-t border-border safe-bottom"
        aria-label="Bottom navigation"
      >
        <div className="grid grid-cols-5 pt-1.5 pb-2">
          {MOBILE_NAV.map((n) => (
            <button
              key={n.view}
              onClick={() => navigate(n.view)}
              className={cn('flex flex-col items-center gap-1 py-1 transition-colors', (clientView === n.view || (n.view === 'markets' && clientView === 'asset')) ? 'text-primary' : 'text-muted-foreground')}
              aria-label={n.label}
              aria-current={clientView === n.view}
            >
              {n.icon}
              <span className="text-[10.5px] font-medium">{n.label}</span>
            </button>
          ))}
        </div>
      </nav>

      {/* ============ Mobile drawer ============ */}
      <Sheet open={sidebarOpen} onOpenChange={setSidebarOpen}>
        <SheetContent side="left" className="bg-sidebar border-sidebar-border p-0 w-[300px]">
          <SheetHeader className="p-5 pb-4 border-b border-sidebar-border">
            <SheetTitle className="text-left"><CoinPrivateLogo /></SheetTitle>
          </SheetHeader>
          <div className="p-3">
            <div className="grid grid-cols-4 gap-1.5 mb-4">
              {QUICK_ACTIONS.map((a) => (
                <button key={a.view} onClick={() => navigate(a.view)} className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl hover:bg-sidebar-accent">
                  <span className={cn('w-9 h-9 rounded-full flex items-center justify-center', a.cls)}>{a.icon}</span>
                  <span className="text-[10.5px] text-muted-foreground">{a.label}</span>
                </button>
              ))}
            </div>
            {NAV.map((n) => (
              <button
                key={n.view}
                onClick={() => navigate(n.view)}
                className={cn(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium transition-colors',
                  clientView === n.view ? 'bg-sidebar-accent text-foreground' : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <span className={cn(clientView === n.view && 'text-primary')}>{n.icon}</span>
                {n.label}
              </button>
            ))}
            <div className="h-px bg-sidebar-border my-3" />
            <button onClick={() => navigate('notifications')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium text-muted-foreground hover:text-foreground">
              <Bell className="w-5 h-5" /> Notifications
              {unread > 0 && <span className="ml-auto bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full nums">{unread}</span>}
            </button>
            <button onClick={() => navigate('security')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium text-muted-foreground hover:text-foreground">
              <Shield className="w-5 h-5" /> Security
            </button>
            <button onClick={() => navigate('settings')} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-[14px] font-medium text-muted-foreground hover:text-foreground">
              <Settings className="w-5 h-5" /> Settings
            </button>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}
