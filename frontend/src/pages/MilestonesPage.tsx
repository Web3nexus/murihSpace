import { useState, useEffect, useCallback } from 'react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { Trophy, Award, Plus, Loader2, Edit, Trash2, Target, TrendingUp, ShoppingBag, DollarSign, Heart } from 'lucide-react';
import { authFetch } from "@/lib/api/authFetch";





interface Milestone {
  id: number; title: string; description: string | null;
  metric_type: string; target_value: number;
  reward_type: string | null; reward_data: any;
  is_active: boolean; starts_at: string | null; ends_at: string | null;
  created_at: string;
}

interface BadgeData {
  slug: string; name: string; description: string | null;
  icon: string | null; color: string | null;
}

interface UserBadge {
  badge_id: number; earned_at: string;
  badge: BadgeData;
}

interface MilestoneProgress {
  milestone_id: number; progress: number; target: number;
  achieved: boolean; achieved_at: string | null;
  milestone: { id: number; title: string; description: string | null; metric_type: string; reward_type: string | null; reward_data: any } | null;
}

const METRIC_LABELS: Record<string, string> = {
  followers: 'Followers', sales: 'Sales', revenue: 'Revenue',
  products: 'Products Sold', engagement: 'Engagement',
};

const METRIC_ICONS: Record<string, typeof Target> = {
  followers: Heart, sales: ShoppingBag, revenue: DollarSign,
  products: TrendingUp, engagement: Target,
};

