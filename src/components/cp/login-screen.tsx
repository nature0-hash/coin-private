'use client';

// ============================================================
// Coin Private: Auth screen (sign in / create account / reset)
// ============================================================
import { useState } from 'react';
import { CoinPrivateLogo } from '@/components/cp/primitives';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/lib/store';
import { Eye, EyeOff, ArrowLeft, ShieldCheck, TrendingUp, Fingerprint } from 'lucide-react';

type Mode = 'signin' | 'register' | 'forgot' | 'reset';

export function LoginScreen() {
  const { setUser, applyTabToken } = useAuth();
  const [mode, setMode] = useState<Mode>('signin');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  // fields
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [country, setCountry] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  async function post(url: string, body: Record<string, unknown>) {
    setBusy(true);
    setError('');
    setInfo('');
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong');
        return null;
      }
      return data as Record<string, unknown>;
    } catch {
      setError('Network error: please try again');
      return null;
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn() {
    const data = await post('/api/auth/login', { identifier, password });
    if (!data) return;
    applyTabToken(data.token as string);
    setUser(data.user as never);
  }

  async function handleRegister() {
    const data = await post('/api/auth/register', { name, email, password, country });
    if (!data) return;
    applyTabToken(data.token as string);
    setUser(data.user as never);
  }

  async function handleForgot() {
    const data = await post('/api/auth/forgot', { email });
    if (!data) return;
    setInfo(`Reset code sent${data.resetCode ? `: ${data.resetCode} (delivered via notification center in this environment)` : ' if the account exists'}.`);
    if (data.resetCode) setResetCode(String(data.resetCode));
    setMode('reset');
  }

  async function handleReset() {
    const data = await post('/api/auth/reset', { email, code: resetCode, password: newPassword });
    if (!data) return;
    setInfo('Password updated: you can sign in now.');
    setPassword('');
    setMode('signin');
  }

  const inputCls = 'h-12 bg-secondary/60 border-input rounded-xl text-[15px]';
  const btnCls = 'h-12 rounded-xl text-[15px] font-semibold';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* ---------- Left brand panel ---------- */}
      <aside className="relative hidden lg:flex lg:w-[46%] xl:w-[42%] flex-col justify-between gap-10 p-12 overflow-hidden bg-sidebar border-r border-border">
        <div
          className="absolute inset-0 opacity-[0.55]"
          style={{
            background:
              'radial-gradient(60% 50% at 20% 10%, rgba(55,115,245,0.16) 0%, transparent 60%), radial-gradient(50% 40% at 85% 85%, rgba(5,193,104,0.08) 0%, transparent 60%)',
          }}
        />
        <div className="relative">
          <CoinPrivateLogo size={34} />
        </div>
        <div className="relative max-w-md">
          <h1 className="text-[34px] leading-[1.15] font-semibold tracking-tight">
            Private-grade crypto,
            <br />
            <span className="text-muted-foreground">engineered for trust.</span>
          </h1>
          <p className="text-[15px] text-muted-foreground mt-5 leading-relaxed">
            Trade, send, and manage digital assets with recorded wallet
            movements, clear statuses, and a complete activity history.
          </p>
          <div className="mt-10 space-y-5">
            {[
              { icon: <ShieldCheck className="w-5 h-5" />, title: 'Recorded wallet settlement', body: 'Wallet changes and their ledger records commit together.' },
              { icon: <TrendingUp className="w-5 h-5" />, title: 'Live market data', body: 'Prices stream from a configurable provider with sub-second feedback.' },
              { icon: <Fingerprint className="w-5 h-5" />, title: 'Private by default', body: 'Per-tab sessions, full audit trail, and compliance approvals built in.' },
            ].map((f) => (
              <div key={f.title} className="flex gap-4">
                <div className="w-10 h-10 rounded-xl bg-secondary border border-border flex items-center justify-center text-primary shrink-0">{f.icon}</div>
                <div>
                  <p className="font-medium text-[14.5px]">{f.title}</p>
                  <p className="text-[13px] text-muted-foreground mt-0.5 leading-relaxed">{f.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-[12px] text-muted-foreground/70">
          © {new Date().getFullYear()} Coin Private · Live market data · Trading involves risk
        </p>
      </aside>

      {/* ---------- Right form panel ---------- */}
      <main className="flex-1 flex items-center justify-center px-5 py-10">
        <div className="w-full max-w-[400px]">
          <div className="lg:hidden flex justify-center mb-10">
            <CoinPrivateLogo size={38} />
          </div>

        {mode === 'signin' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <h2 className="text-[24px] font-semibold tracking-tight">Welcome back</h2>
              <p className="text-[14px] text-muted-foreground mt-1.5 mb-8">Sign in to your Coin Private account.</p>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSignIn();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="identifier">Email or login ID</Label>
                  <Input id="identifier" className={inputCls} placeholder="you@example.com" autoComplete="username" value={identifier} onChange={(e) => setIdentifier(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <div className="relative">
                    <Input id="password" className={inputCls} type={showPassword ? 'text' : 'password'} placeholder="••••••••" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground" aria-label={showPassword ? 'Hide password' : 'Show password'}>
                      {showPassword ? <EyeOff className="w-4.5 h-4.5" /> : <Eye className="w-4.5 h-4.5" />}
                    </button>
                  </div>
                </div>
                {error && <p className="text-[13px] text-destructive">{error}</p>}
                <Button type="submit" className={`${btnCls} w-full`} disabled={busy}>
                  {busy ? 'Signing in…' : 'Sign in'}
                </Button>
              </form>
              <div className="flex items-center justify-between mt-5 text-[13.5px]">
                <button className="text-muted-foreground hover:text-foreground transition-colors" onClick={() => { setMode('forgot'); setError(''); }}>
                  Forgot password?
                </button>
                <button className="text-primary hover:underline" onClick={() => { setMode('register'); setError(''); }}>
                  Create account
                </button>
              </div>
            </div>
          )}

          {mode === 'register' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button className="inline-flex items-center gap-1.5 text-[13.5px] text-muted-foreground hover:text-foreground mb-6 transition-colors" onClick={() => setMode('signin')}>
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
              <h2 className="text-[24px] font-semibold tracking-tight">Create your account</h2>
              <p className="text-[14px] text-muted-foreground mt-1.5 mb-8">Open a private crypto account in under a minute.</p>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleRegister();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="name">Full name</Label>
                  <Input id="name" className={inputCls} placeholder="Amber Darnell" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" className={inputCls} type="email" placeholder="you@example.com" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="country">Country (optional)</Label>
                  <Input id="country" className={inputCls} placeholder="United States" value={country} onChange={(e) => setCountry(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="new-password">Password</Label>
                  <Input id="new-password" className={inputCls} type="password" placeholder="At least 8 characters" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                {error && <p className="text-[13px] text-destructive">{error}</p>}
                <Button type="submit" className={`${btnCls} w-full`} disabled={busy}>
                  {busy ? 'Creating account…' : 'Create account'}
                </Button>
              </form>
              <p className="text-[12px] text-muted-foreground mt-5 leading-relaxed">
                By creating an account you agree to the platform terms. New
                accounts receive a welcome bonus for exploring the platform.
              </p>
            </div>
          )}

          {mode === 'forgot' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button className="inline-flex items-center gap-1.5 text-[13.5px] text-muted-foreground hover:text-foreground mb-6 transition-colors" onClick={() => setMode('signin')}>
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
              <h2 className="text-[24px] font-semibold tracking-tight">Reset your password</h2>
              <p className="text-[14px] text-muted-foreground mt-1.5 mb-8">We&apos;ll send a 6-digit reset code to your email.</p>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleForgot();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="reset-email">Email</Label>
                  <Input id="reset-email" className={inputCls} type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
                </div>
                {error && <p className="text-[13px] text-destructive">{error}</p>}
                <Button type="submit" className={`${btnCls} w-full`} disabled={busy}>
                  {busy ? 'Sending…' : 'Send reset code'}
                </Button>
              </form>
            </div>
          )}

          {mode === 'reset' && (
            <div className="animate-in fade-in slide-in-from-bottom-2 duration-300">
              <button className="inline-flex items-center gap-1.5 text-[13.5px] text-muted-foreground hover:text-foreground mb-6 transition-colors" onClick={() => setMode('signin')}>
                <ArrowLeft className="w-4 h-4" /> Back to sign in
              </button>
              <h2 className="text-[24px] font-semibold tracking-tight">Enter your reset code</h2>
              <p className="text-[14px] text-muted-foreground mt-1.5 mb-8">Check your notifications for the 6-digit code.</p>
              <form
                className="space-y-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  handleReset();
                }}
              >
                <div className="space-y-2">
                  <Label htmlFor="code">Reset code</Label>
                  <Input id="code" className={`${inputCls} nums tracking-[0.3em] text-center`} placeholder="••••••" maxLength={6} value={resetCode} onChange={(e) => setResetCode(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="reset-password">New password</Label>
                  <Input id="reset-password" className={inputCls} type="password" placeholder="At least 8 characters" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                </div>
                {error && <p className="text-[13px] text-destructive">{error}</p>}
                {info && <p className="text-[13px] text-up">{info}</p>}
                <Button type="submit" className={`${btnCls} w-full`} disabled={busy}>
                  {busy ? 'Updating…' : 'Set new password'}
                </Button>
              </form>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
