import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { Building2, Search, Loader2, Trash2, Eye, Globe, Lock, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";


const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return { 'Content-Type': 'application/json', Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface CommunitySummary {
  id: number; name: string; slug: string; category: string;
  visibility: string; members_count: number; active_members_count: number;
  created_at: string;
  creator: { id: number; name: string; username: string; avatar: string | null } | null;
}

export function AdminCommunitiesPage() {
  const confirm = useConfirm();
  const [communities, setCommunities] = useState<CommunitySummary[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [visibility, setVisibility] = useState('');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);

  const fetchCommunities = useCallback(async () => {
    setFetchError(null);
    try {
      const params = new URLSearchParams({ page: String(page), per_page: '20' });
      if (search) params.set('search', search);
      if (visibility) params.set('visibility', visibility);
      const res = await fetch(`${API_BASE}/securegate/communities?${params}`, { headers: getAuthHeaders() });
      if (res.ok) { const j = await res.json(); setCommunities(j.data?.data?.data ?? []); setStats(j.data?.stats ?? null); setLastPage(j.data?.data?.last_page ?? 1); }
      else throw new Error(`HTTP ${res.status}`);
    } catch (e) { setFetchError(e instanceof Error ? e.message : 'Failed to load communities'); }
    finally { setIsLoading(false); }
  }, [page, search, visibility]);

  useEffect(() => { fetchCommunities(); }, [fetchCommunities]);

  async function deleteCommunity(id: number, name: string) {
    if (!await confirm({ title: `Delete "${name}"`, message: 'This also removes all memberships. Cannot be undone.', variant: 'destructive' })) return;
    try {
      const res = await fetch(`${API_BASE}/securegate/communities/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      if (res.ok) { setMessage({ type: 'success', text: `"${name}" deleted.` }); toast.success(`"${name}" deleted.`); fetchCommunities(); }
      else { const j = await res.json(); const m = j.message ?? 'Failed.'; setMessage({ type: 'error', text: m }); toast.error(m); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); toast.error('Network error while deleting community.'); }
  }

  if (isLoading) {
    return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>;
  }

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <span className="px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">Admin</span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Communities</h1>
          <p className="text-sm text-white/70 max-w-xl">Manage all communities on the platform.</p>
        </div>
      </div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setIsLoading(true); fetchCommunities(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
        }`}>{message.text}</div>
      )}

      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'Total', value: stats.total, color: 'text-[#38A8D8]' },
            { label: 'Public', value: stats.public, color: 'text-emerald-500' },
            { label: 'Private', value: stats.private, color: 'text-amber-500' },
            { label: 'Categories', value: stats.categories?.length ?? 0, color: 'text-muted-foreground' },
          ].map(s => (
            <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center">
              <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} placeholder="Search communities..." className="pl-9 text-sm" />
        </div>
        {['', 'public', 'private'].map(v => (
          <button key={v} onClick={() => { setVisibility(v); setPage(1); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${visibility === v ? 'bg-[#38A8D8] text-foreground' : 'bg-white/[0.05] text-muted-foreground hover:text-foreground'}`}
          >{v ? v.charAt(0).toUpperCase() + v.slice(1) : 'All'}</button>
        ))}
      </div>

      {communities.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
          <Building2 className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-base font-semibold text-foreground">No communities found</h3>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="divide-y divide-border/50">
            {communities.map(c => (
              <div key={c.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <div className="p-2 rounded-xl bg-[#38A8D8]/10 text-[#38A8D8] shrink-0">
                    <Building2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-bold text-foreground truncate">{c.name}</p>
                      {c.visibility === 'private' ? <Lock className="h-3 w-3 text-amber-500" /> : <Globe className="h-3 w-3 text-emerald-500" />}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      by @{c.creator?.username ?? 'unknown'} · {c.category} · {c.active_members_count ?? c.members_count} members
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0 ml-4">
                  <Button variant="ghost" size="icon" onClick={() => window.open(`/app/communities/${c.slug}`, '_blank')} title="View">
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteCommunity(c.id, c.name)} title="Delete">
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {lastPage > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
          <span className="text-xs text-muted-foreground">Page {page} of {lastPage}</span>
          <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage(p => p + 1)}>Next</Button>
        </div>
      )}
    </div>
  );
}
