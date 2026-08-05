import { useState, useEffect, useCallback } from 'react';
import { FileText, Loader2, Save, Eye, Globe, Users, BarChart3, Plus, Trash2 } from 'lucide-react';
import { ImageUploader } from "@/components/upload/ImageUploader";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface RateCardItem {
  type: string; price: string; description?: string;
}

interface MediaKitData {
  id?: number;
  bio: string;
  profile_image_url: string;
  audience_demographics: Record<string, number> | null;
  engagement_rate: number | null;
  total_followers: number;
  avg_views: number;
  top_content: string[];
  past_partnerships: string[];
  rate_card: RateCardItem[];
  is_published: boolean;
}

export function MediaKitPage() {
  const [kit, setKit] = useState<MediaKitData>({
    bio: '', profile_image_url: '', audience_demographics: null,
    engagement_rate: null, total_followers: 0, avg_views: 0,
    top_content: [], past_partnerships: [], rate_card: [], is_published: false,
  });
  const [suggested, setSuggested] = useState<Record<string, any>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [newTopContent, setNewTopContent] = useState('');
  const [newPartnership, setNewPartnership] = useState('');
  const [newRateItem, setNewRateItem] = useState<RateCardItem>({ type: '', price: '' });
  const [demographicsKey, setDemographicsKey] = useState('');
  const [demographicsVal, setDemographicsVal] = useState('');

  const fetchKit = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/media-kit/preview`, { headers: getAuthHeaders() });
      if (res.ok) {
        const j = await res.json();
        if (j.data) {
          setKit({
            bio: j.data.bio ?? '',
            profile_image_url: j.data.profile_image_url ?? '',
            audience_demographics: j.data.audience_demographics ?? null,
            engagement_rate: j.data.engagement_rate ?? null,
            total_followers: j.data.total_followers ?? 0,
            avg_views: j.data.avg_views ?? 0,
            top_content: j.data.top_content ?? [],
            past_partnerships: j.data.past_partnerships ?? [],
            rate_card: j.data.rate_card ?? [],
            is_published: j.data.is_published ?? false,
          });
        }
        if (j.suggested) setSuggested(j.suggested);
      }
    } catch { /* ignore */ }
    finally { setIsLoading(false); }
  }, []);

  useEffect(() => { fetchKit(); }, [fetchKit]);

  async function saveKit() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`${API_BASE}/media-kit`, {
        method: 'PUT', headers: getAuthHeaders(),
        body: JSON.stringify({
          bio: kit.bio,
          profile_image_url: kit.profile_image_url,
          audience_demographics: kit.audience_demographics,
          engagement_rate: kit.engagement_rate,
          total_followers: kit.total_followers,
          avg_views: kit.avg_views,
          top_content: kit.top_content,
          past_partnerships: kit.past_partnerships,
          rate_card: kit.rate_card,
          is_published: kit.is_published,
        }),
      });
      if (res.ok) { setMessage({ type: 'success', text: 'Media kit saved.' }); }
      else { const j = await res.json(); setMessage({ type: 'error', text: j.message ?? 'Failed.' }); }
    } catch { setMessage({ type: 'error', text: 'Network error.' }); }
    finally { setSaving(false); }
  }

  function addTopContent() {
    if (!newTopContent.trim()) return;
    setKit({ ...kit, top_content: [...kit.top_content, newTopContent.trim()] });
    setNewTopContent('');
  }

  function addPartnership() {
    if (!newPartnership.trim()) return;
    setKit({ ...kit, past_partnerships: [...kit.past_partnerships, newPartnership.trim()] });
    setNewPartnership('');
  }

  function addRateItem() {
    if (!newRateItem.type.trim() || !newRateItem.price.trim()) return;
    setKit({ ...kit, rate_card: [...kit.rate_card, { ...newRateItem }] });
    setNewRateItem({ type: '', price: '' });
  }

  function addDemographic() {
    if (!demographicsKey.trim()) return;
    const current = kit.audience_demographics ?? {};
    setKit({ ...kit, audience_demographics: { ...current, [demographicsKey.trim()]: Number(demographicsVal) || 0 } });
    setDemographicsKey('');
    setDemographicsVal('');
  }

  if (isLoading) {
    return <div className="w-full flex items-center justify-center h-64"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>;
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <FileText className="w-6 h-6" />
          <h1 className="text-2xl font-bold">Dynamic Media Kit</h1>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={saveKit} disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-black text-white rounded-lg hover:bg-gray-800 text-sm">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} Save
          </button>
        </div>
      </div>

      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm ${message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}>
          {message.text}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Main column */}
        <div className="lg:col-span-2 space-y-6">
          {/* Stats cards */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-white border rounded-xl p-4 text-center">
              <Users className="w-5 h-5 mx-auto mb-1 text-blue-500" />
              <p className="text-2xl font-bold">{kit.total_followers}</p>
              <p className="text-xs text-gray-500">Followers</p>
            </div>
            <div className="bg-white border rounded-xl p-4 text-center">
              <BarChart3 className="w-5 h-5 mx-auto mb-1 text-emerald-500" />
              <p className="text-2xl font-bold">{kit.engagement_rate ?? 0}%</p>
              <p className="text-xs text-gray-500">Engagement</p>
            </div>
            <div className="bg-white border rounded-xl p-4 text-center">
              <Eye className="w-5 h-5 mx-auto mb-1 text-purple-500" />
              <p className="text-2xl font-bold">{kit.avg_views}</p>
              <p className="text-xs text-gray-500">Avg Views</p>
            </div>
          </div>

          {/* Bio */}
          <div className="bg-white border rounded-xl p-6">
            <label className="block text-sm font-medium mb-2">Bio</label>
            <textarea value={kit.bio} onChange={e => setKit({ ...kit, bio: e.target.value })}
              rows={3} className="w-full border rounded-lg px-3 py-2 text-sm" placeholder="Tell brands about yourself..." />
          </div>

          {/* Stats fields */}
          <div className="bg-white border rounded-xl p-6">
            <h3 className="font-semibold mb-3">Audience Stats</h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs text-gray-500 mb-1">Total Followers</label>
                <input type="number" value={kit.total_followers}
                  onChange={e => setKit({ ...kit, total_followers: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
                {suggested.total_followers != null && <p className="text-xs text-gray-400 mt-1">Suggested: {suggested.total_followers}</p>}
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Engagement Rate (%)</label>
                <input type="number" step="0.01" value={kit.engagement_rate ?? ''}
                  onChange={e => setKit({ ...kit, engagement_rate: e.target.value ? Number(e.target.value) : null })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <label className="block text-xs text-gray-500 mb-1">Avg Views</label>
                <input type="number" value={kit.avg_views}
                  onChange={e => setKit({ ...kit, avg_views: Number(e.target.value) })}
                  className="w-full border rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </div>

          {/* Demographics */}
          <div className="bg-white border rounded-xl p-6">
            <h3 className="font-semibold mb-3">Audience Demographics</h3>
            <div className="flex gap-2 mb-3">
              <input value={demographicsKey} onChange={e => setDemographicsKey(e.target.value)} placeholder="e.g. 18-24"
                className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <input type="number" value={demographicsVal} onChange={e => setDemographicsVal(e.target.value)} placeholder="%"
                className="w-20 border rounded-lg px-3 py-2 text-sm" />
              <button onClick={addDemographic} className="px-3 py-2 bg-black text-white rounded-lg text-sm">Add</button>
            </div>
            {kit.audience_demographics && Object.entries(kit.audience_demographics).length > 0 && (
              <div className="flex flex-wrap gap-2">
                {Object.entries(kit.audience_demographics).map(([k, v]) => (
                  <span key={k} className="px-2 py-1 bg-gray-100 rounded-lg text-xs">{k}: {v}%</span>
                ))}
              </div>
            )}
          </div>

          {/* Top Content */}
          <div className="bg-white border rounded-xl p-6">
            <h3 className="font-semibold mb-3">Top Content</h3>
            <div className="flex gap-2 mb-3">
              <input value={newTopContent} onChange={e => setNewTopContent(e.target.value)} placeholder="Content title..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <button onClick={addTopContent} className="px-3 py-2 bg-black text-white rounded-lg text-sm"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1">
              {kit.top_content.map((c, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-3 py-2 bg-gray-50 rounded-lg">
                  <span>{c}</span>
                  <button onClick={() => setKit({ ...kit, top_content: kit.top_content.filter((_, j) => j !== i) })}>
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-6">
          {/* Profile Image */}
          <div className="bg-white border rounded-xl p-6">
            <ImageUploader
              value={kit.profile_image_url}
              onChange={(v) => setKit({ ...kit, profile_image_url: v })}
              folder="media-kit"
              label="Profile Image"
            />
          </div>

          {/* Publish toggle */}
          <div className="bg-white border rounded-xl p-6">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="checkbox" checked={kit.is_published}
                onChange={e => setKit({ ...kit, is_published: e.target.checked })} />
              <span className="text-sm font-medium">Publish Media Kit</span>
            </label>
            <p className="text-xs text-gray-400 mt-2">Make your media kit visible to brands.</p>
            {kit.is_published && (
              <a href={`${API_BASE}/media-kit/preview`} target="_blank"
                className="flex items-center gap-1 text-xs text-blue-500 mt-2">
                <Globe className="w-3 h-3" /> View public page
              </a>
            )}
          </div>

          {/* Past Partnerships */}
          <div className="bg-white border rounded-xl p-6">
            <h3 className="font-semibold mb-3">Past Partnerships</h3>
            <div className="flex gap-2 mb-3">
              <input value={newPartnership} onChange={e => setNewPartnership(e.target.value)} placeholder="Brand name..."
                className="flex-1 border rounded-lg px-3 py-2 text-sm" />
              <button onClick={addPartnership} className="px-3 py-2 bg-black text-white rounded-lg text-sm"><Plus className="w-4 h-4" /></button>
            </div>
            <div className="space-y-1">
              {kit.past_partnerships.map((p, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-3 py-2 bg-gray-50 rounded-lg">
                  <span>{p}</span>
                  <button onClick={() => setKit({ ...kit, past_partnerships: kit.past_partnerships.filter((_, j) => j !== i) })}>
                    <Trash2 className="w-3 h-3 text-red-400" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          {/* Rate Card */}
          <div className="bg-white border rounded-xl p-6">
            <h3 className="font-semibold mb-3">Rate Card</h3>
            <div className="space-y-2 mb-3">
              <input value={newRateItem.type} onChange={e => setNewRateItem({ ...newRateItem, type: e.target.value })}
                placeholder="Type (e.g. Instagram Post)" className="w-full border rounded-lg px-3 py-2 text-sm" />
              <div className="flex gap-2">
                <input value={newRateItem.price} onChange={e => setNewRateItem({ ...newRateItem, price: e.target.value })}
                  placeholder="Price" className="flex-1 border rounded-lg px-3 py-2 text-sm" />
                <button onClick={addRateItem} className="px-3 py-2 bg-black text-white rounded-lg text-sm"><Plus className="w-4 h-4" /></button>
              </div>
            </div>
            <div className="space-y-1">
              {kit.rate_card.map((r, i) => (
                <div key={i} className="flex items-center justify-between text-sm px-3 py-2 bg-gray-50 rounded-lg">
                  <span>{r.type}</span>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.price}</span>
                    <button onClick={() => setKit({ ...kit, rate_card: kit.rate_card.filter((_, j) => j !== i) })}>
                      <Trash2 className="w-3 h-3 text-red-400" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
