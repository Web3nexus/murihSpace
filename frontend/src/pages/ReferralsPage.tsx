import { useState, useEffect, useCallback } from 'react';
import { Link2, Plus, Loader2, Users, MousePointerClick, ShoppingBag, Copy, Check, ExternalLink, Power, PowerOff } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('murihspace-token');
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

export function ReferralsPage() {
  const [tab, setTab] = useState<'overview' | 'links' | 'activity'>('overview');
  const [program, setProgram] = useState<ReferralProgram | null>(null);
  const [links, setLinks] = useState<ReferralLink[]>([]);
  const [stats, setStats] = useState<ReferralStats | null>(null);
  const [referrals, setReferrals] = useState<ReferralRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [newCode, setNewCode] = useState('');

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
    setMessage(null);
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
    if (!confirm('Delete this referral link?')) return;
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
    return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const tabStyle = (t: string) => `px-5 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`;

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex items-center gap-3 mb-6">
        <Link2 className="w-6 h-6" />
        <h1 className="text-2xl font-bold">Referral & Affiliates</h1>
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('overview')} className={tabStyle('overview')}>Overview</button>
        <button onClick={() => setTab('links')} className={tabStyle('links')}>Referral Links</button>
        <button onClick={() => setTab('activity')} className={tabStyle('activity')}>Activity</button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Tab: Overview */}
      {tab === 'overview' && (
        <>
          {/* Stats */}
          <div className="grid grid-cols-3 sm:grid-cols-5 gap-3 mb-8">
            <div className="bg-white border rounded-xl p-4 text-center">
              <MousePointerClick className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold">{stats?.total_clicks ?? 0}</p>
              <p className="text-xs text-gray-500">Clicks</p>
            </div>
            <div className="bg-white border rounded-xl p-4 text-center">
              <Users className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
              <p className="text-2xl font-bold">{stats?.total_signups ?? 0}</p>
              <p className="text-xs text-gray-500">Signups</p>
            </div>
            <div className="bg-white border rounded-xl p-4 text-center">
              <ShoppingBag className="w-5 h-5 mx-auto mb-1 text-purple-500" />
              <p className="text-2xl font-bold">{stats?.total_purchases ?? 0}</p>
              <p className="text-xs text-gray-500">Purchases</p>
            </div>
            <div className="bg-white border rounded-xl p-4 text-center">
              <p className="text-2xl font-bold text-amber-600">{stats?.conversion_rate ?? 0}%</p>
              <p className="text-xs text-gray-500">Conversion</p>
            </div>
            <div className="bg-white border rounded-xl p-4 text-center">
              <p className="text-lg font-bold text-emerald-600">{formatPrice(stats?.pending_rewards ?? 0)}</p>
              <p className="text-xs text-gray-500">Pending Rewards</p>
            </div>
          </div>

          {/* Program Settings */}
          <div className="bg-white border rounded-xl p-6">
            <h2 className="font-semibold mb-4">Program Settings</h2>
            <form onSubmit={saveProgram} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Reward Type</label>
                  <select
                    value={program?.reward_type ?? 'percentage'}
                    onChange={e => setProgram(p => p ? { ...p, reward_type: e.target.value } : null)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="percentage">Percentage (%)</option>
                    <option value="fixed">Fixed Amount</option>
                    <option value="credit">Credit</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Reward Value</label>
                  <input
                    type="number" min="1"
                    value={program?.reward_value ?? 10}
                    onChange={e => setProgram(p => p ? { ...p, reward_value: Number(e.target.value) } : null)}
                    className="w-full border rounded-lg px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <textarea
                  value={program?.description ?? ''}
                  onChange={e => setProgram(p => p ? { ...p, description: e.target.value } : null)}
                  rows={2} className="w-full border rounded-lg px-3 py-2 text-sm"
                />
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={program?.is_active ?? true}
                  onChange={e => setProgram(p => p ? { ...p, is_active: e.target.checked } : null)} />
                <span className="text-sm">Program active</span>
              </label>
              <button type="submit" className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
                Save Settings
              </button>
            </form>
          </div>
        </>
      )}

      {/* Tab: Links */}
      {tab === 'links' && (
        <>
          {/* Create Link */}
          <div className="flex gap-2 mb-6">
            <input value={newCode} onChange={e => setNewCode(e.target.value)}
              placeholder="Custom code (optional, e.g. 'summer2026')"
              className="flex-1 border rounded-lg px-3 py-2 text-sm" />
            <button onClick={createLink}
              className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
              <Plus className="w-4 h-4" /> Create
            </button>
          </div>

          {links.length === 0 ? (
            <div className="flex flex-col items-center text-center gap-4 py-16">
              <Link2 className="w-16 h-16 text-gray-300" />
              <h2 className="text-xl font-semibold text-gray-700">No referral links</h2>
              <p className="text-gray-500">Create a referral link to start tracking referrals.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {links.map(l => (
                <div key={l.id} className="bg-white border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-sm font-semibold">{l.code}</span>
                      <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${l.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>
                        {l.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button onClick={() => copyUrl(l.url)} className="p-1.5 hover:bg-gray-100 rounded-lg" title="Copy link">
                        {copied === l.url ? <Check className="w-4 h-4 text-emerald-500" /> : <Copy className="w-4 h-4 text-gray-500" />}
                      </button>
                      <button onClick={() => toggleLink(l.id)} className="p-1.5 hover:bg-gray-100 rounded-lg" title={l.is_active ? 'Deactivate' : 'Activate'}>
                        {l.is_active ? <PowerOff className="w-4 h-4 text-amber-500" /> : <Power className="w-4 h-4 text-gray-400" />}
                      </button>
                      <button onClick={() => window.open(l.url, '_blank')} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <ExternalLink className="w-4 h-4 text-gray-500" />
                      </button>
                      <button onClick={() => deleteLink(l.id)} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <span className="text-red-400 text-sm font-medium">X</span>
                      </button>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-gray-500">
                    <span>{l.clicks} clicks</span>
                    <span>{l.referrals_count} referrals</span>
                    <span>Created {new Date(l.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="mt-2 text-xs text-gray-400 font-mono truncate">{l.url}</div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* Tab: Activity */}
      {tab === 'activity' && (
        referrals.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-4 py-16">
            <Users className="w-16 h-16 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-700">No activity yet</h2>
            <p className="text-gray-500">Referral activity will appear here.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {referrals.map(r => (
              <div key={r.id} className="bg-white border rounded-xl px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                    r.type === 'purchase' ? 'bg-purple-50 text-purple-700' :
                    r.type === 'signup' ? 'bg-emerald-50 text-emerald-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{r.type}</span>
                  <div>
                    <span className="text-sm font-medium">{r.code}</span>
                    {r.referred_user && <span className="text-sm text-gray-500 ml-2">→ @{r.referred_user.username}</span>}
                  </div>
                </div>
                <div className="text-right text-sm">
                  {r.reward_amount != null && <span className="font-medium">{formatPrice(r.reward_amount)}</span>}
                  <p className="text-xs text-gray-400">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
