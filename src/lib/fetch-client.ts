// ============================================================
// Coin Private: Client fetch interceptor
// Patches window.fetch so every /api/* request carries the
// per-tab session token (X-Tab-Session header). One tab = one
// session; closing the tab signs out that tab only.
// ============================================================

const TAB_TOKEN_KEY = 'cp_tab_token';

let patched = false;

export function getTabToken(): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return sessionStorage.getItem(TAB_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setTabToken(token: string) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(TAB_TOKEN_KEY, token);
  } catch {}
}

export function clearTabToken() {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.removeItem(TAB_TOKEN_KEY);
  } catch {}
}

export function installFetchInterceptor() {
  if (typeof window === 'undefined' || patched) return;
  patched = true;
  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    try {
      const url = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (url && url.startsWith('/api/')) {
        const token = getTabToken();
        if (token) {
          const headers = new Headers(init?.headers || {});
          if (!headers.has('X-Tab-Session')) headers.set('X-Tab-Session', token);
          return originalFetch(input, { ...init, headers });
        }
      }
    } catch {
      // fall through
    }
    return originalFetch(input, init);
  }) as typeof window.fetch;
}
