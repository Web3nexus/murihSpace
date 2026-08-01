import { Camera, Hash, Music, Film, MessageCircle, Send } from "lucide-react";
import type { TemplateDef } from "@/lib/linkBioTemplates";
import { pageBackground, buttonRadius } from "@/lib/linkBioTemplates";

const socialIcon: Record<string, React.ReactNode> = {
  instagram: <Camera className="h-1.5 w-1.5" />,
  twitter: <Hash className="h-1.5 w-1.5" />,
  tiktok: <Music className="h-1.5 w-1.5" />,
  youtube: <Film className="h-1.5 w-1.5" />,
  facebook: <MessageCircle className="h-1.5 w-1.5" />,
  snapchat: <Send className="h-1.5 w-1.5" />,
};

function LinkDots({ count, palette, wide }: { count: number; palette: TemplateDef["palette"]; wide?: boolean }) {
  return (
    <div className={`${wide ? "flex gap-1" : "space-y-1"}`}>
      {Array.from({ length: count }).map((_, i) => (
        <div
          key={i}
          className={`h-1.5 ${wide ? "flex-1" : ""} ${buttonRadius(palette.button_style)}`}
          style={{ background: palette.card_bg, border: `0.5px solid ${palette.text_color}18`, width: wide ? undefined : "100%" }}
        />
      ))}
    </div>
  );
}

