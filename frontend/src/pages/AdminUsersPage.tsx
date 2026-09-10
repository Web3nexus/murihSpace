
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams } from 'react-router';
import { toast } from 'sonner';
import {
  Users as Users,
  MagnifyingGlass as Search,
  Spinner as Loader2,
  ShieldSlash as ShieldSlash,
  ShieldCheck as ShieldCheck,
  Prohibit as Prohibit,
  ArrowCounterClockwise as RotateCcw,
  WarningCircle as AlertCircle,
  CheckCircle as CheckCircle2,
  SignIn as SignIn,
  ArrowsDownUp as ArrowsDownUp,
  ArrowUp as ArrowUp,
  ArrowDown as ArrowDown,
  DownloadSimple as Download
} from "@phosphor-icons/react";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from '@/components/ui/dialog';
import type { AdminUser } from '@/types/admin';
import { getAuthToken, getAdminToken, setImpersonationToken, clearAuthTokens } from "@/lib/auth/token";
import { authFetch } from "@/lib/api/authFetch";

const authHeaders = () => {
  const t = getAdminToken() || getAuthToken();
  return { Accept: 'application/json', 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) };
};

const ROLE_COLORS: Record<string, string> = {
  creator: 'bg-blue-500/20 text-blue-400',
  vendor: 'bg-amber-500/20 text-amber-400',
  member: 'bg-muted text-muted-foreground',
};

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-emerald-500/20 text-emerald-400',
  suspended: 'bg-amber-500/20 text-amber-400',
  banned: 'bg-rose-500/20 text-rose-400',
  deleted: 'bg-slate-500/20 text-slate-400',
};

