// ============================================================
// Coin Private: Formatting helpers (client-safe)
// ============================================================

export function fmtUsd(n: number, opts?: { compact?: boolean; maxDigits?: number }): string {
  if (!Number.isFinite(n)) return '$0.00';
  if (opts?.compact && Math.abs(n) >= 1000) {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', notation: 'compact', maximumFractionDigits: 2 }).format(n);
  }
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: opts?.maxDigits ?? 2,
  }).format(n);
}

export function fmtPrice(n: number): string {
  if (!Number.isFinite(n)) return '$0.00';
  const digits = n >= 1000 ? 2 : n >= 1 ? 2 : n >= 0.01 ? 4 : 6;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2, maximumFractionDigits: digits }).format(n);
}

export function fmtCrypto(n: number, symbol?: string, maxDigits = 8): string {
  if (!Number.isFinite(n)) return '0';
  const digits = Math.abs(n) >= 1000 ? 4 : maxDigits;
  const s = new Intl.NumberFormat('en-US', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(n);
  return symbol ? `${s} ${symbol}` : s;
}

export function fmtPct(n: number): string {
  const sign = n > 0 ? '+' : '';
  return `${sign}${n.toFixed(2)}%`;
}

export function fmtDate(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

export function fmtDateTime(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function timeAgo(iso: string | Date): string {
  const d = typeof iso === 'string' ? new Date(iso) : iso;
  const s = Math.floor((Date.now() - d.getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export function maskAddress(addr: string): string {
  if (!addr) return '';
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export const ASSET_FALLBACK_COLORS: Record<string, string> = {
  BTC: '#F7931A', ETH: '#627EEA', SOL: '#9945FF', XRP: '#23292F',
  ADA: '#0033AD', DOGE: '#C2A633', AVAX: '#E84142', LINK: '#2A5ADA',
  USDC: '#2775CA', USD: '#12B76A',
};
