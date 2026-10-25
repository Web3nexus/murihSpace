import type { LinkBioPageData } from "./linkBioTypes";
import { readableOn } from "./colorContrast";

export type TemplateSlug = "hero" | "boutique" | "atelier" | "lookbook" | "showcase";

export type FontKey = "sans" | "serif" | "mono";
export type ButtonKey = "rounded" | "pill" | "sharp";
export type BackgroundKey = "solid" | "gradient" | "image";
export type AvatarShape = "circle" | "rounded" | "square";

/** A named colour set a creator can apply to a template in one click. */
export interface ColourScheme {
  name: string;
  bg: string;
  card_bg: string;
  text_color: string;
  accent: string;
}

export interface TemplateDef {
  slug: TemplateSlug;
  name: string;
  tagline: string;
  description: string;
  /** First scheme; kept as `palette` so the backend apply-template call stays unchanged. */
  palette: {
    bg: string;
    card_bg: string;
    text_color: string;
    accent: string;
    font: FontKey;
    button_style: ButtonKey;
    background_type: BackgroundKey;
    background_value: string | null;
  };
  schemes: ColourScheme[];
  avatar_shape: AvatarShape;
  shadow: "none" | "sm" | "md" | "lg";
}

function def(
  fields: Omit<TemplateDef, "palette">,
  font: FontKey,
  buttonStyle: ButtonKey,
): TemplateDef {
  const first = fields.schemes[0];
  return {
    ...fields,
    palette: {
      bg: first.bg,
      card_bg: first.card_bg,
      text_color: first.text_color,
      accent: first.accent,
      font,
      button_style: buttonStyle,
      background_type: "solid",
      background_value: null,
    },
  };
}

