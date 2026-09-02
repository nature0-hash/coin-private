'use client';

// ============================================================
// Coin Private: Client state (Zustand)
// Auth session + UI navigation for both client & admin apps.
// ============================================================
import { create } from 'zustand';
import { getTabToken, clearTabToken, setTabToken } from '@/lib/fetch-client';

export interface SessionUser {
  id: string;
  email: string;
  loginId?: string | null;
  name: string;
  role: 'CUSTOMER' | 'ADMIN';
  status?: string;
  phone?: string | null;
  address?: string | null;
  country?: string | null;
  avatarUrl?: string | null;
  kycStatus?: string;
  kycTier?: number;
  twoFactorEnabled?: boolean;
  createdAt?: string;
}

export type ClientView =
  | 'home' | 'markets' | 'trade' | 'activity' | 'profile'
  | 'deposit' | 'withdraw' | 'send' | 'receive'
  | 'asset' | 'notifications' | 'security' | 'settings' | 'promo';

export type AdminView =
  | 'overview' | 'users' | 'user-detail' | 'wallets' | 'assets'
  | 'transactions' | 'approvals' | 'promotions' | 'risk' | 'audit' | 'settings-admin'
  | 'notifications';

interface AuthState {
  user: SessionUser | null;
  loading: boolean;
  setUser: (u: SessionUser | null) => void;
  refresh: () => Promise<void>;
  logout: () => Promise<void>;
  applyTabToken: (token: string) => void;
}

export const useAuth = create<AuthState>((set) => ({
  user: null,
  loading: true,
  setUser: (u) => set({ user: u, loading: false }),
  refresh: async () => {
    try {
      if (!getTabToken()) {
        set({ user: null, loading: false });
        return;
      }
      const res = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await res.json();
      if (data.user) {
        set({ user: data.user, loading: false });
        return;
      }
      clearTabToken();
      set({ user: null, loading: false });
    } catch {
      set({ user: null, loading: false });
    }
  },
  applyTabToken: (token: string) => {
    setTabToken(token);
    set({ loading: false });
  },
  logout: async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch {}
    clearTabToken();
    set({ user: null });
  },
}));

interface UIState {
  // client app
  clientView: ClientView;
  clientParams: Record<string, string>;
  navigate: (v: ClientView, params?: Record<string, string>) => void;
  // admin app
  adminView: AdminView;
  adminParams: Record<string, string>;
  adminNavigate: (v: AdminView, params?: Record<string, string>) => void;
  // global
  sidebarOpen: boolean;
  setSidebarOpen: (open: boolean) => void;
}

export const useUI = create<UIState>((set) => ({
  clientView: 'home',
  clientParams: {},
  navigate: (v, params = {}) => {
    set({ clientView: v, clientParams: params, sidebarOpen: false });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  },
  adminView: 'overview',
  adminParams: {},
  adminNavigate: (v, params = {}) => {
    set({ adminView: v, adminParams: params, sidebarOpen: false });
    if (typeof window !== 'undefined') window.scrollTo({ top: 0 });
  },
  sidebarOpen: false,
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
}));
