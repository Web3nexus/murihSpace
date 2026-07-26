import { useState, useEffect } from "react";
import {
  Paintbrush,
  Monitor,
  Sun,
  Moon,
  Type,
  Eye,
  Check,
} from "lucide-react";
import { useTheme } from "@/hooks/useTheme";

type FontSize = "small" | "medium" | "large";

const FONT_SIZE_MAP: Record<FontSize, { label: string; scale: string; desc: string }> = {
  small:  { label: "Small",  scale: "0.875rem", desc: "Compact text for dense screens" },
  medium: { label: "Medium", scale: "1rem",     desc: "Default balanced reading size" },
  large:  { label: "Large",  scale: "1.125rem", desc: "Larger text for better readability" },
};

const STORAGE_KEY_FONT = "murihspace-font-size";
const STORAGE_KEY_MOTION = "murihspace-reduced-motion";

export default function AppearancePage() {
  const { theme, setTheme } = useTheme();

  const [fontSize, setFontSize] = useState<FontSize>(() =>
    (localStorage.getItem(STORAGE_KEY_FONT) as FontSize) || "medium"
  );
  const [reducedMotion, setReducedMotion] = useState(() =>
    localStorage.getItem(STORAGE_KEY_MOTION) === "true"
  );

  const [saved, setSaved] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_FONT, fontSize);
    document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSize].scale;
  }, [fontSize]);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_MOTION, String(reducedMotion));
    document.documentElement.classList.toggle("reduce-motion", reducedMotion);
  }, [reducedMotion]);

  const handleSave = () => {
    localStorage.setItem(STORAGE_KEY_FONT, fontSize);
    localStorage.setItem(STORAGE_KEY_MOTION, String(reducedMotion));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const THEME_OPTIONS = [
    { value: "light" as const,  icon: Sun,     label: "Light",  desc: "Bright, clean interface" },
    { value: "dark" as const,   icon: Moon,    label: "Dark",   desc: "Easy on the eyes in low light" },
    { value: "system" as const, icon: Monitor, label: "System", desc: "Follows your device setting" },
  ];

  return (
    <div className="space-y-6 w-full max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Paintbrush className="h-5 w-5 text-secondary" />
          Appearance
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Customize your MurihSpace look and feel.
        </p>
      </div>

      {/* ── Theme ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
          <Monitor className="h-3.5 w-3.5 text-secondary" /> Theme
        </h3>
        <div className="grid grid-cols-3 gap-3">
          {THEME_OPTIONS.map((opt) => {
            const active = theme === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setTheme(opt.value)}
                className={`relative rounded-xl border-2 p-4 text-left transition-all ${
                  active
                    ? "border-secondary bg-secondary/5"
                    : "border-border bg-muted/30 hover:border-muted-foreground/30"
                }`}
              >
                {active && (
                  <span className="absolute top-2 right-2 h-5 w-5 rounded-full bg-secondary flex items-center justify-center">
                    <Check className="h-3 w-3 text-white" />
                  </span>
                )}
                <opt.icon className={`h-6 w-6 mb-2 ${active ? "text-secondary" : "text-muted-foreground"}`} />
                <p className="text-xs font-bold text-foreground">{opt.label}</p>
                <p className="text-[10px] text-muted-foreground mt-0.5 leading-tight">{opt.desc}</p>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Font Size ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
          <Type className="h-3.5 w-3.5 text-secondary" /> Font Size
        </h3>
        <div className="space-y-2">
          {(Object.keys(FONT_SIZE_MAP) as FontSize[]).map((key) => {
            const f = FONT_SIZE_MAP[key];
            const active = fontSize === key;
            return (
              <button
                key={key}
                type="button"
                onClick={() => setFontSize(key)}
                className={`w-full flex items-center justify-between p-3 rounded-xl border text-left transition-all ${
                  active
                    ? "border-secondary bg-secondary/5"
                    : "border-border bg-muted/30 hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span
                    className="font-bold text-foreground leading-none"
                    style={{ fontSize: f.scale }}
                  >
                    Aa
                  </span>
                  <div>
                    <p className="text-xs font-bold text-foreground">{f.label}</p>
                    <p className="text-[10px] text-muted-foreground">{f.desc}</p>
                  </div>
                </div>
                {active && <Check className="h-4 w-4 text-secondary" />}
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Accessibility ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-secondary" /> Accessibility
        </h3>
        <div className="space-y-3">
          <label className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30 cursor-pointer hover:border-muted-foreground/30 transition-all">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground">Reduced Motion</p>
              <p className="text-[10px] text-muted-foreground">
                Minimize animations and transitions throughout the interface.
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={reducedMotion}
              onClick={() => setReducedMotion(!reducedMotion)}
              className={`relative h-6 w-11 rounded-full p-0.5 transition-colors shrink-0 ${
                reducedMotion ? "bg-secondary" : "bg-muted-foreground/30"
              }`}
            >
              <div
                className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${
                  reducedMotion ? "translate-x-5" : "translate-x-0"
                }`}
              />
            </button>
          </label>
        </div>
      </section>

      {/* ── Save ── */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
            <Check className="h-4 w-4" /> Preferences saved!
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          className="px-6 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 transition-all shadow-xs"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}
