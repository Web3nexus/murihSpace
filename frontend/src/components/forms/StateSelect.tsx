import { useState, useEffect, useRef, useMemo } from "react";
import { ChevronDown, Search, Loader2 } from "lucide-react";

export interface StateItem {
  id: number;
  country_iso2: string;
  code: string;
  name: string;
}

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

interface StateSelectProps {
  countryIso2?: string;
  value?: string;
  onChange: (stateValue: string) => void;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
}

export function StateSelect({
  countryIso2,
  value = "",
  onChange,
  placeholder = "Select State / Province",
  disabled = false,
  className = "",
}: StateSelectProps) {
  const [states, setStates] = useState<StateItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!countryIso2) {
      setStates([]);
      return;
    }

    let active = true;
    setLoading(true);

    async function loadStates() {
      try {
        const res = await fetch(`${API_BASE}/countries/${countryIso2}/states`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("Failed to load states");
        const json = await res.json();
        const list: StateItem[] = Array.isArray(json?.data) 
          ? json.data 
          : Array.isArray(json?.data?.data) 
            ? json.data.data 
            : Array.isArray(json) 
              ? json 
              : [];
        if (active) {
          setStates(list);
        }
      } catch (err) {
        console.error("States fetch error:", err);
        if (active) setStates([]);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadStates();
    return () => {
      active = false;
    };
  }, [countryIso2]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const selectedState = useMemo(() => {
    if (!value) return null;
    return states.find(
      (s) =>
        s.name.toLowerCase() === value.toLowerCase() ||
        s.code.toLowerCase() === value.toLowerCase()
    );
  }, [value, states]);

  const filteredStates = useMemo(() => {
    if (!search.trim()) return states;
    const q = search.toLowerCase();
    return states.filter(
      (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
    );
  }, [search, states]);

  // If no country selected or country has no states, render standard input
  if (!countryIso2 || (!loading && states.length === 0)) {
    return (
      <input
        type="text"
        disabled={disabled}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`w-full rounded-xl border border-border bg-card px-3 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[#2164b6]/50 ${className}`}
      />
    );
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-border bg-card text-foreground text-sm font-medium focus:outline-none focus:border-[#2164b6]/50 disabled:opacity-50 transition-colors"
      >
        <span className="flex items-center gap-2 truncate">
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : selectedState ? (
            <span className="font-semibold text-foreground truncate">{selectedState.name}</span>
          ) : value ? (
            <span className="font-semibold text-foreground truncate">{value}</span>
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
              placeholder="Search state..."
              className="w-full bg-transparent text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
              autoFocus
            />
          </div>
          <div className="max-h-60 overflow-y-auto p-1 space-y-0.5 scrollbar-thin">
            {filteredStates.length === 0 ? (
              <div className="p-3 text-center text-xs text-muted-foreground">No states found</div>
            ) : (
              filteredStates.map((s) => {
                const isSelected = selectedState?.id === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      onChange(s.name);
                      setOpen(false);
                      setSearch("");
                    }}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-[#2164b6]/10 text-[#2164b6] dark:text-[#7ab0ff] font-bold"
                        : "hover:bg-muted/50 text-foreground"
                    }`}
                  >
                    <span className="truncate">{s.name}</span>
                    {s.code && s.code !== s.name && (
                      <span className="text-[10px] font-mono text-muted-foreground shrink-0 ml-2">
                        {s.code}
                      </span>
                    )}
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
