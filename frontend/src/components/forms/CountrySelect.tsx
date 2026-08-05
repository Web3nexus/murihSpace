import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Search, Loader2 } from "lucide-react";

export interface CountryItem {
  iso2: string;
  iso3: string;
  name: string;
  calling_code: string;
  flag: string;
  currency: string;
  state_required: boolean;
  postal_code_required: boolean;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

interface CountrySelectProps {
  value?: string;
  onChange: (iso2: string, country?: CountryItem) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function CountrySelect({
  value,
  onChange,
  placeholder = "Select Country",
  disabled = false,
  className = "",
}: CountrySelectProps) {
  const [countries, setCountries] = useState<CountryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

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
        if (active) {
          setCountries(list);
        }
      } catch (err) {
        console.error("Country fetch error:", err);
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
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedCountry = useMemo(() => {
    if (!value) return null;
    return countries.find(
      (c) => c.iso2.toLowerCase() === value.toLowerCase() || c.name.toLowerCase() === value.toLowerCase()
    );
  }, [value, countries]);

  const filteredCountries = useMemo(() => {
    if (!search.trim()) return countries;
    const q = search.toLowerCase();
    return countries.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.iso2.toLowerCase().includes(q) ||
        c.calling_code.includes(q)
    );
  }, [search, countries]);

  const handleSelect = (country: CountryItem) => {
    onChange(country.iso2, country);
    setOpen(false);
    setSearch("");
  };

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium focus:outline-none focus:border-[#38A8D8]/50 disabled:opacity-50 transition-colors"
      >
        <span className="flex items-center gap-2 truncate">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : selectedCountry ? (
            <>
              <span className="text-base leading-none">{selectedCountry.flag || "🌐"}</span>
              <span className="font-semibold text-foreground truncate">{selectedCountry.name}</span>
              <span className="text-xs text-muted-foreground font-mono">({selectedCountry.iso2})</span>
            </>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-2xl border border-border bg-card shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95">
          <div className="p-2 border-b border-border bg-muted/30 flex items-center gap-2">
            <Search className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search country or code..."
              className="w-full bg-transparent text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
            {filteredCountries.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">No countries found</div>
            ) : (
              filteredCountries.map((c) => {
                const isSelected = selectedCountry?.iso2 === c.iso2;
                return (
                  <button
                    key={c.iso2}
                    type="button"
                    onClick={() => handleSelect(c)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-[#38A8D8]/10 text-[#38A8D8] font-bold"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <span className="flex items-center gap-2.5 truncate">
                      <span className="text-base leading-none">{c.flag || "🌐"}</span>
                      <span className="truncate">{c.name}</span>
                    </span>
                    <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
                      +{c.calling_code}
                    </span>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
