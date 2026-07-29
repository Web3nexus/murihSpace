import { useState, useEffect } from "react";
import { useParams, Link } from "react-router";
import { Globe, ExternalLink, Loader2, AlertTriangle, Crown, ShoppingCart, Tag, Camera, Music, Hash, Film, MessageCircle, Send, Link as LinkIcon } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

interface SocialLink { id: number; platform: string; url: string; }
interface ProductItem { id: number; title: string; description: string | null; price: string; currency: string; type: string; media_url: string | null; checkout_url: string | null; }

interface PublicLinkData {
  username: string;
  profile_name: string;
  profile_bio: string | null;
  avatar_url: string | null;
  banner_url: string | null;
  bg: string; card_bg: string; text_color: string; accent: string;
  font: string; button_style: string; layout: string;
  background_type: string; background_value: string | null;
  links: { id: number; title: string; url: string; sort_order: number }[];
  social_links: SocialLink[];
  products: ProductItem[];
}

const btnRadius = (style: string) => style === 'pill' ? 'rounded-full' : style === 'sharp' ? 'rounded-none' : 'rounded-xl';
const bgStyle = (data: PublicLinkData): React.CSSProperties => {
  if (data.background_type === 'gradient' && data.background_value) return { background: data.background_value };
  if (data.background_type === 'image' && data.background_value) return { backgroundImage: `url(${data.background_value})`, backgroundSize: 'cover', backgroundPosition: 'center' };
  return { background: data.bg };
};

function SocialIcon({ platform }: { platform: string; accent?: string }) {
  const cn = "h-4 w-4";
  const icon: Record<string, React.ReactNode> = {
    instagram: <Camera className={cn} />,
    twitter: <Hash className={cn} />,
    tiktok: <Music className={cn} />,
    youtube: <Film className={cn} />,
    facebook: <MessageCircle className={cn} />,
    snapchat: <Send className={cn} />,
  };
  return <>{icon[platform] ?? <LinkIcon className={cn} />}</>;
}