function Skeleton({
  slug,
  palette,
  avatar,
}: {
  slug: TemplateDef["slug"];
  palette: TemplateDef["palette"];
  avatar: TemplateDef["avatar_shape"];
}) {
  const avatarCls = avatar === "circle" ? "rounded-full" : avatar === "square" ? "rounded-[2px]" : "rounded-[3px]";
  const avatarEl = <div className={`w-4 h-4 shrink-0 ${avatarCls}`} style={{ background: `${palette.accent}35`, border: `1px solid ${palette.accent}50` }} />;

  switch (slug) {
    case "grid":
      return (
        <div className="flex flex-col items-center gap-1.5">
          {avatarEl}
          <div className="h-1 w-8" style={{ background: palette.text_color }} />
          <div className="grid grid-cols-2 gap-1 w-full mt-0.5">
            <div className="h-2.5" style={{ background: palette.card_bg }} />
            <div className="h-2.5" style={{ background: palette.card_bg }} />
            <div className="h-2.5" style={{ background: palette.card_bg }} />
            <div className="h-2.5" style={{ background: palette.card_bg }} />
          </div>
        </div>
      );
    case "cards":
      return (
        <div className="flex flex-col items-center gap-1.5">
          {avatarEl}
          <div className="h-1 w-8" style={{ background: palette.text_color }} />
          <div className="w-full space-y-1 mt-0.5">
            {[0, 1].map((i) => (
              <div key={i} className="h-2.5 flex items-center gap-1 px-1" style={{ background: palette.card_bg, boxShadow: `0 1px 3px ${palette.accent}20` }}>
                <div className="w-1.5 h-1.5 rounded-full" style={{ background: `${palette.accent}50` }} />
                <div className="flex-1 h-0.5" style={{ background: `${palette.text_color}40` }} />
              </div>
            ))}
          </div>
        </div>
      );
    case "terminal":
      return (
        <div className="space-y-1 w-full">
          <div className="text-[5px] font-bold" style={{ color: palette.accent }}>~/profile</div>
          <div className="flex items-center gap-1 p-1" style={{ background: palette.card_bg }}>
            {avatarEl}
            <div className="h-1 w-7" style={{ background: palette.accent }} />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="h-1.5 px-1 flex items-center justify-between" style={{ background: palette.card_bg, borderLeft: `1px solid ${palette.accent}` }}>
              <div className="h-0.5 w-6" style={{ background: `${palette.text_color}60` }} />
              <span style={{ color: palette.accent }}>→</span>
            </div>
          ))}
        </div>
      );
    case "magazine":
      return (
        <div className="flex flex-col items-center gap-1 w-full">
          <div className="h-1.5 w-full text-center" style={{ background: palette.text_color }} />
          <div className="h-px w-6" style={{ background: palette.accent }} />
          {avatarEl}
          <div className="w-full space-y-0.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-1.5 flex items-center justify-between border-b" style={{ borderColor: `${palette.text_color}20` }}>
                <div className="h-0.5 w-7" style={{ background: `${palette.text_color}60` }} />
                <span style={{ color: palette.accent }}>↗</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "storefront":
      return (
        <div className="space-y-1 w-full">
          <div className="h-5 rounded-sm" style={{ background: `linear-gradient(135deg, ${palette.accent}45, ${palette.accent}25)` }} />
          <div className="flex flex-col items-center -mt-2">
            {avatarEl}
            <div className="h-0.5 w-7 mt-0.5" style={{ background: palette.text_color }} />
          </div>
          <div className="h-2.5" style={{ background: palette.card_bg }} />
          <LinkDots count={2} palette={palette} wide />
        </div>
      );
    case "portal":
      return (
        <div className="space-y-1 w-full">
          <div className="flex flex-col items-center gap-1">
            {avatarEl}
            <div className="h-1 w-8" style={{ background: palette.text_color }} />
          </div>
          {[0, 1].map((i) => (
            <div key={i} className="h-2.5" style={{ background: `${palette.card_bg}88`, backdropFilter: "blur(2px)", border: `0.5px solid ${palette.text_color}20` }} />
          ))}
        </div>
      );
    case "social":
      return (
        <div className="flex flex-col items-center gap-1.5">
          {avatarEl}
          <div className="h-0.5 w-8" style={{ background: palette.text_color }} />
          <div className="grid grid-cols-2 gap-1 w-full">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-2.5 flex items-center justify-center gap-0.5" style={{ background: palette.card_bg }}>
                <span style={{ color: palette.accent }}>{Object.values(socialIcon)[i % 6]}</span>
              </div>
            ))}
          </div>
        </div>
      );
    case "compact":
      return (
        <div className="space-y-1 w-full">
          <div className="flex items-center gap-1">
            {avatarEl}
            <div className="space-y-0.5 flex-1">
              <div className="h-1 w-10" style={{ background: palette.text_color }} />
              <div className="h-0.5 w-8" style={{ background: `${palette.text_color}50` }} />
            </div>
          </div>
          <div className="w-full space-y-0.5">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-2 flex items-center px-1" style={{ background: palette.card_bg, borderBottom: `0.5px solid ${palette.text_color}10` }}>
                <div className="h-0.5 w-7" style={{ background: `${palette.text_color}50` }} />
              </div>
            ))}
          </div>
        </div>
      );
    case "bold":
      return (
        <div className="flex flex-col items-center gap-1.5">
          <div className="text-[5px] font-black tracking-widest" style={{ color: `${palette.text_color}70` }}>MURIH</div>
          {avatarEl}
          <div className="w-full space-y-1">
            {[0, 1].map((i) => (
              <div key={i} className="h-2.5 flex items-center justify-between px-1" style={{ background: palette.card_bg, border: `1px solid ${palette.accent}60` }}>
                <div className="h-0.5 w-6" style={{ background: palette.text_color }} />
                <span style={{ color: palette.accent }}>→</span>
              </div>
            ))}
          </div>
        </div>
      );
    default:
      return (
        <div className="flex flex-col items-center gap-1.5">
          {avatarEl}
          <div className="h-1 w-8" style={{ background: palette.text_color }} />
          <div className="h-1 w-6" style={{ background: `${palette.text_color}50` }} />
          <LinkDots count={3} palette={palette} />
        </div>
      );
  }
}

export default function TemplateThumb({ template }: { template: TemplateDef }) {
  const { palette } = template;
  return (
    <div
      className="w-full aspect-[3/4] rounded-xl overflow-hidden p-1.5 flex flex-col"
      style={{ ...pageBackground({ background_type: palette.background_type, background_value: palette.background_value, bg: palette.bg }) }}
    >
      <Skeleton slug={template.slug} palette={palette} avatar={template.avatar_shape} />
    </div>
  );
}
