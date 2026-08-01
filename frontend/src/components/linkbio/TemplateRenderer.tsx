import { Globe, ExternalLink, ShoppingCart, Tag, Camera, Music, Hash, Film, MessageCircle, Send, Link as LinkIcon, Crown, ChevronRight } from "lucide-react";
import type { LinkBioPageData, LinkBioLinkItem, LinkBioProductItem, LinkBioSocial } from "@/lib/linkBioTypes";
import { templateBySlug, pageBackground, buttonRadius, fontFamily, avatarRadius } from "@/lib/linkBioTemplates";

export function SocialIcon({ platform, className = "h-4 w-4" }: { platform: string; className?: string }) {
  const icon: Record<string, React.ReactNode> = {
    instagram: <Camera className={className} />,
    twitter: <Hash className={className} />,
    tiktok: <Music className={className} />,
    youtube: <Film className={className} />,
    facebook: <MessageCircle className={className} />,
    snapchat: <Send className={className} />,
    linkedin: <LinkIcon className={className} />,
    github: <LinkIcon className={className} />,
  };
  return <>{icon[platform] ?? <LinkIcon className={className} />}</>;
}

function Avatar({ data, size, className }: { data: LinkBioPageData; size: number; className?: string }) {
  const def = templateBySlug(data.template);
  return (
    <div
      className={`flex items-center justify-center overflow-hidden shadow-md ${avatarRadius(def.avatar_shape)} ${className ?? ""}`}
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
        <Globe style={{ width: size * 0.45, height: size * 0.45 }} />
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
          href={s.url}
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

function LinkButton({ data, link, href, transparent }: { data: LinkBioPageData; link: LinkBioLinkItem; href: string; transparent?: boolean }) {
  const def = templateBySlug(data.template);
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`flex items-center justify-between px-5 py-3.5 text-sm font-bold transition-all hover:scale-[1.02] active:scale-[0.98] ${buttonRadius(data.button_style)}`}
      style={{
        background: transparent ? `${data.card_bg}${def.slug === "portal" ? "88" : ""}` : data.card_bg,
        color: data.text_color,
        border: `1px solid ${data.text_color}15`,
        boxShadow: `0 2px 8px ${data.accent}12`,
        backdropFilter: def.slug === "portal" ? "blur(8px)" : undefined,
      }}
    >
      <span className="truncate">{link.title}</span>
      <ExternalLink className="h-4 w-4 shrink-0 ml-2" style={{ color: data.accent }} />
    </a>
  );
}

