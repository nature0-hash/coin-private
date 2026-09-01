'use client';

// ============================================================
// Coin Private: Theme (light / dark)
// The active theme is persisted per device (localStorage) and
// applied as the `dark` class on <html>. The root layout ships
// a tiny inline script that applies the saved theme BEFORE the
// first paint, so there is never a flash of the wrong theme.
// State is exposed through useSyncExternalStore: the sanctioned
// way to mirror external state (DOM class + localStorage) in React.
// ============================================================
import { createContext, useCallback, useContext, useSyncExternalStore } from 'react';

export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'cp-theme';

// ---------------- External store: <html> class + localStorage ----------------
const listeners = new Set<() => void>();

function readActiveTheme(): Theme {
  if (typeof document === 'undefined') return 'dark';
  return document.documentElement.classList.contains('dark') ? 'dark' : 'light';
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot(): Theme {
  return readActiveTheme();
}

function getServerSnapshot(): Theme {
  return 'dark';
}

export function setTheme(t: Theme): void {
  document.documentElement.classList.toggle('dark', t === 'dark');
  document.documentElement.dataset.theme = t;
  try {
    localStorage.setItem(STORAGE_KEY, t);
  } catch {
    /* non-persistent environments still get the live switch */
  }
  for (const notify of listeners) notify();
}

// --------------------------------- React glue --------------------------------
interface ThemeContextValue {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({ theme: 'dark', setTheme: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const theme = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  const set = useCallback((t: Theme) => setTheme(t), []);
  return <ThemeContext.Provider value={{ theme, setTheme: set }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}