export default function PublicLinkInBioPage() {
  const { username } = useParams<{ username: string }>();
  const cleanUsername = (username ?? '').replace(/^@/, '');
  const [data, setData] = useState<PublicLinkData | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!cleanUsername) return;
    (async () => {
      try {
        const res = await fetch(`${API_BASE}/l/${encodeURIComponent(cleanUsername)}`, { headers: { Accept: "application/json" } });
        if (res.status === 404) { setNotFound(true); return; }
        if (!res.ok) { setNotFound(true); return; }
        const j = await res.json();
        const d = j?.success ? j?.data : j;
        setData(d?.data ?? d);
      } catch { setNotFound(true); }
      finally { setLoading(false); }
    })();
  }, [cleanUsername]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin" style={{ color: '#2164b6' }} />
      </div>
    );
  }

  if (notFound || !data) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6 text-center space-y-4">
        <div className="p-4 rounded-full bg-destructive/10 text-destructive"><AlertTriangle className="h-8 w-8" /></div>
        <h2 className="text-xl font-bold text-foreground">Page Not Found</h2>
        <p className="text-sm text-muted-foreground max-w-sm">This link-in-bio page doesn't exist. The user may not have set up their page yet.</p>
        <Link to="/app" className="text-xs font-bold text-[#2164b6] hover:underline">Go to MurihSpace</Link>
      </div>
    );
  }

  const tf = data.font === 'serif' ? 'serif' : data.font === 'mono' ? 'monospace' : 'sans-serif';

  return (
    <div className="min-h-screen flex flex-col items-center py-12 px-4 transition-all duration-300"
      style={{
        ...bgStyle(data),
        color: data.text_color,
        fontFamily: tf,
      }}
    >
      <div className="w-full max-w-sm mx-auto">
        {/* Banner hero */}
        <div className="h-40 rounded-2xl overflow-hidden shadow-lg"
          style={{ background: data.banner_url ? 'transparent' : `linear-gradient(135deg, ${data.accent}40 0%, ${data.accent}20 100%)` }}>
          {data.banner_url ? (
            <img src={data.banner_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <Globe className="h-12 w-12" style={{ color: `${data.accent}40` }} />
            </div>
          )}
        </div>

        <div className="px-4 -mt-10 relative z-10 text-center space-y-4">
          {/* Avatar overlapping banner */}
          <div className="w-20 h-20 rounded-full mx-auto flex items-center justify-center overflow-hidden shadow-lg border-4"
            style={{ background: `${data.accent}20`, borderColor: (bgStyle(data).background as string) || data.bg, color: data.accent }}>
            {data.avatar_url ? (
              <img src={data.avatar_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <Globe className="h-10 w-10" />
            )}
          </div>

          {/* Profile Info */}
          <div className="space-y-1">
            <h1 className="text-xl font-black tracking-tight">{data.profile_name || `@${data.username}`}</h1>
            {data.profile_bio && (
              <p className="text-sm" style={{ color: `${data.text_color}aa` }}>{data.profile_bio}</p>
            )}
          </div>

          {/* Social Links */}
          {data.social_links && data.social_links.length > 0 && (
            <div className="flex justify-center gap-3">
              {data.social_links.map((s) => (
                <a key={s.id} href={s.url} target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-full flex items-center justify-center transition-transform hover:scale-110"
                  style={{ background: `${data.accent}20`, color: data.accent }}>
                  <SocialIcon platform={s.platform} accent={data.accent} />
                </a>
              ))}
            </div>
          )}

          {/* Links */}
          <div className={`space-y-3 ${data.layout === 'grid' ? 'grid grid-cols-2 gap-3' : ''}`}>
            {data.links.map((link) => (
              <a
                key={link.id}
                href={`${API_BASE}/l/click/${link.id}`}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center justify-between px-5 py-3.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${btnRadius(data.button_style)}`}
                style={{
                  background: data.card_bg,
                  color: data.text_color,
                  border: `1px solid ${data.text_color}15`,
                  boxShadow: `0 2px 8px ${data.accent}10`,
                }}
              >
                <span className="truncate">{link.title}</span>
                <ExternalLink className="h-4 w-4 shrink-0 ml-2" style={{ color: data.accent }} />
              </a>
            ))}
            {data.links.length === 0 && (
              <p className="text-sm py-8" style={{ color: `${data.text_color}60` }}>No links yet</p>
            )}
          </div>

          {/* Products */}
          {data.products && data.products.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center justify-center gap-2">
                <ShoppingCart className="h-3.5 w-3.5" /> Products
              </h3>
              <div className="space-y-2">
                {data.products.map((p) => (
                  <a
                    key={p.id}
                    href={p.checkout_url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center gap-3 p-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${btnRadius(data.button_style)}`}
                    style={{
                      background: data.card_bg,
                      color: data.text_color,
                      border: `1px solid ${data.text_color}15`,
                      boxShadow: `0 2px 8px ${data.accent}10`,
                    }}
                  >
                    {p.media_url
                      ? <img src={p.media_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
                      : <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${data.accent}20` }}>
                          <Tag className="h-5 w-5" style={{ color: data.accent }} />
                        </div>}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold truncate">{p.title}</p>
                      {p.description && <p className="text-xs truncate mt-0.5" style={{ color: `${data.text_color}99` }}>{p.description}</p>}
                      <p className="text-xs font-bold mt-0.5" style={{ color: data.accent }}>{p.currency} {p.price}</p>
                    </div>
                    <span className="text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap" style={{ background: data.accent, color: '#fff' }}>
                      Buy Now
                    </span>
                  </a>
                ))}
              </div>
              <p className="text-[10px] opacity-40">Powered by MurihSpace</p>
            </div>
          )}

          {/* Footer */}
          <div className="pt-4">
            <a
              href="/app"
              className="inline-flex items-center gap-1.5 text-xs font-bold opacity-50 hover:opacity-100 transition-opacity"
              style={{ color: data.text_color }}
            >
              <Crown className="h-3 w-3" /> MurihSpace
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
