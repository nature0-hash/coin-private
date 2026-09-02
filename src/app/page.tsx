'use client';

import { useEffect } from 'react';
import { useAuth } from '@/lib/store';
import { ClientApp } from '@/components/cp/client/client-app';
import { AdminApp } from '@/components/cp/admin/admin-app';
import { LoginScreen } from '@/components/cp/login-screen';
import { CoinPrivateLogo } from '@/components/cp/primitives';

export default function Home() {
  const refresh = useAuth((s) => s.refresh);
  const loading = useAuth((s) => s.loading);
  const user = useAuth((s) => s.user);

  useEffect(() => {
    refresh();
  }, [refresh]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-5">
          <div className="relative">
            <div className="w-12 h-12 rounded-full border-[3px] border-primary/15 border-t-primary animate-spin" />
          </div>
          <CoinPrivateLogo />
        </div>
      </div>
    );
  }

  if (!user) return <LoginScreen />;
  if (user.role === 'ADMIN') return <AdminApp />;
  return <ClientApp />;
}
