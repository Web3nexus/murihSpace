import { useState, useEffect, useMemo, useRef } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import type { CountryItem } from "./CountrySelect";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

interface PhoneInputProps {
  value?: string;
  countryIso2?: string;
  onChange: (e164Value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function PhoneInput({
  value = "",
  countryIso2 = "GB",
  onChange,
  placeholder = "7911 123456",
  disabled = false,
  className = "",
}: PhoneInputProps) {
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIso2, setSelectedIso2] = useState(countryIso2);
  const [localNumber, setLocalNumber] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sync countryIso2 prop updates
  useEffect(() => {
    if (countryIso2) {
      setSelectedIso2(countryIso2);
    }
  }, [countryIso2]);

  // Fetch countries
  useEffect(() => {
    let active = true;
    async function loadCountries() {
      try {
        const res = await fetch(`${API_BASE}/countries`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("Failed to load countries");
        const json = await res.json();
        const list: CountryItem[] = Array.isArray(json?.data) 
          ? json.data 
          : Array.isArray(json?.data?.data) 
            ? json.data.data 
            : Array.isArray(json) 
              ? json 
              : [];
        if (active) setCountries(list);
      } catch (e) {
        console.error("PhoneInput fetch error:", e);
      } finally {
        if (active) setLoading(false);
      }
    }
    loadCountries();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const currentCountry = useMemo(() => {
    return countries.find((c) => c.iso2.toLowerCase() === selectedIso2.toLowerCase()) || {
      iso2: "GB",
      flag: "🇬🇧",
      calling_code: "44",
      name: "United Kingdom",
    };
  }, [selectedIso2, countries]);

  // Parse incoming initial value if it starts with +
  useEffect(() => {
    if (value && value.startsWith("+") && countries.length > 0) {
      const matched = countries.find((c) => value.startsWith(`+${c.calling_code}`));
      if (matched) {
        setSelectedIso2(matched.iso2);
        setLocalNumber(value.replace(`+${matched.calling_code}`, "").trim());
        return;
      }
    }
    if (value && !value.startsWith("+")) {
      setLocalNumber(value);
    }
  }, [value, countries]);

  const handleNumberChange = (raw: string) => {
    const cleaned = raw.replace(/[^\d\s-]/g, "");
    setLocalNumber(cleaned);
    const digitsOnly = cleaned.replace(/\D/g, "");
    if (digitsOnly) {
      const e164 = `+${currentCountry.calling_code}${digitsOnly}`;
      onChange(e164);
    } else {
      onChange("");
    }
  };

  const handleCountrySelect = (c: CountryItem) => {
    setSelectedIso2(c.iso2);
    setDropdownOpen(false);
    const digitsOnly = localNumber.replace(/\D/g, "");
    if (digitsOnly) {
      onChange(`+${c.calling_code}${digitsOnly}`);
    }
  };

  return (
    <div className={`relative flex items-center rounded-xl border border-border bg-card text-foreground focus-within:border-[#2164b6]/50 transition-colors ${className}`}>
      {/* Country calling code picker */}
      <div ref={dropdownRef} className="relative shrink-0">
        <button
          type="button"
          disabled={disabled || loading}
          onClick={() => setDropdownOpen(!dropdownOpen)}
          className="flex items-center gap-1.5 px-3 py-2.5 border-r border-border bg-muted/30 text-xs font-bold text-foreground hover:bg-muted/60 transition-colors rounded-l-xl"
        >
          {loading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
          ) : (
            <>
              <span className="text-base leading-none">{currentCountry.flag || "🌐"}</span>
              <span className="font-mono text-muted-foreground">+{currentCountry.calling_code}</span>
              <ChevronDown className="h-3 w-3 text-muted-foreground" />
            </>
          )}
        </button>

        {dropdownOpen && (
          <div className="absolute top-full left-0 z-50 mt-1 w-64 max-h-60 overflow-y-auto rounded-2xl border border-border bg-card shadow-xl p-1 space-y-0.5 scrollbar-thin">
            {countries.map((c) => (
              <button
                key={c.iso2}
                type="button"
                onClick={() => handleCountrySelect(c)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                  selectedIso2.toLowerCase() === c.iso2.toLowerCase()
                    ? "bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] font-bold"
                    : "hover:bg-muted/50 text-foreground"
                }`}
              >
                <span className="flex items-center gap-2 truncate">
                  <span className="text-base leading-none">{c.flag || "🌐"}</span>
                  <span className="truncate">{c.name}</span>
                </span>
                <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
                  +{c.calling_code}
                </span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Phone input */}
      <input
        type="tel"
        disabled={disabled}
        value={localNumber}
        onChange={(e) => handleNumberChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-transparent px-3 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
      />
    </div>
  );
}