export function AdminUsersPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState(searchParams.get('search') ?? '');
  const [roleFilter, setRoleFilter] = useState(searchParams.get('role') ?? '');
  const [statusFilter, setStatusFilter] = useState(searchParams.get('status') ?? '');
  const [sort, setSort] = useState(searchParams.get('sort') ?? 'created_at');
  const [sortDir, setSortDir] = useState(searchParams.get('sort_dir') ?? 'desc');
  const [actionUser, setActionUser] = useState<AdminUser | null>(null);
  const [actionType, setActionType] = useState<'suspend' | 'activate' | 'ban' | 'restore' | 'verify-kyc' | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [msg, setMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchUsers = useCallback(async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (sort) params.set('sort', sort);
    if (sortDir) params.set('sort_dir', sortDir);
    params.set('page', String(page));
    params.set('per_page', '20');
    setFetchError(null);
    try {
      const res = await authFetch(`/securegate/users?${params}`, { headers: authHeaders() });
      if (res.status === 401) {
        clearAuthTokens();
        window.location.href = '/securegate/login';
        return;
      }
      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        console.error('Users fetch failed:', res.status, errBody);
        setFetchError(`Failed to load users (${res.status}). Check console for details.`);
        return;
      }
      const j = await res.json();
      const raw = j?.data?.data ?? j?.data ?? [];
      setUsers(Array.isArray(raw) ? raw : []);
      setLastPage(j.data?.last_page ?? j.data?.data?.last_page ?? 1);
    } catch (e) {
      console.error('Users fetch error:', e);
      setFetchError('Network error loading users.');
    } finally { setLoading(false); }
  }, [search, roleFilter, statusFilter, sort, sortDir, page]);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  useEffect(() => { setPage(1); }, [search, roleFilter, statusFilter]);

  useEffect(() => {
    const next = new URLSearchParams();
    if (roleFilter) next.set('role', roleFilter);
    if (statusFilter) next.set('status', statusFilter);
    if (search) next.set('search', search);
    if (sort) next.set('sort', sort);
    if (sortDir) next.set('sort_dir', sortDir);
    setSearchParams(next, { replace: true });
  }, [roleFilter, statusFilter, search, sort, sortDir, setSearchParams]);

  const toggleSort = (col: string) => {
    if (sort === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSort(col); setSortDir('asc'); }
  };

  const sortIcon = (col: string) => {
    if (sort !== col) return <ArrowsDownUp weight="fill" className="h-3 w-3 ml-1 opacity-30" />;
    return sortDir === 'asc' ? <ArrowUp weight="fill" className="h-3 w-3 ml-1 text-[#2164b6] dark:text-[#7ab0ff]" /> : <ArrowDown weight="fill" className="h-3 w-3 ml-1 text-[#2164b6] dark:text-[#7ab0ff]" />;
  };

  const handleExport = async () => {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (roleFilter) params.set('role', roleFilter);
    if (statusFilter) params.set('status', statusFilter);
    if (sort) params.set('sort', sort);
    if (sortDir) params.set('sort_dir', sortDir);
    try {
      const res = await authFetch(`/securegate/users/export?${params}`, { headers: { ...authHeaders(), Accept: 'text/csv' } });
      if (!res.ok) return;
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = `users-export-${Date.now()}.csv`; a.click();
      URL.revokeObjectURL(url);
    } catch {}
  };

  const handleAction = async () => {
    if (!actionUser || !actionType) return;
    setSubmitting(true); setMsg(null);
    const body = (actionType === 'activate' || actionType === 'verify-kyc') ? {} : { reason };
    try {
      const res = await authFetch(`/securegate/users/${actionUser.id}/${actionType}`, {
        method: 'POST', headers: authHeaders(), body: JSON.stringify(body),
      });
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      if (res.ok) {
        setMsg({ type: 'success', text: j.message || d?.message || 'Action completed.' });
        toast.success(j.message || d?.message || 'Action completed.');
        setActionUser(null); setActionType(null); setReason('');
        fetchUsers();
      } else {
        const m = j.message || 'Action failed.';
        setMsg({ type: 'error', text: m });
        toast.error(m);
      }
    } catch { setMsg({ type: 'error', text: 'Network error.' }); toast.error('Network error. Please try again.'); }
    setSubmitting(false);
  };

  const handleImpersonate = async (u: AdminUser) => {
    try {
      const res = await authFetch(`/securegate/users/${u.id}/impersonate`, { method: 'POST', headers: authHeaders() });
      const j = await res.json();
      const data = j?.success ? j?.data : j;
      if (!res.ok || !data?.token) {
        const errMsg = data?.message || j?.message || 'Impersonation failed.';
        setMsg({ type: 'error', text: errMsg });
        toast.error(errMsg);
        return;
      }
      setImpersonationToken(data.token, data.user);
      toast.success(`Impersonating ${data.user?.name || u.name}...`);
      window.location.assign('/app');
    } catch {
      setMsg({ type: 'error', text: 'Impersonation failed.' });
      toast.error('Impersonation failed. Please try again.');
    }
  };

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-4 lg:p-10">
      <div>
        <h1 className="text-xl font-black tracking-tight flex items-center gap-2.5">
          <Users weight="fill" className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Users & Creators
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Manage all platform accounts.</p>
      </div>

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 max-w-xs">
          <Search weight="fill" className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input className="pl-8 text-sm" placeholder="Search by name, email, username..." value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
        <Button size="sm" variant="outline" className="h-8 text-[10px] font-bold gap-1.5" onClick={handleExport} title="Export CSV">
          <Download weight="fill" className="h-3.5 w-3.5" /> Export
        </Button>
        {['', 'creator', 'vendor', 'member'].map((r) => (
          <button key={r} onClick={() => setRoleFilter(r)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${roleFilter === r ? 'bg-[#2164b6] text-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{r || 'All Roles'}</button>
        ))}
        <span className="w-px h-5 bg-border mx-1" />
        {['', 'active', 'suspended', 'banned', 'deleted'].map((s) => (
          <button key={s} onClick={() => setStatusFilter(s)} className={`px-2.5 py-1 rounded-lg text-[10px] font-bold transition-colors ${statusFilter === s ? 'bg-[#2164b6] text-foreground' : 'bg-muted text-muted-foreground hover:text-foreground'}`}>{s ? s.charAt(0).toUpperCase() + s.slice(1) : 'All Status'}</button>
        ))}
      </div>

      {fetchError && <div className="p-4 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-start gap-3"><AlertCircle weight="fill" className="h-5 w-5 text-rose-400 shrink-0 mt-0.5" /><div><p className="text-xs font-bold text-rose-400">Error</p><p className="text-xs text-muted-foreground mt-1">{fetchError}</p></div></div>}

      {loading ? <div className="flex justify-center py-16"><Loader2 weight="fill" className="h-8 w-8 animate-spin text-[#2164b6] dark:text-[#7ab0ff]" /></div>
        : users.length === 0 ? <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card"><Users weight="fill" className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" /><h3 className="text-sm font-bold">No users found</h3></div>
        : <div className="border-none rounded-lg bg-card overflow-hidden ">
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/30 border-b border-border">
                  <tr className="text-left">
                    {[
                      { label: 'Name', col: 'name' }, { label: 'Email', col: 'email' }, { label: 'Mobile', col: 'mobile_number' }, { label: 'Username', col: 'username' },
                      { label: 'Role', col: 'role' }, { label: 'Country', col: 'country' }, { label: 'Status', col: 'status' },
                      { label: 'KYC', col: 'kyc_status' }, { label: 'Joined', col: 'created_at' }, { label: '', col: null },
                    ].map(({ label, col }) => (
                      <th key={label || 'actions'} className={`px-4 py-3 text-[10px] font-extrabold text-muted-foreground uppercase tracking-wider whitespace-nowrap ${col ? 'cursor-pointer select-none hover:text-foreground transition-colors' : ''}`} onClick={() => col && toggleSort(col)}>{label}{col && sortIcon(col)}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-muted/10 transition-colors">
                      <td className="px-4 py-3 font-semibold text-foreground whitespace-nowrap">{u.name}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.email || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{u.mobile_number || '-'}</td>
                      <td className="px-4 py-3 text-muted-foreground">{u.username ? `@${u.username}` : <span className="italic text-muted-foreground/60">(deleted)</span>}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ROLE_COLORS[u.role] ?? ''}`}>{u.role}</span></td>
                      <td className="px-4 py-3 text-muted-foreground uppercase font-bold text-[10px]">{u.country || '-'}</td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_COLORS[u.status] ?? ''}`}>{u.status}</span></td>
                      <td className="px-4 py-3"><span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${u.kyc_status === 'verified' ? 'bg-emerald-500/20 text-emerald-400' : u.kyc_status === 'rejected' ? 'bg-rose-500/20 text-rose-400' : 'bg-amber-500/20 text-amber-400'}`}>{u.kyc_status}</span></td>
                      <td className="px-4 py-3 text-muted-foreground whitespace-nowrap">{new Date(u.created_at).toLocaleDateString()}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-1">
                          {u.role !== 'admin' && u.status === 'active' && (
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-[#2164b6] dark:text-[#7ab0ff]" onClick={() => handleImpersonate(u)} title={`Sign in as ${u.name}`}>
                              <SignIn weight="fill" className="h-3 w-3" />
                            </Button>
                          )}
                          {u.kyc_status !== 'verified' && (
                            <Button size="sm" variant="ghost" className="h-7 text-[10px] text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10" onClick={() => { setActionUser(u); setActionType('verify-kyc'); setMsg(null); }} title="Manually verify KYC">
                              <ShieldCheck weight="fill" className="h-3.5 w-3.5" />
                            </Button>
                          )}
                          {u.status === 'active' && <Button size="sm" variant="ghost" className="h-7 text-[10px] text-amber-600" onClick={() => { setActionUser(u); setActionType('suspend'); setReason(''); setMsg(null); }} title="Suspend user"><ShieldSlash weight="fill" className="h-3 w-3" /></Button>}
                          {u.status === 'suspended' && <Button size="sm" variant="ghost" className="h-7 text-[10px] text-emerald-600" onClick={() => { setActionUser(u); setActionType('activate'); setMsg(null); }} title="Activate user"><ShieldCheck weight="fill" className="h-3 w-3" /></Button>}
                          {u.status === 'deleted' && <Button size="sm" variant="ghost" className="h-7 text-[10px] text-blue-500" onClick={() => { setActionUser(u); setActionType('restore'); setMsg(null); }} title="Restore deleted account"><RotateCcw weight="fill" className="h-3 w-3" /></Button>}
                          {u.status !== 'banned' && u.status !== 'deleted' && <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => { setActionUser(u); setActionType('ban'); setReason(''); setMsg(null); }} title="Prohibit user"><Prohibit weight="fill" className="h-3 w-3" /></Button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>}

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2 pt-4">
          <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1} className="px-3 py-1.5 rounded-lg text-xs font-bold border-none bg-card hover:bg-muted disabled:opacity-40">Previous</button>
          <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
          <button onClick={() => setPage(p => Math.min(lastPage, p + 1))} disabled={page >= lastPage} className="px-3 py-1.5 rounded-lg text-xs font-bold border-none bg-card hover:bg-muted disabled:opacity-40">Next</button>
        </div>
      )}

      <Dialog open={actionType !== null} onOpenChange={() => { setActionType(null); setMsg(null); }}>
        <DialogContent className="sm:max-w-lg md:max-w-xl bg-card border-border shadow-2xl rounded-lg p-4 sm:p-5">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              {actionType === 'suspend' && <><ShieldSlash weight="fill" className="h-5 w-5 text-amber-500" /> Suspend User</>}
              {actionType === 'activate' && <><ShieldCheck weight="fill" className="h-5 w-5 text-emerald-500" /> Activate User</>}
              {actionType === 'verify-kyc' && <><ShieldCheck weight="fill" className="h-5 w-5 text-emerald-500" /> Manually Verify KYC</>}
              {actionType === 'ban' && <><Prohibit weight="fill" className="h-5 w-5 text-destructive" /> Prohibit User</>}
              {actionType === 'restore' && <><RotateCcw weight="fill" className="h-5 w-5 text-blue-500" /> Restore Deleted Account</>}
            </DialogTitle>
            <DialogDescription className="text-xs">{actionUser?.name} ({actionUser?.email})</DialogDescription>
          </DialogHeader>
          {msg && <div className={`p-3 rounded-lg text-xs font-bold flex items-center gap-2 ${msg.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{msg.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle weight="fill" className="h-4 w-4 shrink-0" />}{msg.text}</div>}
          {actionType === 'restore' && !msg && (
            <p className="text-xs text-muted-foreground">This will restore the user account to active status and enable sign-in again.</p>
          )}
          {actionType === 'verify-kyc' && !msg && (
            <p className="text-xs text-muted-foreground">This will manually verify this user's KYC status and grant verified privileges including hosting live video and audio streams.</p>
          )}
          {actionType !== 'activate' && actionType !== 'restore' && actionType !== 'verify-kyc' && (
            <textarea className="w-full min-h-[80px] rounded-lg border-none bg-card p-3 text-xs font-medium text-foreground placeholder:text-muted-foreground resize-none" placeholder="Reason for this action..." value={reason} onChange={(e) => setReason(e.target.value)} />
          )}
          {!msg && <Button disabled={submitting || (actionType !== 'activate' && actionType !== 'restore' && actionType !== 'verify-kyc' && !reason)} onClick={handleAction} className="w-full text-sm font-bold">{submitting ? <Loader2 weight="fill" className="h-4 w-4 animate-spin mr-2" /> : null}{actionType === 'suspend' ? 'Suspend' : actionType === 'activate' ? 'Activate' : actionType === 'restore' ? 'Restore Account' : actionType === 'verify-kyc' ? 'Verify KYC' : 'Prohibit'}</Button>}
        </DialogContent>
      </Dialog>
    </div>
  );
}