export function MilestonesPage() {
  const confirm = useConfirm();
  const [tab, setTab] = useState<'manage' | 'progress' | 'badges'>('manage');
  const [milestones, setMilestones] = useState<Milestone[]>([]);
  const [progress, setProgress] = useState<MilestoneProgress[]>([]);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Milestone | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fTitle, setFTitle] = useState('');
  const [fDesc, setFDesc] = useState('');
  const [fMetric, setFMetric] = useState('followers');
  const [fTarget, setFTarget] = useState('100');
  const [fReward, setFReward] = useState('');
  const [fActive, setFActive] = useState(true);

  const fetchAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const [mRes, pRes, bRes] = await Promise.all([
        authFetch(`/milestones`, {  }),
        authFetch(`/milestones/my-progress`, {  }),
        authFetch(`/badges/my`, {  }),
      ]);
      if (mRes.ok) { const j = await mRes.json(); setMilestones(j.data?.data ?? []); }
      if (pRes.ok) { const j = await pRes.json(); setProgress(j.data?.data ?? []); }
      if (bRes.ok) { const j = await bRes.json(); setBadges(j.data?.data ?? []); }
    } catch { /* ignore */ } finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openNew() {
    setEditing(null); setFTitle(''); setFDesc(''); setFMetric('followers');
    setFTarget('100'); setFReward(''); setFActive(true); setShowForm(true);
  }

  function openEdit(m: Milestone) {
    setEditing(m); setFTitle(m.title); setFDesc(m.description ?? '');
    setFMetric(m.metric_type); setFTarget(String(m.target_value));
    setFReward(m.reward_type ?? ''); setFActive(m.is_active); setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true); setMessage(null);
    const body = {
      title: fTitle, description: fDesc || null,
      metric_type: fMetric, target_value: Number(fTarget),
      reward_type: fReward || null, is_active: fActive,
    };
    const url = editing ? `/milestones/${editing.id}` : `/milestones`;
    const method = editing ? 'PUT' : 'POST';
    try {
      const res = await authFetch(url, { method,  body: JSON.stringify(body) });
      const json = await res.json();
      if (res.ok) { await fetchAll(); setShowForm(false); setEditing(null); setMessage({ type: 'success', text: editing ? 'Milestone updated.' : 'Milestone created.' }); }
      else { setMessage({ type: 'error', text: json.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    finally { setIsSubmitting(false); }
  }

  async function deleteMilestone(id: number) {
    if (!await confirm({ title: 'Delete Milestone', message: 'Delete this milestone?', variant: 'destructive' })) return;
    try {
      const res = await authFetch(`/milestones/${id}`, { method: 'DELETE',  });
      if (res.ok) { await fetchAll(); setMessage({ type: 'success', text: 'Milestone deleted.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
  }

  if (isLoading) {
    return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  const tabStyle = (t: string) => `px-5 py-2 rounded-lg text-sm font-medium transition ${tab === t ? 'bg-white shadow-sm' : 'text-gray-600 hover:text-gray-900'}`;

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3"><Trophy className="w-6 h-6" /><h1 className="text-2xl font-bold">Milestones & Badges</h1></div>
        {tab === 'manage' && <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm"><Plus className="w-4 h-4" /> New Milestone</button>}
      </div>

      <div className="flex gap-1 mb-6 bg-gray-100 p-1 rounded-xl w-fit">
        <button onClick={() => setTab('manage')} className={tabStyle('manage')}>Milestones</button>
        <button onClick={() => setTab('progress')} className={tabStyle('progress')}>My Progress</button>
        <button onClick={() => setTab('badges')} className={tabStyle('badges')}>Badges</button>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      {/* Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <div className="bg-white rounded-2xl max-w-lg w-full p-6" onClick={e => e.stopPropagation()}>
            <h2 className="text-lg font-bold mb-4">{editing ? 'Edit Milestone' : 'New Milestone'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm text-gray-600 mb-1">Title *</label>
                <input value={fTitle} onChange={e => setFTitle(e.target.value)} required className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="e.g. 100 Followers" />
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Description</label>
                <textarea value={fDesc} onChange={e => setFDesc(e.target.value)} rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Metric *</label>
                  <select value={fMetric} onChange={e => setFMetric(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                    {Object.entries(METRIC_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-1">Target Value *</label>
                  <input value={fTarget} onChange={e => setFTarget(e.target.value)} required type="number" min="1" className="w-full border rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-sm text-gray-600 mb-1">Reward Type</label>
                <select value={fReward} onChange={e => setFReward(e.target.value)} className="w-full border rounded-lg px-3 py-2 text-sm">
                  <option value="">No reward</option>
                  <option value="badge">Badge</option>
                  <option value="feature">Feature</option>
                  <option value="custom">Custom</option>
                </select>
              </div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={fActive} onChange={e => setFActive(e.target.checked)} />
                <span className="text-sm">Active</span>
              </label>
              <div className="flex gap-3">
                <button type="submit" disabled={isSubmitting} className="px-6 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm disabled:opacity-50 flex items-center gap-2">
                  {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}{editing ? 'Update' : 'Create'}
                </button>
                <button type="button" onClick={() => { setShowForm(false); setEditing(null); }} className="px-6 py-2 border rounded-lg hover:bg-gray-50 text-sm">Cancel</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Tab: Manage */}
      {tab === 'manage' && (
        milestones.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-4 py-16">
            <Target className="w-16 h-16 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-700">No milestones yet</h2>
            <p className="text-gray-500">Create goals for your audience to reach.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {milestones.map(m => {
              const Icon = METRIC_ICONS[m.metric_type] ?? Target;
              return (
                <div key={m.id} className="bg-white border rounded-xl p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`p-2.5 rounded-lg ${m.is_active ? 'bg-blue-50 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{m.title}</h3>
                          <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${m.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-100 text-gray-500'}`}>{m.is_active ? 'Active' : 'Inactive'}</span>
                        </div>
                        <p className="text-sm text-gray-500">{METRIC_LABELS[m.metric_type]}: {m.target_value.toLocaleString()}{m.reward_type ? ` · Reward: ${m.reward_type}` : ''}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button onClick={() => openEdit(m)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Edit className="w-4 h-4 text-gray-500" /></button>
                      <button onClick={() => deleteMilestone(m.id)} className="p-1.5 hover:bg-gray-100 rounded-lg"><Trash2 className="w-4 h-4 text-red-400" /></button>
                    </div>
                  </div>
                  {m.description && <p className="text-sm text-gray-600 mt-2">{m.description}</p>}
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Tab: Progress */}
      {tab === 'progress' && (
        progress.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-4 py-16">
            <TrendingUp className="w-16 h-16 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-700">No progress yet</h2>
            <p className="text-gray-500">Complete milestones to track your achievements.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {progress.map(p => {
              const pct = p.target > 0 ? Math.min(100, Math.round((p.progress / p.target) * 100)) : 0;
              return (
                <div key={p.milestone_id} className="bg-white border rounded-xl p-5">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{p.milestone?.title}</h3>
                      {p.achieved && <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-medium">Achieved!</span>}
                    </div>
                    <span className="text-sm text-gray-500">{p.progress.toLocaleString()} / {p.target.toLocaleString()}</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div className={`h-2.5 rounded-full transition-all ${p.achieved ? 'bg-emerald-500' : 'bg-blue-500'}`} style={{ width: `${pct}%` }} />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">{pct}% complete</p>
                </div>
              );
            })}
          </div>
        )
      )}

      {/* Tab: Badges */}
      {tab === 'badges' && (
        badges.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-4 py-16">
            <Award className="w-16 h-16 text-gray-300" />
            <h2 className="text-xl font-semibold text-gray-700">No badges yet</h2>
            <p className="text-gray-500">Earn badges by completing milestones and achievements.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            {badges.map(ub => (
              <div key={ub.badge_id} className="bg-white border rounded-xl p-5 text-center">
                <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-3" style={{ backgroundColor: (ub.badge?.color ?? '#2164b6') + '20' }}>
                  <Award className="w-7 h-7" style={{ color: ub.badge?.color ?? '#2164b6' }} />
                </div>
                <h3 className="font-semibold text-sm">{ub.badge?.name}</h3>
                <p className="text-xs text-gray-500 mt-1">{ub.badge?.description}</p>
                <p className="text-xs text-gray-400 mt-2">Earned {new Date(ub.earned_at).toLocaleDateString()}</p>
              </div>
            ))}
          </div>
        )
      )}
    </div>
  );
}
