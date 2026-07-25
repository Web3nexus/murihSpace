import { useState, useEffect, useCallback } from 'react';
import {
  Users, Search, Loader2, ShieldOff, ShieldCheck, Ban,
  AlertCircle, CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import type { AdminUser } from '@/types/admin';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
const authHeaders = () => {
  const t = localStorage.getItem('auth_token') || localStorage.getItem('murihspace-token');
  return { Accept: 'application/json', 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

const ROLE_COLORS: Record<string, string> = {
  admin: 'bg-purple-500/15 text-purple-600',
  creator: 'bg-blue-500/15 text-blue-600',
  vendor: 'bg-amber-500/15 text-amber-600',
  member: 'bg-muted text-muted-foreground',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/15 text-emerald-600',
  suspended: 'bg-amber-500/15 text-amber-600',
  banned: 'bg-destructive/15 text-destructive',
};

export function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [actionUser, setActionUser] = useState<AdminUser | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'activate' | 'ban' | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    try {
      const res = await fetch(`${API_BASE}/securegate/users?${params}`, { headers: authHeaders() });
      if (res.ok) {
        const j = await res.json();
        setUsers(j.data ?? []);
      }
    } finally { setLoading(false); }
  }, [search, roleFilter]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const handleAction = async () => {
    if (!actionUser || !actionType) return;
    setSubmitting(true); setMsg(null);
    const body = actionType === 'activate' ? {} : { reason };
    try {
      const res = await fetch(`${API_BASE}/securegate/users/${actionUser.id}/${actionType}`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
      });
      const j = await res.json();
      if (res.ok) {
        setMsg({ type: 'success', text: j.message });
        setActionUser(null); setActionType(null); setReason('');
        fetchUsers();
      } else setMsg({ type: 'error', text: j.message || 'Action failed.' });
    } catch { setMsg({ type: 'error', text: 'Network error.' }); }
    setSubmitting(false);
  };

  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
          <Users className="h-6 w-6 text-secondary" /> Users & Creators
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Manage all platform accounts.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 text-sm" placeholder="Search by name, email, username..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        {['', 'admin', 'creator', 'vendor', 'member'].map((r) => (
          <button key={r} onClick={() => setRoleFilter(r)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${roleFilter === r ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{r || 'All'}</button>
        ))}
      </div>

      {loading ? <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-secondary" /></div>
        : users.length === 0 ? <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card"><Users className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" /><h3 className="text-sm font-bold">No users found</h3></div>
        : <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border">
                  <tr className="text-left">
                    {['Name', 'Email', 'Username', 'Role', 'Status', 'KYC', 'Joined', ''].map((h) => (
                      <th key={h} className="px-4 py-3 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{u.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email}</td>
                      <td className="px-4 py-3 text-muted-foreground">@{u.username}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ROLE_COLORS[u.role] ?? ''}`}>{u.role}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[u.status] ?? ''}`}>{u.status}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.kyc_status === 'verified' ? 'bg-emerald-500/15 text-emerald-600' : u.kyc_status === 'rejected' ? 'bg-destructive/15 text-destructive' : 'bg-amber-500/15 text-amber-600'}`}>{u.kyc_status}</span></td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {u.status === 'active' && <Button size="sm" variant="ghost" className="h-7 text-[10px] text-amber-600" onClick={() => { setActionUser(u); setActionType('suspend'); setReason(''); setMsg(null); }}><ShieldOff className="h-3 w-3" /></Button>}
                          {u.status === 'suspended' && <Button size="sm" variant="ghost" className="h-7 text-[10px] text-emerald-600" onClick={() => { setActionUser(u); setActionType('activate'); setMsg(null); }}><ShieldCheck className="h-3 w-3" /></Button>}
                          {u.status !== 'banned' && <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => { setActionUser(u); setActionType('ban'); setReason(''); setMsg(null); }}><Ban className="h-3 w-3" /></Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}

      <Dialog open={actionType !== null} onOpenChange={() => { setActionType(null); setMsg(null); }}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              {actionType === 'suspend' && <><ShieldOff className="h-5 w-5 text-amber-500" /> Suspend User</>}
              {actionType === 'activate' && <><ShieldCheck className="h-5 w-5 text-emerald-500" /> Activate User</>}
              {actionType === 'ban' && <><Ban className="h-5 w-5 text-destructive" /> Ban User</>}
            </DialogTitle>
            <DialogDescription className="text-xs">{actionUser?.name} (@{actionUser?.username})</DialogDescription>
          </DialogHeader>
          {msg && <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'}`}>{msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}{msg.text}</div>}
          {actionType !== 'activate' && (
            <textarea className="w-full min-h-[80px] rounded-xl border border-border bg-card p-3 text-xs font-medium text-foreground placeholder:text-muted-foreground resize-none" placeholder="Reason for this action..." value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
          {!msg && <Button disabled={submitting || (actionType !== 'activate' && !reason)} onClick={handleAction} className="w-full text-sm font-bold">{submitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{actionType === 'suspend' ? 'Suspend' : actionType === 'activate' ? 'Activate' : 'Ban'}</Button>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