function ProductCard({ data, p, href }: { data: LinkBioPageData; p: LinkBioProductItem; href: string }) {
  return (
    <a
      href={href}
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
          <Tag className="h-5 w-5" style={{ color: data.accent }} />
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
        <ShoppingCart className="h-3.5 w-3.5" /> Products
      </h3>
      <div className="space-y-2">
        {data.products.map((p) => (
          <ProductCard key={p.id} data={data} p={p} href={hrefFor(p)} />
        ))}
      </div>
    </div>
  );
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
    case "grid":
      return (
        <div className="min-h-screen flex flex-col items-center py-12 px-4 transition-all duration-300" style={common}>
          <div className="w-full max-w-sm mx-auto space-y-4 text-center">
            <Avatar data={data} size={84} className="mx-auto" />
            <div className="space-y-1">
              <h1 className="text-xl font-black tracking-tight">{name}</h1>
              {data.profile_bio && <p className="text-sm" style={{ color: `${data.text_color}aa` }}>{data.profile_bio}</p>}
            </div>
            <SocialRow socials={socials} accent={data.accent} />
            <div className="grid grid-cols-2 gap-3">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={hrefForLink(link)}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex flex-col items-center justify-center gap-1 px-3 py-5 text-sm font-bold text-center transition-all hover:scale-[1.02] ${buttonRadius(data.button_style)}`}
                  style={{ background: data.card_bg, color: data.text_color, border: `1px solid ${data.text_color}15` }}
                >
                  <ExternalLink className="h-4 w-4" style={{ color: data.accent }} />
                  <span className="truncate w-full">{link.title}</span>
                </a>
              ))}
            </div>
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-2"><Footer data={data} /></div>
          </div>
        </div>
      );

    case "cards":
      return (
        <div className="min-h-screen flex flex-col items-center py-12 px-4 transition-all duration-300" style={common}>
          <div className="w-full max-w-sm mx-auto space-y-5 text-center">
            <Avatar data={data} size={92} className="mx-auto" />
            <div className="space-y-1">
              <h1 className="text-2xl font-black tracking-tight">{name}</h1>
              {data.profile_bio && <p className="text-sm" style={{ color: `${data.text_color}aa` }}>{data.profile_bio}</p>}
            </div>
            <SocialRow socials={socials} accent={data.accent} />
            <div className="space-y-3">
              {links.map((link, i) => (
                <a
                  key={link.id}
                  href={hrefForLink(link)}
                  target="_blank"
                  rel="noreferrer"
                  className={`flex items-center gap-4 px-5 py-4 text-sm font-bold transition-all hover:scale-[1.02] ${buttonRadius(data.button_style)}`}
                  style={{ background: data.card_bg, color: data.text_color, border: `1px solid ${data.text_color}15`, boxShadow: `0 6px 18px ${data.accent}15` }}
                >
                  <span className="w-9 h-9 rounded-full flex items-center justify-center shrink-0" style={{ background: `${data.accent}20`, color: data.accent }}>
                    <SocialIcon platform={socials[i % socials.length]?.platform ?? ""} className="h-4 w-4" />
                  </span>
                  <span className="flex-1 text-left truncate">{link.title}</span>
                  <ChevronRight className="h-4 w-4 shrink-0" style={{ color: data.accent }} />
                </a>
              ))}
            </div>
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-2"><Footer data={data} /></div>
          </div>
        </div>
      );

    case "terminal":
      return (
        <div className="min-h-screen flex flex-col items-center py-12 px-4 transition-all duration-300" style={common}>
          <div className="w-full max-w-sm mx-auto space-y-3">
            <div className="text-xs font-bold opacity-60" style={{ color: data.accent }}>
              murihspace://{data.username}
            </div>
            <div className="flex items-center gap-4 p-4" style={{ background: `${data.card_bg}66`, border: `1px solid ${data.accent}30` }}>
              <Avatar data={data} size={56} />
              <div className="min-w-0">
                <h1 className="text-base font-bold truncate" style={{ color: data.accent }}>&gt; {name}</h1>
                {data.profile_bio && <p className="text-xs mt-0.5 opacity-70 truncate">{data.profile_bio}</p>}
              </div>
            </div>
            <SocialRow socials={socials} accent={data.accent} center={false} />
            <div className="space-y-1.5 pt-2">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={hrefForLink(link)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between px-4 py-2.5 text-sm font-bold transition-colors hover:opacity-80"
                  style={{ background: data.card_bg, color: data.text_color, borderLeft: `3px solid ${data.accent}` }}
                >
                  <span className="truncate">~/ {link.title}</span>
                  <span style={{ color: data.accent }}>→</span>
                </a>
              ))}
            </div>
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-1 text-xs opacity-50" style={{ color: data.text_color }}>$ end of profile</div>
          </div>
        </div>
      );

    case "magazine":
      return (
        <div className="min-h-screen flex flex-col items-center py-12 px-4 transition-all duration-300" style={common}>
          <div className="w-full max-w-sm mx-auto space-y-5">
            <div className="text-center">
              <h1 className="text-3xl font-black uppercase tracking-tight">{name}</h1>
              <div className="mx-auto mt-2 h-px w-24" style={{ background: data.accent }} />
              {data.profile_bio && <p className="text-sm mt-2 italic" style={{ color: `${data.text_color}99` }}>{data.profile_bio}</p>}
            </div>
            <div className="flex justify-center"><Avatar data={data} size={76} /></div>
            <SocialRow socials={socials} accent={data.accent} />
            <div className="space-y-0 divide-y" style={{ borderColor: `${data.text_color}15` }}>
              {links.map((link) => (
                <a
                  key={link.id}
                  href={hrefForLink(link)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between py-3.5 text-base font-bold transition-colors hover:opacity-70"
                >
                  <span className="truncate">{link.title}</span>
                  <span style={{ color: data.accent }}>↗</span>
                </a>
              ))}
            </div>
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-2"><Footer data={data} /></div>
          </div>
        </div>
      );

    case "storefront":
      return (
        <div className="min-h-screen flex flex-col items-center py-12 px-4 transition-all duration-300" style={common}>
          <div className="w-full max-w-sm mx-auto">
            <div className="h-44 rounded-2xl overflow-hidden shadow-lg" style={{ background: data.banner_url ? "transparent" : `linear-gradient(135deg, ${data.accent}40 0%, ${data.accent}20 100%)` }}>
              {data.banner_url ? (
                <img src={data.banner_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><ShoppingCart className="h-12 w-12" style={{ color: `${data.accent}40` }} /></div>
              )}
            </div>
            <div className="px-4 -mt-10 relative z-10 text-center space-y-4">
              <Avatar data={data} size={80} className="mx-auto" />
              <div className="space-y-1">
                <h1 className="text-xl font-black tracking-tight">{name}</h1>
                {data.profile_bio && <p className="text-sm" style={{ color: `${data.text_color}aa` }}>{data.profile_bio}</p>}
              </div>
              <SocialRow socials={socials} accent={data.accent} />
              <ProductsBlock data={data} hrefFor={hrefForProduct} />
              <div className={`space-y-2 ${data.layout === "grid" ? "grid grid-cols-2 gap-2" : ""}`}>
                {links.map((link) => <LinkButton key={link.id} data={data} link={link} href={hrefForLink(link)} />)}
              </div>
              <div className="pt-1"><Footer data={data} /></div>
            </div>
          </div>
        </div>
      );

    case "portal":
      return (
        <div className="min-h-screen flex flex-col items-center py-12 px-4 transition-all duration-300" style={common}>
          <div className="w-full max-w-sm mx-auto space-y-5 text-center">
            <Avatar data={data} size={96} className="mx-auto" />
            <div className="space-y-1">
              <h1 className="text-xl font-black tracking-tight">{name}</h1>
              {data.profile_bio && <p className="text-sm" style={{ color: `${data.text_color}aa` }}>{data.profile_bio}</p>}
            </div>
            <SocialRow socials={socials} accent={data.accent} size="lg" />
            <div className="space-y-3">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={hrefForLink(link)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between px-5 py-4 text-sm font-bold transition-all hover:scale-[1.02]"
                  style={{
                    background: `${data.card_bg}66`,
                    color: data.text_color,
                    border: `1px solid ${data.text_color}18`,
                    backdropFilter: "blur(12px)",
                    WebkitBackdropFilter: "blur(12px)",
                    boxShadow: `0 8px 24px ${data.accent}22`,
                  }}
                >
                  <span className="truncate">{link.title}</span>
                  <ExternalLink className="h-4 w-4 shrink-0 ml-2" style={{ color: data.accent }} />
                </a>
              ))}
            </div>
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-2"><Footer data={data} /></div>
          </div>
        </div>
      );

    case "social":
      return (
        <div className="min-h-screen flex flex-col items-center py-12 px-4 transition-all duration-300" style={common}>
          <div className="w-full max-w-sm mx-auto space-y-5 text-center">
            <Avatar data={data} size={84} className="mx-auto" />
            <div className="space-y-1">
              <h1 className="text-xl font-black tracking-tight">{name}</h1>
              {data.profile_bio && <p className="text-sm" style={{ color: `${data.text_color}aa` }}>{data.profile_bio}</p>}
            </div>
            {socials.length > 0 && (
              <div className="grid grid-cols-2 gap-2.5">
                {socials.map((s) => (
                  <a
                    key={s.id}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`flex items-center justify-center gap-2 px-4 py-3 text-xs font-bold transition-transform hover:scale-[1.03] ${buttonRadius(data.button_style)}`}
                    style={{ background: data.card_bg, color: data.text_color, border: `1px solid ${data.text_color}15` }}
                  >
                    <SocialIcon platform={s.platform} className="h-4 w-4" />
                    <span className="capitalize">{s.platform}</span>
                  </a>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {links.map((link) => <LinkButton key={link.id} data={data} link={link} href={hrefForLink(link)} />)}
            </div>
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-2"><Footer data={data} /></div>
          </div>
        </div>
      );

    case "compact":
      return (
        <div className="min-h-screen flex flex-col items-center py-12 px-5 transition-all duration-300" style={common}>
          <div className="w-full max-w-sm mx-auto">
            <div className="flex items-center gap-4 mb-5">
              <Avatar data={data} size={56} />
              <div className="min-w-0">
                <h1 className="text-base font-black tracking-tight truncate">{name}</h1>
                {data.profile_bio && <p className="text-xs mt-0.5 truncate" style={{ color: `${data.text_color}88` }}>{data.profile_bio}</p>}
              </div>
            </div>
            <SocialRow socials={socials} accent={data.accent} size="sm" center={false} />
            <div className="space-y-1.5 mt-4">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={hrefForLink(link)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between px-3.5 py-2.5 text-sm font-medium transition-colors hover:opacity-80"
                  style={{ background: data.card_bg, color: data.text_color, borderBottom: `1px solid ${data.text_color}10` }}
                >
                  <span className="truncate">{link.title}</span>
                  <span className="text-xs" style={{ color: `${data.accent}` }}>›</span>
                </a>
              ))}
            </div>
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-3"><Footer data={data} /></div>
          </div>
        </div>
      );

    case "bold":
      return (
        <div className="min-h-screen flex flex-col items-center py-12 px-4 transition-all duration-300" style={common}>
          <div className="w-full max-w-sm mx-auto space-y-5 text-center">
            <div className="py-3 text-[11px] font-black uppercase tracking-[0.3em] opacity-50">MurihSpace</div>
            <Avatar data={data} size={104} className="mx-auto" />
            <div className="space-y-1">
              <h1 className="text-2xl font-black uppercase tracking-tight">{name}</h1>
              {data.profile_bio && <p className="text-sm" style={{ color: `${data.text_color}aa` }}>{data.profile_bio}</p>}
            </div>
            <SocialRow socials={socials} accent={data.accent} size="lg" />
            <div className="space-y-3">
              {links.map((link) => (
                <a
                  key={link.id}
                  href={hrefForLink(link)}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center justify-between w-full px-5 py-4 text-sm font-black uppercase tracking-wide transition-transform hover:scale-[1.02] active:scale-[0.98]"
                  style={{ background: data.card_bg, color: data.text_color, border: `2px solid ${data.accent}55` }}
                >
                  <span className="truncate">{link.title}</span>
                  <span className="text-lg" style={{ color: data.accent }}>→</span>
                </a>
              ))}
            </div>
            <ProductsBlock data={data} hrefFor={hrefForProduct} />
            <div className="pt-2"><Footer data={data} /></div>
          </div>
        </div>
      );

    // minimal (default)
    default:
      return (
        <div className="min-h-screen flex flex-col items-center py-12 px-4 transition-all duration-300" style={common}>
          <div className="w-full max-w-sm mx-auto">
            <div className="h-40 rounded-2xl overflow-hidden shadow-lg" style={{ background: data.banner_url ? "transparent" : `linear-gradient(135deg, ${data.accent}40 0%, ${data.accent}20 100%)` }}>
              {data.banner_url ? (
                <img src={data.banner_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
              ) : (
                <div className="w-full h-full flex items-center justify-center"><Globe className="h-12 w-12" style={{ color: `${data.accent}40` }} /></div>
              )}
            </div>
            <div className="px-4 -mt-10 relative z-10 text-center space-y-4">
              <Avatar data={data} size={80} className="mx-auto" />
              <div className="space-y-1">
                <h1 className="text-xl font-black tracking-tight">{name}</h1>
                {data.profile_bio && <p className="text-sm" style={{ color: `${data.text_color}aa` }}>{data.profile_bio}</p>}
              </div>
              <SocialRow socials={socials} accent={data.accent} />
              <div className={`space-y-3 ${data.layout === "grid" ? "grid grid-cols-2 gap-3" : ""}`}>
                {links.map((link) => <LinkButton key={link.id} data={data} link={link} href={hrefForLink(link)} />)}
                {links.length === 0 && <p className="text-sm py-8" style={{ color: `${data.text_color}60` }}>No links yet</p>}
              </div>
              <ProductsBlock data={data} hrefFor={hrefForProduct} />
              <div className="pt-2"><Footer data={data} /></div>
            </div>
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
        <Crown className="h-3 w-3" /> MurihSpace
      </a>
    </div>
  );
}
