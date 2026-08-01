import { useState } from "react";
import { Globe, Check, ChevronDown } from "lucide-react";

const LANGUAGES = [
  { code: "en", label: "English (US)" },
  { code: "en-GB", label: "English (UK)" },
  { code: "es", label: "Español" },
  { code: "fr", label: "Français" },
  { code: "de", label: "Deutsch" },
  { code: "pt", label: "Português" },
  { code: "ja", label: "日本語" },
  { code: "ko", label: "한국어" },
  { code: "zh", label: "中文" },
  { code: "ar", label: "العربية" },
];

const TIMEZONES = [
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "Europe/London",
  "Europe/Berlin",
  "Europe/Paris",
  "Asia/Tokyo",
  "Asia/Shanghai",
  "Asia/Kolkata",
  "Australia/Sydney",
  "Pacific/Auckland",
];

const DATE_FORMATS = [
  { value: "MM/DD/YYYY", label: "MM/DD/YYYY (US)" },
  { value: "DD/MM/YYYY", label: "DD/MM/YYYY (UK/EU)" },
  { value: "YYYY-MM-DD", label: "YYYY-MM-DD (ISO)" },
];

const FIRST_DAYS = [
  { value: "monday", label: "Monday" },
  { value: "sunday", label: "Sunday" },
  { value: "saturday", label: "Saturday" },
];

export default function LanguagePage() {
  const [language, setLanguage] = useState("en");
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York");
  const [dateFormat, setDateFormat] = useState("MM/DD/YYYY");
  const [firstDay, setFirstDay] = useState("monday");
  const [langOpen, setLangOpen] = useState(false);
  const [tzOpen, setTzOpen] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = () => {
    localStorage.setItem("murihspace-language", language);
    localStorage.setItem("murihspace-timezone", timezone);
    localStorage.setItem("murihspace-date-format", dateFormat);
    localStorage.setItem("murihspace-first-day", firstDay);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Globe className="h-5 w-5 text-secondary" />
          Language & Region
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Configure your language, timezone, and regional formatting preferences.
        </p>
      </div>

      {/* Language */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-secondary" /> Interface Language
        </h3>
        <div className="relative">
          <button
            type="button"
            onClick={() => { setLangOpen(!langOpen); setTzOpen(false); }}
            className="w-full flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs text-foreground hover:border-muted-foreground/30 transition-all"
          >
            <span>{LANGUAGES.find((l) => l.code === language)?.label || language}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${langOpen ? "rotate-180" : ""}`} />
          </button>
          {langOpen && (
            <div className="absolute z-10 mt-1 w-full rounded-xl border border-border bg-card shadow-lg overflow-hidden">
              {LANGUAGES.map((l) => (
                <button
                  key={l.code}
                  type="button"
                  onClick={() => { setLanguage(l.code); setLangOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-xs text-foreground hover:bg-muted transition-colors"
                >
                  {l.label}
                  {language === l.code && <Check className="h-3.5 w-3.5 text-secondary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Timezone */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-secondary" /> Time Zone
        </h3>
        <div className="relative">
          <button
            type="button"
            onClick={() => { setTzOpen(!tzOpen); setLangOpen(false); }}
            className="w-full flex items-center justify-between rounded-xl border border-border bg-muted/30 px-4 py-2.5 text-xs text-foreground hover:border-muted-foreground/30 transition-all"
          >
            <span>{timezone}</span>
            <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform ${tzOpen ? "rotate-180" : ""}`} />
          </button>
          {tzOpen && (
            <div className="absolute z-10 mt-1 w-full max-h-48 overflow-y-auto rounded-xl border border-border bg-card shadow-lg">
              {TIMEZONES.map((tz) => (
                <button
                  key={tz}
                  type="button"
                  onClick={() => { setTimezone(tz); setTzOpen(false); }}
                  className="w-full flex items-center justify-between px-4 py-2 text-xs text-foreground hover:bg-muted transition-colors"
                >
                  {tz}
                  {timezone === tz && <Check className="h-3.5 w-3.5 text-secondary" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Region Formatting */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
          <Globe className="h-3.5 w-3.5 text-secondary" /> Region & Formatting
        </h3>
        <div className="space-y-4">
          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              Date Format
            </label>
            <div className="grid grid-cols-3 gap-2">
              {DATE_FORMATS.map((df) => {
                const active = dateFormat === df.value;
                return (
                  <button
                    key={df.value}
                    type="button"
                    onClick={() => setDateFormat(df.value)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      active ? "border-secondary bg-secondary/5" : "border-border bg-muted/30 hover:border-muted-foreground/30"
                    }`}
                  >
                    <p className={`text-xs font-bold ${active ? "text-secondary" : "text-foreground"}`}>{df.value}</p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">{df.label}</p>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider block mb-1.5">
              First Day of Week
            </label>
            <div className="grid grid-cols-3 gap-2">
              {FIRST_DAYS.map((fd) => {
                const active = firstDay === fd.value;
                return (
                  <button
                    key={fd.value}
                    type="button"
                    onClick={() => setFirstDay(fd.value)}
                    className={`p-3 rounded-xl border text-center transition-all ${
                      active ? "border-secondary bg-secondary/5" : "border-border bg-muted/30 hover:border-muted-foreground/30"
                    }`}
                  >
                    <Check className={`h-4 w-4 mx-auto mb-1 ${active ? "text-secondary" : "text-transparent"}`} />
                    <p className={`text-xs font-bold ${active ? "text-secondary" : "text-foreground"}`}>{fd.label}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

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
