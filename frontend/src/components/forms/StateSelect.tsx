import { authFetch } from "@/lib/api/authFetch";
import { logger } from "@/lib/logger";
import { useState, useEffect, useRef, useMemo } from "react";
import { ArrowDown as ChevronDown, Search } from "@/components/icons";
import { Spinner as Loader2 } from "@/components/icons/rounded";;

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
  // States are tied to the country they were fetched for, so a stale list is
  // never shown and no state is reset inside the effect.
  const [loaded, setLoaded] = useState<{ iso2: string; list: StateItem[] } | null>(null);
  const states = countryIso2 && loaded?.iso2 === countryIso2 ? loaded.list : [];
  const loading = Boolean(countryIso2) && loaded?.iso2 !== countryIso2;
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!countryIso2) return;
    const iso2 = countryIso2;

    let active = true;

    async function loadStates() {
      let list: StateItem[] = [];
      try {
        const res = await authFetch(`${API_BASE}/countries/${iso2}/states`, {
          headers: { Accept: "application/json" },
        });
        if (!res.ok) throw new Error("Failed to load states");
        const json = await res.json();
        list = Array.isArray(json?.data)
          ? json.data
          : Array.isArray(json?.data?.data)
            ? json.data.data
            : Array.isArray(json)
              ? json
              : [];
      } catch (err) {
        logger.error("States fetch error:", err);
      } finally {
        if (active) setLoaded({ iso2, list });
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
        className={`w-full rounded-lg border-none bg-card px-3 py-2.5 text-sm font-medium text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--shell-accent)]/50 ${className}`}
      />
    );
  }

  return (
    <div ref={containerRef} className={`relative w-full ${className}`}>
      <button
        type="button"
        disabled={disabled || loading}
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 rounded-lg border-none bg-card text-foreground text-sm font-medium focus:outline-none focus:border-[var(--shell-accent)]/50 disabled:opacity-50 transition-colors"
      >
        <span className="flex items-center gap-2 truncate">
          {loading ? (
            <Loader2 weight="fill" className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : selectedState ? (
            <span className="font-semibold text-foreground truncate">{selectedState.name}</span>
          ) : value ? (
            <span className="font-semibold text-foreground truncate">{value}</span>
          ) : (
            <span className="text-muted-foreground">{placeholder}</span>
          )}
        </span>
        <ChevronDown weight="fill" className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute z-50 mt-1.5 w-full rounded-lg border-none bg-card shadow-xl overflow-hidden animate-in fade-in-50 zoom-in-95">
          <div className="p-2 border-b border-border bg-muted/30 flex items-center gap-2">
            <Search weight="fill" className="h-4 w-4 text-muted-foreground shrink-0 ml-1" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search state..."
              className="w-full bg-transparent text-xs font-medium text-foreground placeholder:text-muted-foreground focus:outline-none"
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
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-medium transition-colors ${
                      isSelected
                        ? "bg-[var(--shell-accent-solid)]/10 text-[var(--shell-accent)] dark:text-[var(--shell-accent)] font-bold"
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