// Order matters: the first template is the default for new and migrated designs.
export const TEMPLATES: TemplateDef[] = [
  def({
    slug: "hero",
    name: "Hero",
    tagline: "Photo-led",
    description: "A full-bleed hero photo with your name over it and image cards for every link.",
    schemes: [
      { name: "Sage & Linen", bg: "#F3F0EA", card_bg: "#FFFFFF", text_color: "#2B3A2A", accent: "#4F5F3A" },
      { name: "Ivory & Olive", bg: "#FAF7F2", card_bg: "#FFFFFF", text_color: "#3A3A2E", accent: "#6F7A45" },
      { name: "Blush Stone", bg: "#F7EFEA", card_bg: "#FFFFFF", text_color: "#4A2E2A", accent: "#A8654C" },
      { name: "Slate Mist", bg: "#EEF1F3", card_bg: "#FFFFFF", text_color: "#1F2A36", accent: "#44647F" },
    ],
    avatar_shape: "circle",
    shadow: "md",
  }, "serif", "rounded"),
  def({
    slug: "boutique",
    name: "Boutique",
    tagline: "Dark & gold",
    description: "Dark page, gold gradient cards and a spaced-out uppercase masthead.",
    schemes: [
      { name: "Noir & Gold", bg: "#0E0E0E", card_bg: "#D4AF62", text_color: "#F5EFE3", accent: "#D4AF62" },
      { name: "Onyx & Champagne", bg: "#141414", card_bg: "#E8D9B5", text_color: "#F3EDE0", accent: "#C8A96A" },
      { name: "Midnight Rose", bg: "#120F12", card_bg: "#E7C9B6", text_color: "#F6EDE9", accent: "#D9A08A" },
      { name: "Emerald Vault", bg: "#0B1410", card_bg: "#1E3B30", text_color: "#F3EDE0", accent: "#C9A24A" },
    ],
    avatar_shape: "circle",
    shadow: "lg",
  }, "serif", "rounded"),
  def({
    slug: "atelier",
    name: "Atelier",
    tagline: "Warm & refined",
    description: "A banner with a ringed avatar, a two-column pill grid and a social bar.",
    schemes: [
      { name: "Cocoa & Cream", bg: "#6B3B2A", card_bg: "#F1E4D3", text_color: "#F6EBDC", accent: "#E7D3B0" },
      { name: "Espresso & Gold", bg: "#3B2418", card_bg: "#E9D8B4", text_color: "#F8EEDC", accent: "#D8B777" },
      { name: "Terracotta", bg: "#A4543A", card_bg: "#F5E6D6", text_color: "#FFF6EC", accent: "#F3DCC0" },
      { name: "Sage Clay", bg: "#5E6B4E", card_bg: "#EFE8D8", text_color: "#FBF7EE", accent: "#E3D2A8" },
    ],
    avatar_shape: "circle",
    shadow: "md",
  }, "serif", "pill"),
  def({
    slug: "lookbook",
    name: "Lookbook",
    tagline: "Soft editorial",
    description: "Light cards with an image beside each link, like a printed lookbook.",
    schemes: [
      { name: "Taupe Editorial", bg: "#E9E6E1", card_bg: "#FBFAF8", text_color: "#2A2623", accent: "#8A7560" },
      { name: "Sand & Sepia", bg: "#EFE7DC", card_bg: "#FFFDF9", text_color: "#3B2F25", accent: "#A07E5B" },
      { name: "Mist Grey", bg: "#E6E9EC", card_bg: "#FFFFFF", text_color: "#20262C", accent: "#5E7384" },
      { name: "Blush Paper", bg: "#F4E9E6", card_bg: "#FFFFFF", text_color: "#3A2A2A", accent: "#A8685C" },
    ],
    avatar_shape: "rounded",
    shadow: "md",
  }, "serif", "rounded"),
  def({
    slug: "showcase",
    name: "Showcase",
    tagline: "Full-bleed banners",
    description: "Dark page with wide photo banners for each link, label set over the image.",
    schemes: [
      { name: "Gold Standard", bg: "#101010", card_bg: "#1C1C1C", text_color: "#F2F2F2", accent: "#D4AF37" },
      { name: "Graphite & Brass", bg: "#161616", card_bg: "#242424", text_color: "#EDEDED", accent: "#C9A66B" },
      { name: "Deep Burgundy", bg: "#140A0C", card_bg: "#241116", text_color: "#F4E9EA", accent: "#D98C8C" },
      { name: "Royal Navy", bg: "#0C1220", card_bg: "#1A2540", text_color: "#EEF2FA", accent: "#E0B45B" },
    ],
    avatar_shape: "circle",
    shadow: "lg",
  }, "sans", "rounded"),
];

export const DEFAULT_TEMPLATE: TemplateSlug = TEMPLATES[0].slug;

export function templateBySlug(slug?: string | null): TemplateDef {
  return TEMPLATES.find((t) => t.slug === slug) ?? TEMPLATES[0];
}

/**
 * Colour for text sitting on a link card. Boutique cards are gold, so their text flips
 * between dark and light; every other template reads text_color on the card.
 */
export function cardTextColor(data: Pick<LinkBioPageData, "template" | "card_bg" | "text_color">): string {
  return data.template === "boutique" ? readableOn(data.card_bg) : data.text_color;
}

export function pageBackground(data: Pick<LinkBioPageData, "background_type" | "background_value" | "bg">): React.CSSProperties {
  if (data.background_type === "gradient" && data.background_value) {
    return { background: data.background_value };
  }
  if (data.background_type === "image" && data.background_value) {
    return {
      backgroundImage: `url(${data.background_value})`,
      backgroundSize: "cover",
      backgroundPosition: "center",
    };
  }
  return { background: data.bg };
}

export function buttonRadius(style: string): string {
  if (style === "pill") return "rounded-full";
  if (style === "sharp") return "rounded-none";
  return "rounded-xl";
}

export function fontFamily(font: string): string {
  if (font === "serif") return "Georgia, 'Times New Roman', serif";
  if (font === "mono") return "'JetBrains Mono', ui-monospace, SFMono-Regular, Menlo, monospace";
  return "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
}

export function avatarRadius(shape: string): string {
  if (shape === "square") return "rounded-lg";
  if (shape === "rounded") return "rounded-2xl";
  return "rounded-full";
}
