import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import {
  Loader2, Users, Eye, BarChart3, Globe, ShieldCheck, Sparkles,
} from "lucide-react";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

interface RateCardItem {
  type: string; price: string; description?: string;
}

interface MediaKitData {
  id: number;
  creator_id: number;
  bio: string | null;
  profile_image_url: string | null;
  audience_demographics: Record<string, number> | null;
  engagement_rate: number | null;
  total_followers: number;
  avg_views: number;
  top_content: string[];
  past_partnerships: string[];
  rate_card: RateCardItem[];
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1).replace(/\.0$/, '') + 'K';
  return String(n);
}

export function PublicMediaKitPage() {
  const { creatorId } = useParams<{ creatorId: string }>();
  const [kit, setKit] = useState<MediaKitData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!creatorId) { setNotFound(true); setLoading(false); return; }
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/media-kit/${encodeURIComponent(creatorId)}`, { headers: { Accept: "application/json" } });
        if (!res.ok) { setNotFound(true); return; }
        const j = await res.json();
        const d = j?.success ? j?.data : j.data;
        setKit({
          ...d,
          top_content: d.top_content ?? [],
          past_partnerships: d.past_partnerships ?? [],
          rate_card: d.rate_card ?? [],
        });
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    })();
  }, [creatorId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  if (notFound || !kit) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive"><Users className="h-8 w-8" /></div>
        <h2 className="text-xl font-bold text-foreground">Media kit unavailable</h2>
        <p className="text-sm text-muted-foreground max-w-sm">This creator has not published a media kit yet.</p>
        <Link to="/" className="text-xs font-bold text-secondary hover:underline">Go to MurihSpace</Link>
      </div>
    );
  }

  const stats = [
    { icon: Users, label: "Followers", value: formatNumber(kit.total_followers), tint: "text-secondary" },
    { icon: Eye, label: "Avg Views", value: formatNumber(kit.avg_views), tint: "text-purple-500" },
    { icon: BarChart3, label: "Engagement", value: `${kit.engagement_rate ?? 0}%`, tint: "text-emerald-500" },
  ];

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-2 text-sm font-bold text-foreground">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </span>
            MurihSpace
          </div>
          <Link to="/" className="text-xs font-semibold text-secondary hover:underline">Explore MurihSpace</Link>
        </header>

        <div className="space-y-8">
          {/* Profile hero */}
          <section className="rounded-3xl border border-border bg-card p-6 sm:p-8 shadow-xs">
            <div className="flex flex-col sm:flex-row items-start gap-5">
              <div className="h-24 w-24 shrink-0 rounded-2xl bg-muted flex items-center justify-center overflow-hidden">
                {kit.profile_image_url
                  ? <img src={kit.profile_image_url} alt="Creator" className="h-full w-full object-cover" />
                  : <Users className="h-10 w-10 text-muted-foreground" />}
              </div>
              <div className="flex-1 text-center sm:text-left">
                <div className="inline-flex items-center gap-1.5 rounded-full bg-secondary/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-secondary">
                  <ShieldCheck className="h-3 w-3" /> Media Kit
                </div>
                <p className="mt-3 text-xs font-medium text-muted-foreground">Content creator on MurihSpace</p>
                {kit.bio && <p className="mt-1.5 text-sm text-muted-foreground max-w-prose">{kit.bio}</p>}
              </div>
            </div>

            {/* Stats */}
            <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {stats.map(({ icon: Icon, label, value, tint }) => (
                <div key={label} className="rounded-xl border border-border bg-muted/40 p-4 text-center">
                  <Icon className={`h-5 w-5 mx-auto mb-1 ${tint}`} />
                  <p className="text-2xl font-extrabold text-foreground">{value}</p>
                  <p className="text-[11px] font-medium text-muted-foreground mt-0.5">{label}</p>
                </div>
              ))}
            </div>
          </section>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              {/* Demographics */}
              {kit.audience_demographics && Object.keys(kit.audience_demographics).length > 0 && (
                <section className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                  <h2 className="text-sm font-bold text-foreground">Audience</h2>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {Object.entries(kit.audience_demographics).map(([k, v]) => (
                      <span key={k} className="rounded-lg bg-muted px-3 py-1.5 text-xs text-foreground">
                        {k} · <span className="font-semibold text-secondary">{Number(v).toLocaleString()}%</span>
                      </span>
                    ))}
                  </div>
                </section>
              )}

              {/* Top content */}
              {kit.top_content.length > 0 && (
                <section>
                  <h2 className="text-sm font-bold text-foreground mb-3">Top Content</h2>
                  <div className="space-y-2">
                    {kit.top_content.map((c, i) => (
                      <div key={i} className="rounded-xl border border-border bg-card px-4 py-3 text-sm text-foreground">
                        {c}
                      </div>
                    ))}
                  </div>
                </section>
              )}
            </div>

            <div className="space-y-6">
              {/* Rate card */}
              <section className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <h2 className="text-sm font-bold text-foreground">Rate Card</h2>
                {kit.rate_card.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">No rates listed.</p>
                ) : (
                  <div className="mt-4 space-y-2.5">
                    {kit.rate_card.map((r, i) => (
                      <div key={i} className="flex items-center justify-between gap-3">
                        <span className="text-xs text-muted-foreground">{r.type}</span>
                        <span className="text-sm font-bold text-foreground shrink-0">{r.price}</span>
                      </div>
                    ))}
                  </div>
                )}
              </section>

              {/* Past partnerships */}
              <section className="rounded-2xl border border-border bg-card p-6 shadow-xs">
                <h2 className="text-sm font-bold text-foreground">Past Partnerships</h2>
                {kit.past_partnerships.length === 0 ? (
                  <p className="mt-2 text-xs text-muted-foreground">None listed yet.</p>
                ) : (
                  <div className="mt-4 space-y-2">
                    {kit.past_partnerships.map((p, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Globe className="h-3.5 w-3.5 text-secondary shrink-0" /> {p}
                      </div>
                    ))}
                  </div>
                )}
              </section>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}