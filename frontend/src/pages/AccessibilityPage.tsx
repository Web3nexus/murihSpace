import { useState } from "react";
import {
  Eye,
  Keyboard,
  MousePointer2,
  Underline,
  Type,
  Check,
} from "lucide-react";

const STORAGE_KEY_HC = "murihspace-high-contrast";
const STORAGE_KEY_FOCUS = "murihspace-focus-ring";
const STORAGE_KEY_UNDERLINE = "murihspace-link-underline";
const STORAGE_KEY_TRANSPARENCY = "murihspace-reduced-transparency";
const STORAGE_KEY_FONT = "murihspace-font-size";

type FontSize = "small" | "medium" | "large";

const FONT_SIZE_MAP: Record<FontSize, { label: string; scale: string; desc: string }> = {
  small:  { label: "Small",  scale: "0.875rem", desc: "Compact text" },
  medium: { label: "Medium", scale: "1rem",     desc: "Default size" },
  large:  { label: "Large",  scale: "1.125rem", desc: "Larger text for readability" },
};

export default function AccessibilityPage() {
  const [highContrast, setHighContrast] = useState(() => localStorage.getItem(STORAGE_KEY_HC) === "true");
  const [focusRing, setFocusRing] = useState(() => localStorage.getItem(STORAGE_KEY_FOCUS) !== "false");
  const [linkUnderline, setLinkUnderline] = useState(() => localStorage.getItem(STORAGE_KEY_UNDERLINE) === "true");
  const [reducedTransparency, setReducedTransparency] = useState(() => localStorage.getItem(STORAGE_KEY_TRANSPARENCY) === "true");
  const [fontSize, setFontSize] = useState<FontSize>(
    () => (localStorage.getItem(STORAGE_KEY_FONT) as FontSize) || "medium"
  );
  const [saved, setSaved] = useState(false);

  const applySettings = () => {
    localStorage.setItem(STORAGE_KEY_HC, String(highContrast));
    localStorage.setItem(STORAGE_KEY_FOCUS, String(focusRing));
    localStorage.setItem(STORAGE_KEY_UNDERLINE, String(linkUnderline));
    localStorage.setItem(STORAGE_KEY_TRANSPARENCY, String(reducedTransparency));
    localStorage.setItem(STORAGE_KEY_FONT, fontSize);

    document.documentElement.style.fontSize = FONT_SIZE_MAP[fontSize].scale;
    document.documentElement.classList.toggle("high-contrast", highContrast);
    document.documentElement.classList.toggle("focus-ring", focusRing);
    document.documentElement.classList.toggle("link-underline", linkUnderline);
    document.documentElement.classList.toggle("reduce-transparency", reducedTransparency);

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const toggles = [
    {
      key: "contrast",
      label: "High Contrast Mode",
      desc: "Increase color contrast for better readability.",
      val: highContrast,
      set: setHighContrast,
      icon: Eye,
    },
    {
      key: "focus",
      label: "Focus Ring",
      desc: "Show a visible ring around focused elements when using keyboard navigation.",
      val: focusRing,
      set: setFocusRing,
      icon: Keyboard,
    },
    {
      key: "underline",
      label: "Always Underline Links",
      desc: "Display links with persistent underlines for clearer identification.",
      val: linkUnderline,
      set: setLinkUnderline,
      icon: Underline,
    },
    {
      key: "transparency",
      label: "Reduce Transparency",
      desc: "Minimize transparent and blurred interface elements.",
      val: reducedTransparency,
      set: setReducedTransparency,
      icon: Eye,
    },
  ];

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Eye className="h-5 w-5 text-secondary" />
          Accessibility
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Customize your experience for better readability and navigation.
        </p>
      </div>

      {/* Font Size */}
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
                  active ? "border-secondary bg-secondary/5" : "border-border bg-muted/30 hover:border-muted-foreground/30"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="font-bold text-foreground leading-none" style={{ fontSize: f.scale }}>Aa</span>
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

      {/* Toggles */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
          <MousePointer2 className="h-3.5 w-3.5 text-secondary" /> Display & Interaction
        </h3>
        <div className="space-y-2">
          {toggles.map((t) => {
            const Icon = t.icon;
            return (
              <label
                key={t.key}
                className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30 cursor-pointer hover:border-muted-foreground/30 transition-all"
              >
                <div className="flex items-center gap-3">
                  <Icon className="h-5 w-5 text-muted-foreground shrink-0" />
                  <div className="space-y-0.5">
                    <p className="text-xs font-bold text-foreground">{t.label}</p>
                    <p className="text-[10px] text-muted-foreground">{t.desc}</p>
                  </div>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={t.val}
                  onClick={() => t.set(!t.val)}
                  className={`relative h-6 w-11 rounded-full p-0.5 transition-colors shrink-0 ${
                    t.val ? "bg-secondary" : "bg-muted-foreground/30"
                  }`}
                >
                  <div className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${t.val ? "translate-x-5" : "translate-x-0"}`} />
                </button>
              </label>
            );
          })}
        </div>
      </section>

      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
            <Check className="h-4 w-4" /> Accessibility preferences saved!
          </span>
        )}
        <button
          type="button"
          onClick={applySettings}
          className="px-6 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 transition-all shadow-xs"
        >
          Save Preferences
        </button>
      </div>
    </div>
  );
}
