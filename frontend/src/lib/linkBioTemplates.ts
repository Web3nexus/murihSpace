import type { LinkBioPageData } from "./linkBioTypes";

export type TemplateSlug =
  | "minimal"
  | "grid"
  | "cards"
  | "terminal"
  | "magazine"
  | "storefront"
  | "portal"
  | "social"
  | "compact"
  | "bold";

export type FontKey = "sans" | "serif" | "mono";
export type ButtonKey = "rounded" | "pill" | "sharp";
export type BackgroundKey = "solid" | "gradient" | "image";
export type AvatarShape = "circle" | "rounded" | "square";

export interface TemplateDef {
  slug: TemplateSlug;
  name: string;
  tagline: string;
  description: string;
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
  avatar_shape: AvatarShape;
  shadow: "none" | "sm" | "md" | "lg";
}

export const TEMPLATES: TemplateDef[] = [
  {
    slug: "minimal",
    name: "Minimal",
    tagline: "Clean & simple",
    description: "A centered avatar and a tidy stacked list. Perfect for getting started.",
    palette: {
      bg: "#ffffff", card_bg: "#f5f5f5", text_color: "#1a1a1a", accent: "#2164b6",
      font: "sans", button_style: "rounded", background_type: "solid", background_value: null,
    },
    avatar_shape: "circle",
    shadow: "sm",
  },
  {
    slug: "grid",
    name: "Grid",
    tagline: "Neat tiles",
    description: "Links arranged in a balanced two-column tile grid.",
    palette: {
      bg: "#f0f7ff", card_bg: "#ffffff", text_color: "#1a2a3a", accent: "#2a6a9a",
      font: "sans", button_style: "pill", background_type: "solid", background_value: null,
    },
    avatar_shape: "circle",
    shadow: "sm",
  },
  {
    slug: "cards",
    name: "Cards",
    tagline: "Big & friendly",
    description: "Large card-style buttons with generous spacing and rounded corners.",
    palette: {
      bg: "#0a0a0a", card_bg: "#1a1a1a", text_color: "#f5f5f5", accent: "#2164b6",
      font: "sans", button_style: "pill", background_type: "solid", background_value: null,
    },
    avatar_shape: "circle",
    shadow: "md",
  },
  {
    slug: "terminal",
    name: "Terminal",
    tagline: "Hacker vibes",
    description: "Monospace type, sharp corners and a command-line feel.",
    palette: {
      bg: "#0a0a0a", card_bg: "#111122", text_color: "#00ff88", accent: "#ff00ff",
      font: "mono", button_style: "sharp", background_type: "solid", background_value: null,
    },
    avatar_shape: "square",
    shadow: "none",
  },
  {
    slug: "magazine",
    name: "Magazine",
    tagline: "Editorial & bold",
    description: "Serif typography, an uppercase masthead and underlined rows.",
    palette: {
      bg: "#faf8f0", card_bg: "#ffffff", text_color: "#3a3020", accent: "#c4a050",
      font: "serif", button_style: "rounded", background_type: "solid", background_value: null,
    },
    avatar_shape: "rounded",
    shadow: "sm",
  },
  {
    slug: "storefront",
    name: "Storefront",
    tagline: "Shop-ready",
    description: "A banner hero with products up front so people can shop fast.",
    palette: {
      bg: "#f0f7ff", card_bg: "#ffffff", text_color: "#1a2a3a", accent: "#2a6a9a",
      font: "sans", button_style: "pill", background_type: "solid", background_value: null,
    },
    avatar_shape: "circle",
    shadow: "md",
  },
  {
    slug: "portal",
    name: "Portal",
    tagline: "Glass & glow",
    description: "Frosted glass cards floating on a dreamy gradient.",
    palette: {
      bg: "#0a0a1a", card_bg: "#1a1a2a", text_color: "#e0e0ff", accent: "#6a6aff",
      font: "sans", button_style: "rounded", background_type: "gradient",
      background_value: "linear-gradient(160deg, #0a0a1a 0%, #1a0a2a 45%, #0a2a1a 100%)",
    },
    avatar_shape: "circle",
    shadow: "lg",
  },
  {
    slug: "social",
    name: "Social",
    tagline: "Social-first",
    description: "Big social buttons up top with a minimal link list beneath.",
    palette: {
      bg: "#fff5f7", card_bg: "#ffffff", text_color: "#4a1a2a", accent: "#e84a7a",
      font: "sans", button_style: "pill", background_type: "solid", background_value: null,
    },
    avatar_shape: "circle",
    shadow: "sm",
  },
  {
    slug: "compact",
    name: "Compact",
    tagline: "Tight & tidy",
    description: "A small left-aligned profile with slim, efficient link rows.",
    palette: {
      bg: "#f0f7f0", card_bg: "#ffffff", text_color: "#1a3a1a", accent: "#2d8a4e",
      font: "sans", button_style: "sharp", background_type: "solid", background_value: null,
    },
    avatar_shape: "rounded",
    shadow: "none",
  },
  {
    slug: "bold",
    name: "Bold",
    tagline: "High contrast",
    description: "Full-width, high-contrast buttons with uppercase labels.",
    palette: {
      bg: "#0a0a0a", card_bg: "#1a1a1a", text_color: "#ffffff", accent: "#ff6b5a",
      font: "sans", button_style: "sharp", background_type: "solid", background_value: null,
    },
    avatar_shape: "circle",
    shadow: "lg",
  },
];

export function templateBySlug(slug?: string | null): TemplateDef {
  return TEMPLATES.find((t) => t.slug === slug) ?? TEMPLATES[0];
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
