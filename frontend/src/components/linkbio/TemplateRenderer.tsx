import { safeHref } from "@/lib/safeUrl";
import { Discovery as Globe, Bag as ShoppingCart, Ticket as Tag, Camera, Video as FilmStrip, Chat as MessageCircle, Send, ArrowRight as ChevronRight } from "@/components/icons";
import { MusicNote as Music, Hash, Link as LinkIcon, Crown } from "@/components/icons/rounded";;
import type { LinkBioPageData, LinkBioLinkItem, LinkBioProductItem, LinkBioSocial } from "@/lib/linkBioTypes";
import { templateBySlug, pageBackground, buttonRadius, fontFamily, avatarRadius, cardTextColor } from "@/lib/linkBioTemplates";

export function SocialIcon({ platform, className = "h-4 w-4" }: { platform: string; className?: string }) {
  const icon: Record<string, React.ReactNode> = {
    instagram: <Camera weight="fill" className={className} />,
    twitter: <Hash weight="fill" className={className} />,
    tiktok: <Music weight="fill" className={className} />,
    youtube: <FilmStrip weight="fill" className={className} />,
    facebook: <MessageCircle weight="fill" className={className} />,
    snapchat: <Send weight="fill" className={className} />,
    linkedin: <LinkIcon weight="fill" className={className} />,
    github: <LinkIcon weight="fill" className={className} />,
  };
  return <>{icon[platform] ?? <LinkIcon weight="fill" className={className} />}</>;
}

