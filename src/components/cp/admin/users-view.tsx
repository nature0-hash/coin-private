'use client';

// ============================================================
// Coin Private: Admin user management
// Search, freeze/unfreeze, KYC tier changes, create user,
// open detail (wallets, credit/debit, history).
// ============================================================
import { useMemo, useState } from 'react';
import { useFetch } from '@/hooks/use-cp-data';
import { useUI } from '@/lib/store';
import { SkeletonBlock, StatusPill, EmptyState } from '@/components/cp/primitives';
import { fmtDateTime } from '@/lib/format';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select';
import { toast } from 'sonner';
import { Search, UserPlus, MoreHorizontal, ShieldOff, ShieldCheck, Eye, BadgeCheck } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from '@/components/ui/dropdown-menu';

interface AdminUserRow {
  id: string;
  email: string;
  name: string;
  role: string;
  status: string;
  phone: string | null;
  country: string | null;
  kycStatus: string;
  kycTier: number;
  twoFactorEnabled: boolean;
  createdAt: string;
  walletCount: number;
}

export function AdminUsersView() {
  const [q, setQ] = useState('');
  const [status, setStatus] = useState('ALL');
  const { data, loading, reload } = useFetch<{ users: AdminUserRow[] }>(
    `/api/admin/users?q=${encodeURIComponent(q)}&status=${status === 'ALL' ? '' : status}`,
    [q, status]
  );
  const { adminNavigate } = useUI();
  const [createOpen, setCreateOpen] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', role: 'CUSTOMER', kyc: 'PENDING' });
  const [busy, setBusy] = useState(false);

  const users = useMemo(() => data?.users ?? [], [data]);

  async function patchUser(id: string, payload: Record<string, unknown>, successMsg: string) {
    const res = await fetch('/api/admin/users', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, ...payload }),
    });
    const d = await res.json();
    if (d.error) toast.error(d.error);
    else {
      toast.success(successMsg);
      reload();
    }
  }

  async function createUser() {
    setBusy(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password, role: form.role, kycStatus: form.kyc }),
      });
      const d = await res.json();
      if (d.error) toast.error(d.error);
      else {
        toast.success(`Created ${form.email}`);
        setCreateOpen(false);
        setForm({ name: '', email: '', password: '', role: 'CUSTOMER', kyc: 'PENDING' });
        reload();
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      <div className="flex items-end justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight">Users</h1>
          <p className="text-[13.5px] text-muted-foreground mt-1">Freeze accounts, manage verification, and onboard new members.</p>
        </div>
        <Button className="rounded-full gap-2" onClick={() => setCreateOpen(true)}>
          <UserPlus className="w-4 h-4" /> Add user
        </Button>
      </div>

      {/* filters */}
      <div className="flex flex-col sm:flex-row gap-2.5">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input className="h-10 pl-9.5 rounded-full bg-secondary/60" placeholder="Search name, email, login ID" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[150px] h-10 rounded-full bg-secondary/60">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="FROZEN">Frozen</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* table */}
      {loading && !data ? (
        <div className="cp-card p-4 space-y-3">{[1, 2, 3, 4, 5].map((i) => <SkeletonBlock key={i} className="h-11" />)}</div>
      ) : users.length === 0 ? (
        <div className="cp-card"><EmptyState icon={<Search className="w-5 h-5" />} title="No users match" body="Adjust the search or status filter." /></div>
      ) : (
        <div className="cp-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-[13px] min-w-[760px]">
              <thead>
                <tr className="text-left text-muted-foreground text-[11px] uppercase tracking-wide border-b border-border">
                  <th className="px-5 py-3 font-medium">User</th>
                  <th className="px-3 py-3 font-medium">Role</th>
                  <th className="px-3 py-3 font-medium">KYC</th>
                  <th className="px-3 py-3 font-medium">2FA</th>
                  <th className="px-3 py-3 font-medium">Status</th>
                  <th className="px-3 py-3 font-medium">Joined</th>
                  <th className="px-5 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-hover transition-colors">
                    <td className="px-5 py-3">
                      <button className="text-left group" onClick={() => adminNavigate('user-detail', { id: u.id })}>
                        <p className="font-medium group-hover:text-primary transition-colors flex items-center gap-1.5">
                          {u.name}
                          {u.kycStatus === 'VERIFIED' && <BadgeCheck className="w-3.5 h-3.5 text-primary" />}
                        </p>
                        <p className="text-[11.5px] text-muted-foreground">{u.email}</p>
                      </button>
                    </td>
                    <td className="px-3 py-3">
                      <span className={cn('text-[11.5px] font-semibold rounded-full px-2 py-0.5', u.role === 'ADMIN' ? 'text-primary bg-primary/10' : 'text-muted-foreground bg-secondary')}>
                        {u.role === 'ADMIN' ? 'MANAGEMENT' : u.role}
                      </span>
                    </td>
                    <td className="px-3 py-3">
                      <span className="text-[12px] nums">{u.kycStatus} · T{u.kycTier}</span>
                    </td>
                    <td className="px-3 py-3 text-[12px]">{u.twoFactorEnabled ? 'On' : 'Off'}</td>
                    <td className="px-3 py-3"><StatusPill status={u.status} /></td>
                    <td className="px-3 py-3 text-muted-foreground text-[12px]">{fmtDateTime(u.createdAt)}</td>
                    <td className="px-5 py-3 text-right">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 rounded-lg" aria-label={`Actions for ${u.name}`}>
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-52">
                          <DropdownMenuItem onClick={() => adminNavigate('user-detail', { id: u.id })}>
                            <Eye className="w-4 h-4 mr-2" /> Open profile
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          {u.status === 'ACTIVE' ? (
                            <DropdownMenuItem onClick={() => patchUser(u.id, { status: 'FROZEN' }, `${u.name} frozen`)}>
                              <ShieldOff className="w-4 h-4 mr-2 text-destructive" /> Freeze account
                            </DropdownMenuItem>
                          ) : (
                            <DropdownMenuItem onClick={() => patchUser(u.id, { status: 'ACTIVE' }, `${u.name} restored`)}>
                              <ShieldCheck className="w-4 h-4 mr-2 text-up" /> Unfreeze account
                            </DropdownMenuItem>
                          )}
                          <DropdownMenuItem onClick={() => patchUser(u.id, { kycStatus: 'VERIFIED', kycTier: 2 }, `KYC verified for ${u.name}`)}>
                            <BadgeCheck className="w-4 h-4 mr-2 text-primary" /> Mark KYC verified
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* create user dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-[420px]">
          <DialogHeader>
            <DialogTitle>Add user</DialogTitle>
            <DialogDescription>Creates the account with USD, BTC, ETH and SOL wallets.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 mt-1">
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Full name</Label>
              <Input className="h-10 bg-secondary/60 rounded-xl" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Email</Label>
              <Input className="h-10 bg-secondary/60 rounded-xl" type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-[12.5px]">Temporary password</Label>
              <Input className="h-10 bg-secondary/60 rounded-xl" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
              <p className="text-[11px] text-muted-foreground">Minimum 8 characters.</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">Role</Label>
                <Select value={form.role} onValueChange={(v) => setForm({ ...form, role: v })}>
                  <SelectTrigger className="h-10 rounded-xl bg-secondary/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="CUSTOMER">Customer</SelectItem>
                    <SelectItem value="ADMIN">Management</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[12.5px]">KYC</Label>
                <Select value={form.kyc} onValueChange={(v) => setForm({ ...form, kyc: v })}>
                  <SelectTrigger className="h-10 rounded-xl bg-secondary/60"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PENDING">Pending</SelectItem>
                    <SelectItem value="VERIFIED">Verified</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button className="w-full h-10 rounded-xl font-semibold" disabled={busy || form.name.length < 2 || !form.email || form.password.length < 8} onClick={createUser}>
              {busy ? 'Creating…' : 'Create user'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
