'use client';

// ============================================================
// Coin Private: Data hooks (polling-based live data)
// Initial fetch is deferred to a microtask/timeout so effects
// never call setState synchronously (no cascading renders).
// ============================================================
import { useCallback, useEffect, useRef, useState } from 'react';

export interface Quote {
  symbol: string;
  name: string;
  kind: string;
  color: string;
  price: number;
  change24h: number;
  tradeable: boolean;
  network?: string | null;
}

export interface Holding {
  symbol: string;
  name: string;
  kind: string;
  color: string;
  address: string;
  available: number;
  reserved: number;
  total: number;
  price: number;
  change24h: number;
  valueUsd: number;
  tradeable: boolean;
}

export interface Portfolio {
  totalUsd: number;
  change24hUsd: number;
  change24hPct: number;
  spark: number[];
  holdings: Holding[];
  allocation: Array<{ symbol: string; name: string; color: string; valueUsd: number; pct: number }>;
  provider: string;
  updatedAt: number;
  welcomeMatch: {
    enabled: boolean;
    status: 'ELIGIBLE' | 'ACTIVE' | 'LOCKED' | 'RELEASED' | 'EXPIRED';
    windowEndsAt: string;
    streakDays: number;
    requiredDays: number;
    targetUsd: number;
    todayTotalUsd: number;
    minimumUsd: number;
    matchPercent: number;
    maxBonusUsd: number;
    bonusUsd: number;
    unlockAt: string | null;
  };
}

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string;
  read: boolean;
  createdAt: string;
}

async function getJSON<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { cache: 'no-store' });
    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch {
    return null;
  }
}

/** Live price polling: refreshes on the provider cadence. */
export function usePrices(intervalMs = 4000) {
  const [quotes, setQuotes] = useState<Record<string, Quote>>({});
  const [provider, setProvider] = useState('');
  const [updatedAt, setUpdatedAt] = useState(0);
  const mounted = useRef(true);

  const load = useCallback(async () => {
    const data = await getJSON<{ quotes: Quote[]; provider: string; updatedAt: number }>('/api/prices');
    if (!data || !mounted.current) return;
    const map: Record<string, Quote> = {};
    for (const q of data.quotes) map[q.symbol] = q;
    setQuotes(map);
    setProvider(data.provider);
    setUpdatedAt(data.updatedAt);
  }, []);

  useEffect(() => {
    mounted.current = true;
    const first = setTimeout(load, 0);
    const t = setInterval(load, intervalMs);
    return () => {
      mounted.current = false;
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, intervalMs]);

  return { quotes, provider, updatedAt, reload: load };
}

/** Portfolio (wallets + valuations). */
export function usePortfolio(intervalMs = 8000) {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const data = await getJSON<Portfolio>('/api/portfolio');
    if (data) setPortfolio(data);
    setLoading(false);
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, intervalMs]);

  return { portfolio, loading, reload: load };
}

/** Notifications with unread count. */
export function useNotifications(intervalMs = 15000) {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unread, setUnread] = useState(0);

  const load = useCallback(async () => {
    const data = await getJSON<{ notifications: NotificationItem[]; unread: number }>('/api/notifications');
    if (data) {
      setItems(data.notifications);
      setUnread(data.unread);
    }
  }, []);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const t = setInterval(load, intervalMs);
    return () => {
      clearTimeout(first);
      clearInterval(t);
    };
  }, [load, intervalMs]);

  return { items, unread, reload: load };
}

/** Generic one-shot fetch with loading state. */
export function useFetch<T>(url: string, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    const d = await getJSON<T>(url);
    if (d) setData(d);
    setLoading(false);
  }, [url]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    return () => clearTimeout(first);
  }, [url, ...deps]);

  return { data, loading, reload: load };
}