function Avatar({ data, size, className }: { data: LinkBioPageData; size: number; className?: string }) {
  const def = templateBySlug(data.template);
  return (
    <div
      className={`flex items-center justify-center overflow-hidden  ${avatarRadius(def.avatar_shape)} ${className ?? ""}`}
      style={{
        width: size,
        height: size,
        background: `${data.accent}20`,
        color: data.accent,
        border: `2px solid ${data.accent}40`,
      }}
    >
      {data.avatar_url ? (
        <img src={data.avatar_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <Globe weight="fill" style={{ width: size * 0.45, height: size * 0.45 }} />
      )}
    </div>
  );
}

function SocialRow({ socials, accent, size = "md", center = true }: { socials: LinkBioSocial[]; accent: string; size?: "sm" | "md" | "lg"; center?: boolean }) {
  const dim = size === "lg" ? "h-11 w-11" : size === "sm" ? "h-8 w-8" : "h-9 w-9";
  const icon = size === "lg" ? "h-5 w-5" : size === "sm" ? "h-3.5 w-3.5" : "h-4 w-4";
  if (socials.length === 0) return null;
  return (
    <div className={`flex ${center ? "justify-center" : "justify-start"} gap-2.5`}>
      {socials.map((s) => (
        <a
          key={s.id}
          href={safeHref(s.url)}
          target="_blank"
          rel="noopener noreferrer"
          className={`${dim} rounded-full flex items-center justify-center transition-transform hover:scale-110`}
          style={{ background: `${accent}20`, color: accent }}
        >
          <SocialIcon platform={s.platform} className={icon} />
        </a>
      ))}
    </div>
  );
}

function ProductCard({ data, p, href }: { data: LinkBioPageData; p: LinkBioProductItem; href: string }) {
  return (
    <a
      href={safeHref(href)}
      target="_blank"
      rel="noopener noreferrer"
      className={`flex items-center gap-3 p-3 text-left transition-all hover:scale-[1.01] active:scale-[0.99] ${buttonRadius(data.button_style)}`}
      style={{
        background: data.card_bg,
        color: data.text_color,
        border: `1px solid ${data.text_color}15`,
        boxShadow: `0 2px 8px ${data.accent}12`,
      }}
    >
      {p.media_url ? (
        <img src={p.media_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
      ) : (
        <div className="w-12 h-12 rounded-lg flex items-center justify-center shrink-0" style={{ background: `${data.accent}20` }}>
          <Tag weight="fill" className="h-5 w-5" style={{ color: data.accent }} />
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-bold truncate">{p.title}</p>
        {p.description && <p className="text-xs truncate mt-0.5" style={{ color: `${data.text_color}99` }}>{p.description}</p>}
        <p className="text-xs font-bold mt-0.5" style={{ color: data.accent }}>{p.currency} {p.price}</p>
      </div>
      <span className="text-xs font-bold px-3 py-1.5 rounded-lg whitespace-nowrap" style={{ background: data.accent, color: "#fff" }}>
        Buy
      </span>
    </a>
  );
}

function ProductsBlock({ data, hrefFor }: { data: LinkBioPageData; hrefFor: (p: LinkBioProductItem) => string }) {
  if (!data.products || data.products.length === 0) return null;
  return (
    <div className="space-y-3">
      <h3 className="text-xs font-bold uppercase tracking-wider opacity-60 flex items-center justify-center gap-2">
        <ShoppingCart weight="fill" className="h-3.5 w-3.5" /> Products
      </h3>
      <div className="space-y-2">
        {data.products.map((p) => (
          <ProductCard key={p.id} data={data} p={p} href={hrefFor(p)} />
        ))}
      </div>
    </div>
  );
}

const DISPLAY_FONT = "Georgia, 'Times New Roman', serif";

function LinkImage({ src, tint, color, className }: { src?: string | null; tint: string; color: string; className: string }) {
  if (src) {
    return <img src={src} alt="" className={`object-cover ${className}`} onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />;
  }
  return (
    <div className={`flex items-center justify-center ${className}`} style={{ background: tint }}>
      <LinkIcon weight="fill" className="h-6 w-6" style={{ color }} />
    </div>
  );
}

function HeroImage({ data }: { data: LinkBioPageData }) {
  const src = data.banner_url || data.avatar_url;
  if (!src) {
    return <div className="absolute inset-0" style={{ background: `linear-gradient(135deg, ${data.accent}66, ${data.accent}22)` }} />;
  }
  return (
    <img src={src} alt="" className="absolute inset-0 w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
  );
}

function Eyebrow({ text, color }: { text?: string | null; color: string }) {
  if (!text || text === "General") return null;
  return <p className="text-[10px] font-bold uppercase tracking-[0.2em] mb-1" style={{ color }}>{text}</p>;
}

export interface TemplateRendererProps {
  data: LinkBioPageData;
  linkHref?: (link: LinkBioLinkItem) => string;
  productHref?: (p: LinkBioProductItem) => string;
}

export default function TemplateRenderer({ data, linkHref, productHref }: TemplateRendererProps) {
  const def = templateBySlug(data.template);
  const hrefForLink = (l: LinkBioLinkItem) => (linkHref ? linkHref(l) : l.url);
  const hrefForProduct = (p: LinkBioProductItem) => (productHref ? productHref(p) : p.checkout_url ?? "#");
  const tf = fontFamily(data.font);

  const common = {
    ...pageBackground(data),
    color: data.text_color,
    fontFamily: tf,
  };

  const name = data.profile_name || `@${data.username}`;
  const socials = data.social_links ?? [];
  const links = data.links ?? [];

  switch (def.slug) {
    default:
    case "hero":
      return (
        <div className="min-h-screen flex flex-col items-center pb-12 transition-all duration-300" style={common}>
          <div className="relative w-full h-72 overflow-hidden">
            <HeroImage data={data} />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 35%, ${data.bg} 100%)` }} />
            <div className="absolute inset-x-0 bottom-3 px-6 text-center">
              <h1 className="text-3xl font-black italic leading-tight" style={{ fontFamily: DISPLAY_FONT }}>{name}</h1>
              {data.profile_bio && <p className="text-xs mt-1 opacity-75">{data.profile_bio}</p>}
            </div>
          </div>
          <div className="w-full max-w-sm mx-auto px-5 space-y-4">
            <SocialRow socials={socials} accent={data.accent} />
            <div className="space-y-3">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={safeHref(hrefForLink(link))}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-4 p-3 rounded-2xl transition-transform hover:scale-[1.02]"
                  style={{ background: data.card_bg, color: data.text_color, boxShadow: `0 6px 18px ${data.accent}1f` }}
                >
                  <div className="flex-1 min-w-0 px-1">
                    <Eyebrow text={link.category} color={data.accent} />
                    <p className="text-lg font-bold leading-snug" style={{ fontFamily: DISPLAY_FONT }}>{link.title}</p>
                  </div>
                  <LinkImage src={link.image_url} tint={`${data.accent}20`} color={data.accent} className="h-20 w-20 rounded-xl shrink-0" />
                </a>
              ))}
            </div>
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-2 text-center"><Footer data={data} /></div>
          </div>
        </div>
      );

    case "boutique":
      return (
        <div className="min-h-screen flex flex-col items-center pb-12 transition-all duration-300" style={common}>
          <div className="relative w-full h-64 overflow-hidden">
            <HeroImage data={data} />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 30%, ${data.bg} 100%)` }} />
          </div>
          <div className="w-full max-w-sm mx-auto px-5 -mt-6 relative space-y-6 text-center">
            <div className="space-y-2">
              <h1 className="text-2xl font-black uppercase tracking-[0.18em]" style={{ fontFamily: DISPLAY_FONT, color: data.accent }}>{name}</h1>
              <div className="mx-auto h-px w-16" style={{ background: data.accent }} />
              {data.profile_bio && <p className="text-xs" style={{ color: `${data.text_color}aa` }}>{data.profile_bio}</p>}
            </div>
            <SocialRow socials={socials} accent={data.accent} />
            <div className="space-y-3">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={safeHref(hrefForLink(link))}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-4 p-3 rounded-xl transition-transform hover:scale-[1.02]"
                  style={{ background: `linear-gradient(120deg, ${data.card_bg} 0%, ${data.card_bg}cc 100%)`, color: cardTextColor(data) }}
                >
                  <LinkImage src={link.image_url} tint="rgba(0,0,0,0.12)" color={data.text_color} className="h-16 w-16 rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0 text-left">
                    <Eyebrow text={link.category} color={`${cardTextColor(data)}99`} />
                    <p className="text-sm font-black uppercase tracking-wide truncate">{link.title}</p>
                  </div>
                  <ChevronRight weight="fill" className="h-4 w-4 shrink-0" />
                </a>
              ))}
            </div>
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-2"><Footer data={data} /></div>
          </div>
        </div>
      );

    case "atelier":
      return (
        <div className="min-h-screen flex flex-col items-center pb-12 transition-all duration-300" style={common}>
          <div className="relative w-full h-44 overflow-hidden">
            <HeroImage data={data} />
            <div className="absolute inset-x-0 bottom-0 h-1" style={{ background: data.accent }} />
          </div>
          <div className="w-full max-w-sm mx-auto px-5 -mt-14 relative z-10 space-y-6 text-center">
            <div className="mx-auto w-fit rounded-full p-1.5" style={{ background: data.accent, boxShadow: `0 0 0 4px ${data.bg}` }}>
              <Avatar data={data} size={108} />
            </div>
            <div className="space-y-2">
              <h1 className="text-2xl font-bold uppercase tracking-[0.12em]" style={{ fontFamily: DISPLAY_FONT, color: data.accent }}>{name}</h1>
              {data.profile_bio && <p className="text-[11px] uppercase tracking-[0.3em] opacity-80">{data.profile_bio}</p>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={safeHref(hrefForLink(link))}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-center px-3 py-3 text-xs font-bold uppercase tracking-wider truncate rounded-full transition-transform hover:scale-[1.03]"
                  style={{ background: `${data.card_bg}26`, color: data.text_color, border: `1px solid ${data.text_color}55` }}
                >
                  {link.title}
                </a>
              ))}
            </div>
            <SocialRow socials={socials} accent={data.accent} size="lg" />
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-2"><Footer data={data} /></div>
          </div>
        </div>
      );

    case "lookbook":
      return (
        <div className="min-h-screen flex flex-col items-center pb-12 transition-all duration-300" style={common}>
          <div className="relative w-full h-80 overflow-hidden">
            <HeroImage data={data} />
            <div className="absolute inset-0" style={{ background: "linear-gradient(to bottom, transparent 40%, rgba(0,0,0,0.6) 100%)" }} />
            <div className="absolute inset-x-0 bottom-5 px-6 text-center text-white">
              <h1 className="text-3xl italic leading-tight" style={{ fontFamily: DISPLAY_FONT }}>{name}</h1>
              {data.profile_bio && <p className="text-[11px] uppercase tracking-[0.25em] mt-1 opacity-85">{data.profile_bio}</p>}
            </div>
          </div>
          <div className="w-full max-w-sm mx-auto px-5 pt-5 space-y-4">
            <SocialRow socials={socials} accent={data.accent} />
            <div className="space-y-4">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={safeHref(hrefForLink(link))}
                  target="_blank"
                  rel="noreferrer"
                  className="flex overflow-hidden rounded-2xl min-h-[112px] transition-transform hover:scale-[1.02]"
                  style={{ background: data.card_bg, color: data.text_color, boxShadow: `0 8px 24px ${data.accent}1a` }}
                >
                  <div className="flex-1 min-w-0 p-5 flex flex-col justify-center">
                    <Eyebrow text={link.category} color={data.accent} />
                    <p className="text-xl leading-tight" style={{ fontFamily: DISPLAY_FONT }}>{link.title}</p>
                    <span className="mt-2 text-[11px] font-bold uppercase tracking-wider" style={{ color: data.accent }}>View →</span>
                  </div>
                  <LinkImage src={link.image_url} tint={`${data.accent}20`} color={data.accent} className="w-2/5 self-stretch shrink-0" />
                </a>
              ))}
            </div>
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-2 text-center"><Footer data={data} /></div>
          </div>
        </div>
      );

    case "showcase":
      return (
        <div className="min-h-screen flex flex-col items-center pb-12 transition-all duration-300" style={common}>
          <div className="relative w-full h-64 overflow-hidden">
            <HeroImage data={data} />
            <div className="absolute inset-0" style={{ background: `linear-gradient(to bottom, transparent 30%, ${data.bg} 100%)` }} />
          </div>
          <div className="w-full max-w-sm mx-auto px-5 -mt-8 relative space-y-5 text-center">
            <div className="space-y-2">
              <div className="mx-auto h-16 w-16 rounded-full p-1" style={{ background: data.accent }}>
                <Avatar data={data} size={56} className="!rounded-full" />
              </div>
              <h1 className="text-xl font-black uppercase tracking-[0.2em]" style={{ color: data.accent }}>{name}</h1>
              {data.profile_bio && <p className="text-xs" style={{ color: `${data.text_color}aa` }}>{data.profile_bio}</p>}
            </div>
            <SocialRow socials={socials} accent={data.accent} />
            <div className="space-y-3">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={safeHref(hrefForLink(link))}
                  target="_blank"
                  rel="noreferrer"
                  className="relative block h-28 overflow-hidden rounded-xl transition-transform hover:scale-[1.02]"
                  style={{ border: `1px solid ${data.accent}66` }}
                >
                  <LinkImage src={link.image_url} tint={data.card_bg} color={data.accent} className="absolute inset-0 w-full h-full" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(90deg, rgba(0,0,0,0.85) 25%, rgba(0,0,0,0.1) 100%)" }} />
                  <div className="relative h-full flex flex-col justify-center px-5 text-left">
                    <Eyebrow text={link.category} color={data.accent} />
                    <p className="text-lg font-black uppercase tracking-wide" style={{ color: data.accent }}>{link.title}</p>
                  </div>
                </a>
              ))}
            </div>
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-2"><Footer data={data} /></div>
          </div>
        </div>
      );

  }
}

function Footer({ data }: { data: LinkBioPageData }) {
  return (
    <div className="pt-3">
      <a
        href="/app"
        className="inline-flex items-center gap-1.5 text-xs font-bold opacity-50 hover:opacity-100 transition-opacity"
        style={{ color: data.text_color }}
      >
        <Crown weight="fill" className="h-3 w-3" /> MurihSpace
      </a>
    </div>
  );
}
