import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { Link2, Plus, Loader2, Users, MousePointerClick, ShoppingBag, Copy, Check, ExternalLink, Power, PowerOff, Gift, RefreshCw, Sparkles } from 'lucide-react';
import { authFetch } from "@/lib/api/authFetch";





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
        authFetch(`/referrals/program`, {  }),
        authFetch(`/referrals/links`, {  }),
        authFetch(`/referrals/stats`, {  }),
        authFetch(`/referrals`, {  }),
      ]);
      if (pgRes.ok) { 
        const j = await pgRes.json(); 
        setProgram(j.data?.data ?? { id: 0, is_active: true, reward_type: 'percentage', reward_value: 10, description: null }); 
      }
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
      const res = await authFetch(`/referrals/program`, {
        method: 'PUT', 
        body: JSON.stringify({
          is_active: program?.is_active ?? true,
          reward_type: program?.reward_type ?? 'percentage',
          reward_value: program?.reward_value ?? 10,
          description: program?.description,
        }),
      });
      if (res.ok) { await fetchAll(); setMessage({ type: 'success', text: 'Program updated successfully!' }); }
      else { const j = await res.json(); setMessage({ type: 'error', text: j.message ?? 'Failed to update program.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error. Please try again.' }); }
    setSaving(false);
    setTimeout(() => setMessage(null), 3000);
  }

  async function createLink() {
    setMessage(null);
    try {
      const body = newCode.trim() ? { code: newCode.trim() } : {};
      const res = await authFetch(`/referrals/links`, {
        method: 'POST',  body: JSON.stringify(body),
      });
      if (res.ok) { await fetchAll(); setNewCode(''); setMessage({ type: 'success', text: 'Link created successfully!' }); }
      else { const j = await res.json(); setMessage({ type: 'error', text: j.message ?? 'Failed to create link.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error. Please try again.' }); }
    setTimeout(() => setMessage(null), 3000);
  }

  async function toggleLink(id: number) {
    try {
      const res = await authFetch(`/referrals/links/${id}/toggle`, { method: 'POST',  });
      await fetchAll();
      if (!res.ok) setMessage({ type: 'error', text: 'Failed to toggle link.' });
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    setTimeout(() => setMessage(null), 3000);
  }

  async function deleteLink(id: number) {
    if (!await confirm({ title: 'Delete Referral Link', message: 'Are you sure you want to delete this referral link? This action cannot be undone.', variant: 'destructive' })) return;
    try {
      const res = await authFetch(`/referrals/links/${id}`, { method: 'DELETE',  });
      await fetchAll();
      if (res.ok) setMessage({ type: 'success', text: 'Link deleted successfully!' });
      else setMessage({ type: 'error', text: 'Failed to delete link.' });
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    setTimeout(() => setMessage(null), 3000);
  }

  function copyUrl(url: string) {
    navigator.clipboard.writeText(url);
    setCopied(url);
    setTimeout(() => setCopied(null), 2000);
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-xl bg-[#2164b6]/20 animate-pulse"></div>
          <Loader2 className="h-10 w-10 animate-spin text-[#2164b6] relative z-10" />
        </div>
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading referral program...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-6 lg:p-8 animate-in fade-in duration-500">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Grow Your Audience
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            Referral & Affiliates
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Incentivize your community to share your content. Create custom tracking links, set commission structures, and watch your audience multiply.
          </p>
        </div>
      </div>

      {message && (
        <div className={`p-4 rounded-xl border text-sm font-bold flex items-center gap-2 animate-in slide-in-from-top-2 ${
          message.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-500' : 'bg-rose-500/10 border-rose-500/20 text-rose-500'
        }`}>
          {message.type === 'success' ? <Check className="w-4 h-4" /> : null}
          {message.text}
        </div>
      )}

      {/* Modern Tab Bar */}
      <div className="flex gap-2 p-1.5 bg-muted/50 backdrop-blur-md rounded-2xl w-fit border border-border/50 shadow-inner">
        {TABS.map((t) => (
          <button 
            key={t} 
            onClick={() => setTab(t)}
            className={`px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300 capitalize relative ${
              tab === t 
                ? 'bg-background text-foreground shadow-sm border border-border/50 scale-100' 
                : 'text-muted-foreground hover:text-foreground hover:bg-background/50 scale-95 hover:scale-100 border border-transparent'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ──────────── Overview Tab ──────────── */}
      {tab === 'overview' && (
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          {/* Glassmorphic Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
            {[
              { icon: MousePointerClick, label: 'Total Clicks', value: stats?.total_clicks ?? 0, color: 'text-blue-500', bg: 'bg-blue-500/10' },
              { icon: Users, label: 'Signups', value: stats?.total_signups ?? 0, color: 'text-emerald-500', bg: 'bg-emerald-500/10' },
              { icon: ShoppingBag, label: 'Purchases', value: stats?.total_purchases ?? 0, color: 'text-purple-500', bg: 'bg-purple-500/10' },
              { icon: RefreshCw, label: 'Conversion', value: `${stats?.conversion_rate ?? 0}%`, color: 'text-amber-500', bg: 'bg-amber-500/10' },
              { icon: Gift, label: 'Pending Rewards', value: formatPrice(stats?.pending_rewards ?? 0), color: 'text-rose-500', bg: 'bg-rose-500/10' },
            ].map((s) => (
              <div key={s.label} className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-5 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 hover:bg-card">
                <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-3xl opacity-20 -mr-10 -mt-10 transition-opacity group-hover:opacity-40 ${s.bg}`}></div>
                <div className="relative z-10 space-y-3">
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${s.bg} ${s.color}`}>
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-2xl font-black text-foreground">{s.value}</p>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">{s.label}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Settings Form */}
          <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-6 md:p-8 shadow-sm">
            <div className="mb-6">
              <h2 className="text-lg font-bold text-foreground">Program Configuration</h2>
              <p className="text-sm text-muted-foreground">Define how affiliates and referrers are rewarded for bringing you business.</p>
            </div>
            
            <form onSubmit={saveProgram} className="space-y-6 max-w-3xl">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">Reward Type</label>
                  <div className="relative">
                    <select 
                      value={program?.reward_type ?? 'percentage'}
                      onChange={e => setProgram(p => p ? { ...p, reward_type: e.target.value } : null)}
                      className="w-full appearance-none rounded-xl border border-border/50 bg-background px-4 py-3 text-sm font-medium text-foreground focus:ring-2 focus:ring-[#2164b6]/50 focus:border-[#2164b6] transition-all"
                    >
                      {REWARD_TYPES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                    </select>
                    <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-muted-foreground">
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-2">
                  <label className="text-sm font-bold text-foreground">Reward Value</label>
                  <div className="relative">
                    <input 
                      type="number" min="1" 
                      value={program?.reward_value ?? 10}
                      onChange={e => setProgram(p => p ? { ...p, reward_value: Number(e.target.value) } : null)}
                      className="w-full rounded-xl border border-border/50 bg-background px-4 py-3 text-sm font-medium text-foreground focus:ring-2 focus:ring-[#2164b6]/50 focus:border-[#2164b6] transition-all pl-12" 
                    />
                    <div className="absolute inset-y-0 left-0 flex items-center pl-4 text-muted-foreground font-bold">
                      {program?.reward_type === 'percentage' ? '%' : program?.reward_type === 'fixed' ? '₦' : '★'}
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2">
                <label className="text-sm font-bold text-foreground">Program Description <span className="text-muted-foreground font-normal">(Visible to Affiliates)</span></label>
                <textarea 
                  value={program?.description ?? ''}
                  onChange={e => setProgram(p => p ? { ...p, description: e.target.value } : null)}
                  rows={3} 
                  className="w-full rounded-xl border border-border/50 bg-background p-4 text-sm font-medium text-foreground resize-none placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-[#2164b6]/50 focus:border-[#2164b6] transition-all" 
                  placeholder="e.g. Earn 20% on all course sales you refer. Payouts happen every Friday." 
                />
              </div>
              
              <div className="pt-4 flex items-center justify-between border-t border-border/50">
                <label className="flex items-center gap-3 cursor-pointer group">
                  <div className="relative flex items-center">
                    <input 
                      type="checkbox" 
                      checked={program?.is_active ?? true}
                      onChange={e => setProgram(p => p ? { ...p, is_active: e.target.checked } : null)}
                      className="peer sr-only" 
                    />
                    <div className="h-6 w-11 rounded-full bg-muted-foreground/30 peer-checked:bg-[#2164b6] transition-colors shadow-inner"></div>
                    <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5 shadow-sm"></div>
                  </div>
                  <div>
                    <span className="text-sm font-bold text-foreground group-hover:text-[#2164b6] transition-colors">Program Active</span>
                    <p className="text-[10px] text-muted-foreground">Toggle to pause new referrals.</p>
                  </div>
                </label>
                
                <button 
                  type="submit" 
                  disabled={saving}
                  className="px-8 py-3 rounded-xl bg-gradient-to-r from-[#2164b6] to-[#1a5091] text-white text-sm font-bold hover:shadow-lg hover:shadow-[#2164b6]/25 transition-all duration-300 disabled:opacity-50 hover:-translate-y-0.5 active:translate-y-0 flex items-center gap-2"
                >
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />} 
                  Save Configuration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ──────────── Links Tab ──────────── */}
      {tab === 'links' && (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
          
          <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl p-6 shadow-sm">
            <h2 className="text-lg font-bold text-foreground mb-4">Generate New Link</h2>
            <div className="flex flex-col sm:flex-row gap-3">
              <div className="relative flex-1">
                <div className="absolute inset-y-0 left-0 flex items-center pl-4 pointer-events-none">
                  <span className="text-muted-foreground text-sm font-mono">murihspace.com/ref/</span>
                </div>
                <input 
                  value={newCode} 
                  onChange={e => setNewCode(e.target.value)}
                  placeholder="custom-code (optional)"
                  className="w-full rounded-xl border border-border/50 bg-background py-3 pl-[150px] pr-4 text-sm font-mono text-foreground placeholder:text-muted-foreground/50 focus:ring-2 focus:ring-[#2164b6]/50 focus:border-[#2164b6] transition-all" 
                />
              </div>
              <button 
                onClick={createLink}
                className="flex items-center justify-center gap-2 px-8 py-3 rounded-xl bg-[#2164b6] text-white text-sm font-bold hover:bg-[#1a5091] hover:shadow-lg transition-all duration-300 whitespace-nowrap"
              >
                <Plus className="h-4 w-4" /> Generate
              </button>
            </div>
          </div>

          {links.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-4 py-24 rounded-2xl border border-dashed border-border/50 bg-card/20">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-2">
                <Link2 className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">No tracking links yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm">Generate a unique referral link above and share it with your audience to start earning.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {links.map(l => (
                <div key={l.id} className="group flex flex-col rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden hover:border-[#2164b6]/50 transition-all duration-300">
                  <div className="p-5 flex-1 space-y-4">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <span className="font-mono text-lg font-bold text-foreground block">{l.code}</span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-bold mt-1.5 uppercase tracking-wider ${
                          l.is_active ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted-foreground/10 text-muted-foreground'
                        }`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${l.is_active ? 'bg-emerald-500' : 'bg-muted-foreground'}`}></span>
                          {l.is_active ? 'Active' : 'Paused'}
                        </span>
                      </div>
                      
                      <div className="flex flex-col gap-1">
                        <button onClick={() => toggleLink(l.id)} className="p-2 hover:bg-background rounded-xl transition-colors text-muted-foreground hover:text-foreground" title={l.is_active ? 'Deactivate Link' : 'Activate Link'}>
                          {l.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                        </button>
                        <button onClick={() => deleteLink(l.id)} className="p-2 hover:bg-rose-500/10 rounded-xl transition-colors text-muted-foreground hover:text-rose-500" title="Delete Link">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3 pt-2">
                      <div className="bg-background rounded-xl p-3 border border-border/50">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Clicks</p>
                        <p className="text-xl font-black text-foreground">{l.clicks}</p>
                      </div>
                      <div className="bg-background rounded-xl p-3 border border-border/50">
                        <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-wider mb-1">Conversions</p>
                        <p className="text-xl font-black text-emerald-500">{l.referrals_count}</p>
                      </div>
                    </div>
                  </div>
                  
                  <div className="bg-background border-t border-border/50 p-3 flex items-center justify-between gap-3">
                    <div className="text-[11px] text-muted-foreground font-mono truncate px-2">{l.url}</div>
                    <div className="flex items-center shrink-0 gap-1">
                      <button onClick={() => window.open(l.url, '_blank')} className="p-2 rounded-lg bg-card border border-border/50 hover:border-[#2164b6]/50 hover:text-[#2164b6] transition-colors">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => copyUrl(l.url)} className="p-2 rounded-lg bg-[#2164b6] text-white hover:bg-[#1a5091] transition-colors flex items-center gap-1.5 min-w-[70px] justify-center">
                        {copied === l.url ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                        <span className="text-[10px] font-bold">{copied === l.url ? 'Copied' : 'Copy'}</span>
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ──────────── Activity Tab ──────────── */}
      {tab === 'activity' && (
        <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
          {referrals.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center gap-4 py-24 rounded-2xl border border-dashed border-border/50 bg-card/20">
              <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-2">
                <Users className="h-8 w-8 text-muted-foreground" />
              </div>
              <h2 className="text-xl font-bold text-foreground">No referral activity yet</h2>
              <p className="text-sm text-muted-foreground max-w-sm">When users click your links and sign up or purchase, the activity will appear here in real-time.</p>
            </div>
          ) : (
            <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                  <thead className="bg-background/50 border-b border-border/50">
                    <tr>
                      <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Event</th>
                      <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">User / Source</th>
                      <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-xs font-bold text-muted-foreground uppercase tracking-wider text-right">Reward</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border/50">
                    {referrals.map(r => (
                      <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                        <td className="px-6 py-4">
                          <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold uppercase tracking-wider ${
                            r.type === 'purchase' ? 'bg-purple-500/10 text-purple-500 border border-purple-500/20' :
                            r.type === 'signup' ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20' :
                            'bg-background text-muted-foreground border border-border/50'
                          }`}>
                            {r.type === 'purchase' ? <ShoppingBag className="w-3 h-3" /> : <Users className="w-3 h-3" />}
                            {r.type}
                          </span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex flex-col">
                            {r.referred_user ? (
                              <span className="font-bold text-foreground">{r.referred_user.name}</span>
                            ) : (
                              <span className="font-medium text-muted-foreground">Anonymous User</span>
                            )}
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[10px] text-muted-foreground">via link:</span>
                              <span className="font-mono text-[10px] font-bold bg-background px-1.5 py-0.5 rounded border border-border/50">{r.code}</span>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 text-xs text-muted-foreground">
                          {new Date(r.created_at).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })}
                        </td>
                        <td className="px-6 py-4 text-right">
                          {r.reward_amount != null ? (
                            <div className="flex flex-col items-end">
                              <span className="text-sm font-black text-emerald-500">{formatPrice(r.reward_amount)}</span>
                              <span className={`text-[10px] font-bold uppercase mt-0.5 ${r.reward_paid ? 'text-muted-foreground' : 'text-amber-500'}`}>
                                {r.reward_paid ? 'Paid' : 'Pending'}
                              </span>
                            </div>
                          ) : (
                            <span className="text-xs text-muted-foreground">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
