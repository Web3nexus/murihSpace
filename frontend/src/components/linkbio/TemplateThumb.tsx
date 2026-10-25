import type { TemplateDef } from "@/lib/linkBioTemplates";
import { pageBackground } from "@/lib/linkBioTemplates";

// Miniature wireframes of each template, drawn in that template's colours.
function Skeleton({ slug, palette }: { slug: TemplateDef["slug"]; palette: TemplateDef["palette"] }) {
  switch (slug) {
    case "boutique":
      return (
        <div className="flex flex-col items-center gap-1.5 w-full">
          <div className="h-6 w-full" style={{ background: `${palette.accent}30` }} />
          <div className="h-1 w-8" style={{ background: palette.accent }} />
          {[0, 1].map((i) => (
            <div key={i} className="h-3 w-full flex items-center gap-1 p-0.5" style={{ background: `linear-gradient(120deg, ${palette.card_bg}, ${palette.card_bg}cc)` }}>
              <div className="h-2.5 w-2.5 shrink-0" style={{ background: "rgba(0,0,0,0.15)" }} />
              <div className="flex-1 h-0.5" style={{ background: palette.text_color }} />
            </div>
          ))}
        </div>
      );
    case "atelier":
      return (
        <div className="flex flex-col items-center gap-1.5 w-full">
          <div className="h-5 w-full" style={{ background: `${palette.accent}40` }} />
          <div className="-mt-3 rounded-full p-0.5" style={{ background: palette.accent }}>
            <div className="w-4 h-4 rounded-full" style={{ background: `${palette.accent}35` }} />
          </div>
          <div className="grid grid-cols-2 gap-0.5 w-full">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-2 rounded-full" style={{ background: `${palette.card_bg}26`, border: `0.5px solid ${palette.text_color}55` }} />
            ))}
          </div>
        </div>
      );
    case "lookbook":
      return (
        <div className="flex flex-col gap-1 w-full">
          <div className="h-8 w-full" style={{ background: `${palette.accent}45` }} />
          <div className="h-1 w-8 mx-auto" style={{ background: palette.text_color }} />
          {[0, 1].map((i) => (
            <div key={i} className="h-4 flex overflow-hidden" style={{ background: palette.card_bg }}>
              <div className="flex-1 p-0.5"><div className="h-0.5 w-full" style={{ background: palette.text_color }} /></div>
              <div className="w-1/3" style={{ background: `${palette.accent}40` }} />
            </div>
          ))}
        </div>
      );
    case "showcase":
      return (
        <div className="flex flex-col items-center gap-1 w-full">
          <div className="h-6 w-full" style={{ background: `${palette.accent}25` }} />
          <div className="h-1 w-10" style={{ background: palette.accent }} />
          {[0, 1].map((i) => (
            <div key={i} className="relative h-6 w-full overflow-hidden" style={{ background: `${palette.accent}22`, border: `0.5px solid ${palette.accent}90` }}>
              <div className="absolute left-1 top-1/2 -translate-y-1/2 h-0.5 w-8" style={{ background: palette.accent }} />
            </div>
          ))}
        </div>
      );
    default:
      return (
        <div className="flex flex-col gap-1 w-full">
          <div className="h-7 w-full" style={{ background: `${palette.accent}55` }} />
          <div className="h-1 w-10 mx-auto" style={{ background: palette.text_color }} />
          {[0, 1].map((i) => (
            <div key={i} className="h-3 flex items-center gap-1 p-0.5" style={{ background: palette.card_bg }}>
              <div className="flex-1 h-0.5" style={{ background: palette.text_color }} />
              <div className="h-2.5 w-2.5 shrink-0" style={{ background: `${palette.accent}40` }} />
            </div>
          ))}
        </div>
      );
  }
}

export default function TemplateThumb({ template }: { template: TemplateDef }) {
  const { palette } = template;
  return (
    <div
      className="w-full aspect-[3/4] rounded-lg overflow-hidden p-1.5 flex flex-col"
      style={{ ...pageBackground({ background_type: palette.background_type, background_value: palette.background_value, bg: palette.bg }) }}
    >
      <Skeleton slug={template.slug} palette={palette} />
    </div>
  );
}
