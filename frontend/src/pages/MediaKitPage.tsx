import { useState, useEffect, useCallback } from 'react';
import { Loader2, Save, Eye, Globe, Users, BarChart3, Plus, Trash2, Check, ExternalLink, Sparkles, Image as ImageIcon, Briefcase, FileText, DollarSign } from 'lucide-react';
import { ImageUploader } from "@/components/upload/ImageUploader";
import { getAuthToken } from "@/lib/auth/token";
import { StatCard } from "@/components/ui/StatCard";

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



function SectionCard({ title, icon: Icon, description, children }: { title: string; icon: React.ElementType; description?: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-border/50 bg-card/50 backdrop-blur-xl shadow-sm overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="p-6 border-b border-border/50 flex items-start gap-4">
        <div className="p-2.5 rounded-xl bg-[#2164b6]/10 text-[#2164b6] shrink-0">
          <Icon className="w-5 h-5" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-foreground">{title}</h3>
          {description && <p className="text-sm text-muted-foreground mt-1">{description}</p>}
        </div>
      </div>
      <div className="p-6 space-y-6">
        {children}
      </div>
    </div>
  );
}

export function MediaKitPage() {
  const [kit, setKit] = useState<MediaKitData>({
    bio: '', profile_image_url: '', audience_demographics: null,
    engagement_rate: null, total_followers: 0, avg_views: 0,
    top_content: [], past_partnerships: [], rate_card: [], is_published: false,
  });
  const [suggested, setSuggested] = useState<Record<string, any>>({});
  const [creatorId, setCreatorId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
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
          if (j.data.creator_id) setCreatorId(j.data.creator_id);
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

  function showMsg(type: 'success' | 'error', text: string) {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 3000);
  }

  async function saveKit() {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/media-kit`, {
        method: 'PUT', headers: getAuthHeaders(), body: JSON.stringify(kit),
      });
      if (res.ok) { showMsg('success', 'Media kit saved successfully!'); }
      else { const j = await res.json(); showMsg('error', j.message ?? 'Failed to save.'); }
    } catch { showMsg('error', 'Network error.'); }
    setSaving(false);
  }

  const addDemographic = () => {
    if (!demographicsKey || !demographicsVal) return;
    setKit({
      ...kit,
      audience_demographics: { ...(kit.audience_demographics || {}), [demographicsKey]: Number(demographicsVal) }
    });
    setDemographicsKey(''); setDemographicsVal('');
  };

  const addPartnership = () => {
    if (!newPartnership) return;
    setKit({ ...kit, past_partnerships: [...kit.past_partnerships, newPartnership] });
    setNewPartnership('');
  };

  const addRateItem = () => {
    if (!newRateItem.type || !newRateItem.price) return;
    setKit({ ...kit, rate_card: [...kit.rate_card, { ...newRateItem }] });
    setNewRateItem({ type: '', price: '' });
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <div className="relative">
          <div className="absolute inset-0 rounded-full blur-xl bg-[#2164b6]/20 animate-pulse"></div>
          <Loader2 className="h-10 w-10 animate-spin text-[#2164b6] relative z-10" />
        </div>
        <p className="text-sm text-muted-foreground font-medium animate-pulse">Loading Media Kit...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-8 p-6 lg:p-8 animate-in fade-in duration-500 pb-24">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 relative z-20">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-bold mb-2">
            <Sparkles className="w-3.5 h-3.5" />
            Brand Partnerships
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-foreground flex items-center gap-3">
            Creator Media Kit
          </h1>
          <p className="text-sm text-muted-foreground max-w-xl">
            Build your professional portfolio. Share your audience stats, past work, and rates with potential sponsors seamlessly.
          </p>
        </div>
        
        <div className="flex items-center gap-3">
          {kit.is_published && creatorId && (
            <a 
              href={`/media-kit/${creatorId}`} 
              target="_blank" 
              rel="noreferrer"
              className="px-6 py-3 rounded-xl bg-background border border-border/50 text-foreground text-sm font-bold shadow-sm hover:shadow-md hover:border-primary/50 transition-all flex items-center gap-2 group"
            >
              <ExternalLink className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
              View Public Kit
            </a>
          )}
          
          <button 
            onClick={saveKit} 
            disabled={saving}
            className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-[#2164b6] to-[#1a5091] text-white text-sm font-bold shadow-lg hover:shadow-[#2164b6]/25 transition-all duration-300 hover:-translate-y-0.5 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Changes
          </button>
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

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard icon={Users} label="Total Followers" value={Number(kit.total_followers).toLocaleString()} color="bg-blue-500 text-blue-500" />
        <StatCard icon={BarChart3} label="Engagement Rate" value={`${kit.engagement_rate ?? 0}%`} color="bg-emerald-500 text-emerald-500" />
        <StatCard icon={Eye} label="Avg. Views" value={Number(kit.avg_views).toLocaleString()} color="bg-purple-500 text-purple-500" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Column */}
        <div className="lg:col-span-2 space-y-8">
          
          <SectionCard title="About You" icon={FileText} description="Write a compelling bio to introduce yourself to brands.">
            <textarea 
              value={kit.bio} 
              onChange={e => setKit({ ...kit, bio: e.target.value })}
              rows={4} 
              className="w-full rounded-xl bg-background border border-border/50 p-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50 resize-none" 
              placeholder="Hi, I'm [Name] and I create content about..." 
            />
          </SectionCard>

          <SectionCard title="Audience Insights" icon={BarChart3} description="Set your metrics or use our suggested auto-filled values from your connected accounts.">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
              {[
                { key: 'total_followers', label: 'Followers', val: kit.total_followers, sug: suggested.total_followers },
                { key: 'engagement_rate', label: 'Engagement (%)', val: kit.engagement_rate ?? '', sug: suggested.engagement_rate, step: "0.01" },
                { key: 'avg_views', label: 'Avg Views', val: kit.avg_views, sug: suggested.avg_views },
              ].map(f => (
                <div key={f.key} className="space-y-2">
                  <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">{f.label}</label>
                  <input 
                    type="number" step={f.step} min="0" 
                    value={f.val} 
                    onChange={e => setKit({ ...kit, [f.key]: e.target.value ? Number(e.target.value) : null })}
                    className="w-full h-12 rounded-xl bg-background border border-border/50 px-4 text-sm font-medium focus:ring-2 focus:ring-[#2164b6]/50"
                  />
                  {f.sug != null && f.sug > 0 && (
                    <button type="button" onClick={() => setKit({ ...kit, [f.key]: f.sug })} className="text-[10px] font-bold text-[#2164b6] hover:underline flex items-center gap-1">
                      <Sparkles className="w-3 h-3" /> Auto-fill: {Number(f.sug).toLocaleString()}
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="pt-6 mt-6 border-t border-border/50">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider block mb-4">Audience Demographics</label>
              <div className="flex gap-3 mb-4">
                <input 
                  value={demographicsKey} 
                  onChange={e => setDemographicsKey(e.target.value)} 
                  placeholder="e.g. 18-24 years" 
                  className="flex-1 h-12 rounded-xl bg-background border border-border/50 px-4 text-sm focus:ring-[#2164b6]/50"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDemographic(); } }}
                />
                <input 
                  type="number" min="0" max="100"
                  value={demographicsVal} 
                  onChange={e => setDemographicsVal(e.target.value)} 
                  placeholder="%" 
                  className="w-24 shrink-0 h-12 rounded-xl bg-background border border-border/50 px-4 text-sm focus:ring-[#2164b6]/50"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addDemographic(); } }}
                />
                <button type="button" onClick={addDemographic} className="h-12 px-6 rounded-xl bg-muted text-foreground font-bold hover:bg-muted/80 transition-colors">
                  Add
                </button>
              </div>
              
              {kit.audience_demographics && Object.keys(kit.audience_demographics).length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {Object.entries(kit.audience_demographics).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg bg-background border border-border/50">
                      <span className="text-xs font-bold text-foreground">{k} <span className="text-muted-foreground font-medium ml-1">{v}%</span></span>
                      <button 
                        onClick={() => {
                          const newDemo = { ...kit.audience_demographics };
                          delete newDemo[k];
                          setKit({ ...kit, audience_demographics: newDemo });
                        }}
                        className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </SectionCard>
          
          <SectionCard title="Past Partnerships" icon={Briefcase} description="Build trust by showing brands you've worked with before.">
            <div className="flex gap-3 mb-4">
              <input 
                value={newPartnership} 
                onChange={e => setNewPartnership(e.target.value)} 
                placeholder="Brand Name (e.g. Nike, Spotify)" 
                className="flex-1 h-12 rounded-xl bg-background border border-border/50 px-4 text-sm focus:ring-[#2164b6]/50"
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addPartnership(); } }}
              />
              <button type="button" onClick={addPartnership} className="h-12 px-6 rounded-xl bg-muted text-foreground font-bold hover:bg-muted/80 transition-colors">
                Add
              </button>
            </div>
            
            {kit.past_partnerships.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {kit.past_partnerships.map((p, i) => (
                  <div key={i} className="flex items-center gap-2 pl-3 pr-1.5 py-1.5 rounded-lg bg-background border border-border/50">
                    <span className="text-xs font-bold text-foreground">{p}</span>
                    <button 
                      onClick={() => setKit({ ...kit, past_partnerships: kit.past_partnerships.filter((_, j) => j !== i) })}
                      className="p-1 rounded hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

        </div>

        {/* Sidebar Column */}
        <div className="space-y-8">
          
          <SectionCard title="Visibility" icon={Globe}>
            <label className="flex items-center justify-between gap-4 p-4 rounded-xl border border-border/50 bg-background cursor-pointer group">
              <div>
                <span className="text-sm font-bold text-foreground block group-hover:text-[#2164b6] transition-colors">Publish Kit</span>
                <span className="text-xs text-muted-foreground mt-0.5 block">Make your media kit public via your link in bio.</span>
              </div>
              <div className="relative flex items-center shrink-0">
                <input type="checkbox" checked={kit.is_published} onChange={e => setKit({ ...kit, is_published: e.target.checked })} className="peer sr-only" />
                <div className="h-6 w-11 rounded-full bg-muted-foreground/30 peer-checked:bg-[#2164b6] transition-colors shadow-inner"></div>
                <div className="absolute left-1 top-1 h-4 w-4 rounded-full bg-white transition-transform peer-checked:translate-x-5 shadow-sm"></div>
              </div>
            </label>
          </SectionCard>

          <SectionCard title="Profile Photo" icon={ImageIcon}>
            <div className="bg-background rounded-xl border border-border/50 p-4">
               <ImageUploader
                value={kit.profile_image_url}
                onChange={(v) => setKit({ ...kit, profile_image_url: v })}
                folder="media-kit"
                label="Upload a high-quality headshot"
              />
            </div>
          </SectionCard>

          <SectionCard title="Rate Card" icon={DollarSign} description="What you charge for your services.">
            <div className="space-y-3 mb-6">
              <input 
                value={newRateItem.type} 
                onChange={e => setNewRateItem({ ...newRateItem, type: e.target.value })} 
                placeholder="Deliverable (e.g. 1x Reel)" 
                className="w-full h-10 rounded-lg bg-background border border-border/50 px-3 text-sm focus:ring-[#2164b6]/50"
              />
              <div className="flex gap-2">
                <input 
                  value={newRateItem.price} 
                  onChange={e => setNewRateItem({ ...newRateItem, price: e.target.value })} 
                  placeholder="Price (e.g. $500)" 
                  className="flex-1 h-10 rounded-lg bg-background border border-border/50 px-3 text-sm focus:ring-[#2164b6]/50"
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addRateItem(); } }}
                />
                <button type="button" onClick={addRateItem} className="h-10 w-10 shrink-0 flex items-center justify-center rounded-lg bg-muted text-foreground hover:bg-muted/80 transition-colors">
                  <Plus className="w-4 h-4" />
                </button>
              </div>
            </div>
            
            <div className="space-y-2">
              {kit.rate_card.length === 0 ? (
                <div className="p-6 text-center border border-dashed border-border/50 rounded-xl bg-background/50">
                  <p className="text-xs font-medium text-muted-foreground">No rates added yet.</p>
                </div>
              ) : (
                kit.rate_card.map((r, i) => (
                  <div key={i} className="flex items-center justify-between gap-3 p-3 rounded-xl bg-background border border-border/50 hover:border-primary/30 transition-colors group">
                    <span className="text-sm font-bold text-foreground truncate">{r.type}</span>
                    <div className="flex items-center gap-3 shrink-0">
                      <span className="text-sm font-black text-emerald-500">{r.price}</span>
                      <button 
                        onClick={() => setKit({ ...kit, rate_card: kit.rate_card.filter((_, j) => j !== i) })}
                        className="p-1.5 rounded-md hover:bg-rose-500/10 text-muted-foreground hover:text-rose-500 transition-colors opacity-0 group-hover:opacity-100"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>
          </SectionCard>
          
        </div>
      </div>
    </div>
  );
}
