import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { Link2, Plus, Loader2, Users, MousePointerClick, ShoppingBag, Copy, Check, ExternalLink, Power, PowerOff, Gift, RefreshCw } from 'lucide-react';
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatPrice(cents: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const sym = symbols[currency] ?? currency + ' ';
  return sym + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

interface ReferralProgram {
  id: number; is_active: boolean; reward_type: string;
  reward_value: number; description: string | null;
}

interface ReferralLink {
  id: number; code: string; url: string;
  clicks: number; referrals_count: number;
  is_active: boolean; created_at: string;
  program: { reward_type: string; reward_value: number } | null;
}

interface ReferralStats {
  total_clicks: number; total_signups: number; total_purchases: number;
  total_rewards: number; pending_rewards: number; conversion_rate: number;
}

interface ReferralRow {
  id: number; type: string; code: string | null;
  referred_user: { name: string; username: string } | null;
  reward_amount: number | null; reward_paid: boolean;
  converted_at: string | null; created_at: string;
}

const TABS = ['overview', 'links', 'activity'] as const;

const REWARD_TYPES = [
  { value: 'percentage', label: 'Percentage (%)' },
  { value: 'fixed', label: 'Fixed Amount' },
  { value: 'credit', label: 'Credit' },
];

export function ReferralsPage() {
  const confirm = useConfirm();
  const [tab, setTab] = useState<'overview' | 'links' | 'activity'>('overview');
  const [program, setProgram] = useState<ReferralProgram | null>(null);
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [pgRes, lkRes, stRes, rfRes] = await Promise.all([
        fetch(`${API_BASE}/referrals/program`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/referrals/links`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/referrals/stats`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/referrals`, { headers: getAuthHeaders() }),
      ]);
      if (pgRes.ok) { const j = await pgRes.json(); setProgram(j.data?.data ?? null); }
      if (lkRes.ok) { const j = await lkRes.json(); setLinks(j.data?.data ?? []); }
      if (stRes.ok) { const j = await stRes.json(); setStats(j.data?.data ?? null); }
      if (rfRes.ok) { const j = await rfRes.json(); setReferrals(j.data?.data ?? []); }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  async function saveProgram(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null); setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/referrals/program`, {
        method: 'PUT', headers: getAuthHeaders(),
        body: JSON.stringify({
          is_active: program?.is_active ?? true,
          reward_type: program?.reward_type ?? 'percentage',
          reward_value: program?.reward_value ?? 10,
          description: program?.description,
        }),
      });
      if (res.ok) { await fetchAll(); setMessage({ type: 'success', text: 'Program updated.' }); }
      else { const j = await res.json(); setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    setSaving(false);
  }

  async function createLink() {
    setMessage(null);
    try {
      const body = newCode.trim() ? { code: newCode.trim() } : {};
      const res = await fetch(`${API_BASE}/referrals/links`, {
        method: 'POST', headers: getAuthHeaders(), body: JSON.stringify(body),
      });
      if (res.ok) { await fetchAll(); setNewCode(''); setMessage({ type: 'success', text: 'Link created.' }); }
      else { const j = await res.json(); setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  async function toggleLink(id: number) {
    try {
      await fetch(`${API_BASE}/referrals/links/${id}/toggle`, { method: 'POST', headers: getAuthHeaders() });
      await fetchAll();
    } catch { /* ignore */ }
  }

  async function deleteLink(id: number) {
    if (!await confirm({ title: 'Delete Referral Link', message: 'Delete this referral link?', variant: 'destructive' })) return;
    try {
      await fetch(`${API_BASE}/referrals/links/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      await fetchAll();
      setMessage({ type: 'success', text: 'Link deleted.' });
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  }

  if (isLoading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;
  }

  const msgBg = message?.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400';

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <Link2 className="h-6 w-6 text-[#38A8D8]" /> Referral & Affiliates
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Create referral links, track commissions, and grow your audience.</p>
      </div>

      {/* Tab bar */}
      <div className="flex gap-1 bg-muted p-1 rounded-xl w-fit">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-xs font-bold transition capitalize ${
              tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}>
            {t}
          </button>
        ))}
      </div>

      {message && (
        <div className={`p-3 rounded-xl border text-xs font-bold ${msgBg}`}>{message.text}</div>
      )}

      {/* ──────────── Overview Tab ──────────── */}
      {tab === 'overview' && (
        <div className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {[
              { icon: MousePointerClick, label: 'Clicks', value: stats?.total_clicks ?? 0, color: '#38A8D8' },
              { icon: Users, label: 'Signups', value: stats?.total_signups ?? 0, color: '#10b981' },
              { icon: ShoppingBag, label: 'Purchases', value: stats?.total_purchases ?? 0, color: '#8b5cf6' },
              { icon: RefreshCw, label: 'Conversion', value: `${stats?.conversion_rate ?? 0}%`, color: '#f59e0b' },
              { icon: Gift, label: 'Pending Rewards', value: formatPrice(stats?.pending_rewards ?? 0), color: '#10b981' },
            ].map((s) => (
              <div key={s.label} className="rounded-xl border border-border bg-card p-4 text-center space-y-1">
                <s.icon className="h-5 w-5 mx-auto" style={{ color: s.color }} />
                <p className="text-lg font-black text-foreground">{s.value}</p>
                <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-wider">{s.label}</p>
              </div>
            ))}
          </div>

          {/* Program Settings */}
          <div className="rounded-xl border border-border bg-card p-6 space-y-4">
            <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Program Settings</h2>
            <form onSubmit={saveProgram} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Reward Type</label>
                  <select value={program?.reward_type ?? 'percentage'}
                    onChange={e => setProgram(p => p ? { ...p, reward_type: e.target.value } : null)}
                    className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-foreground">
                    {REWARD_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-muted-foreground">Reward Value</label>
                  <input type="number" min="1" value={program?.reward_value ?? 10}
                    onChange={e => setProgram(p => p ? { ...p, reward_value: Number(e.target.value) } : null)}
                    className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-foreground" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-muted-foreground">Description</label>
                <textarea value={program?.description ?? ''}
                  onChange={e => setProgram(p => p ? { ...p, description: e.target.value } : null)}
                  rows={2} className="w-full rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-foreground resize-none placeholder:text-muted-foreground" placeholder="Describe your referral program..." />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={program?.is_active ?? true}
                  onChange={e => setProgram(p => p ? { ...p, is_active: e.target.checked } : null)}
                  className="accent-[#38A8D8]" />
                <span className="text-xs font-bold text-foreground">Program active</span>
              </label>
              <button type="submit" disabled={saving}
                className="px-6 py-2 rounded-xl bg-[#38A8D8] text-white text-xs font-bold hover:bg-[#2e8ab8] transition-colors disabled:opacity-50">
                {saving ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : null} Save Settings
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ──────────── Links Tab ──────────── */}
      {tab === 'links' && (
        <div className="space-y-4">
          {/* Create Link */}
          <div className="flex gap-2">
            <input value={newCode} onChange={e => setNewCode(e.target.value)}
              placeholder="Custom code (optional, e.g. 'summer2026')"
              className="flex-1 rounded-xl border border-border bg-card p-2.5 text-xs font-medium text-foreground placeholder:text-muted-foreground" />
            <button onClick={createLink}
              className="flex items-center gap-2 px-4 py-2 rounded-xl bg-[#38A8D8] text-white text-xs font-bold hover:bg-[#2e8ab8] transition-colors">
              <Plus className="h-4 w-4" /> Create
            </button>
          </div>

          {links.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-4 py-16">
              <Link2 className="h-16 w-16 text-muted-foreground/30" />
              <h2 className="text-lg font-bold text-foreground">No referral links</h2>
              <p className="text-xs text-muted-foreground">Create a referral link to start tracking referrals.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map(l => (
                <div key={l.id} className="rounded-xl border border-border bg-card p-4 space-y-2">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-foreground">{l.code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        l.is_active ? 'bg-emerald-500/10 text-emerald-400' : 'bg-muted text-muted-foreground'
                      }`}>{l.is_active ? 'Active' : 'Inactive'}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => copyUrl(l.url)} className="p-1.5 hover:bg-muted rounded-lg" title="Copy link">
                        {copied === l.url ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                      <button onClick={() => toggleLink(l.id)} className="p-1.5 hover:bg-muted rounded-lg" title={l.is_active ? 'Deactivate' : 'Activate'}>
                        {l.is_active ? <PowerOff className="h-3.5 w-3.5 text-amber-400" /> : <Power className="h-3.5 w-3.5 text-muted-foreground" />}
                      </button>
                      <button onClick={() => window.open(l.url, '_blank')} className="p-1.5 hover:bg-muted rounded-lg">
                        <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                      </button>
                      <button onClick={() => deleteLink(l.id)} className="p-1.5 hover:bg-muted rounded-lg text-destructive text-sm font-bold">
                        X
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-[10px] text-muted-foreground">
                    <span>{l.clicks} clicks</span>
                    <span>{l.referrals_count} referrals</span>
                    <span>{new Date(l.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground/60 font-mono truncate">{l.url}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──────────── Activity Tab ──────────── */}
      {tab === 'activity' && (
        referrals.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-4 py-16">
            <Users className="h-16 w-16 text-muted-foreground/30" />
            <h2 className="text-lg font-bold text-foreground">No activity yet</h2>
            <p className="text-xs text-muted-foreground">Referral activity will appear here.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-card divide-y divide-border overflow-hidden">
            {referrals.map(r => (
              <div key={r.id} className="px-4 py-3 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    r.type === 'purchase' ? 'bg-purple-500/10 text-purple-400' :
                    r.type === 'signup' ? 'bg-emerald-500/10 text-emerald-400' :
                    'bg-muted text-muted-foreground'
                  }`}>{r.type}</span>
                  <div className="min-w-0 text-xs">
                    <span className="font-bold text-foreground">{r.code}</span>
                    {r.referred_user && <span className="text-muted-foreground ml-1">→ @{r.referred_user.username}</span>}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  {r.reward_amount != null && <span className="text-xs font-bold text-foreground">{formatPrice(r.reward_amount)}</span>}
                  <p className="text-[10px] text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
