import { useState, useEffect, useCallback } from 'react';
import { Truck, Plus, Loader2, Edit, Trash2, Globe } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAuthToken } from "@/lib/auth/token";
import { useConfirm } from '@/components/ui/DialogProvider';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatPrice(cents: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const sym = symbols[currency] ?? currency + ' ';
  return sym + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

interface ShippingProfile {
  id: number; name: string;
  base_rate: number; per_item_rate: number;
  estimated_days_min: number; estimated_days_max: number;
  countries: string[] | null; currency: string; is_active: boolean;
  created_at: string;
}

const COUNTRY_NAMES: Record<string, string> = {
  NG: 'Nigeria', US: 'United States', GB: 'United Kingdom',
  GH: 'Ghana', KE: 'Kenya', ZA: 'South Africa', UG: 'Uganda',
};

const COUNTRY_OPTIONS = Object.entries(COUNTRY_NAMES).map(([code, name]) => ({ code, name }));

export function ShippingProfilesPage() {
  const [profiles, setProfiles] = useState<ShippingProfile[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<ShippingProfile | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [fName, setFName] = useState('');
  const [fBase, setFBase] = useState('0');
  const [fPerItem, setFPerItem] = useState('0');
  const [fMinDays, setFMinDays] = useState('3');
  const [fMaxDays, setFMaxDays] = useState('7');
  const [fCountries, setFCountries] = useState<string[]>([]);
  const [fActive, setFActive] = useState(true);

  const fetchProfiles = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/store/shipping/profiles`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setProfiles(json.data?.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchProfiles(); }, [fetchProfiles]);

  function openNew() {
    setEditing(null);
    setFName('');
    setFBase('0');
    setFPerItem('0');
    setFMinDays('3');
    setFMaxDays('7');
    setFCountries([]);
    setFActive(true);
    setShowForm(true);
  }

  function openEdit(p: ShippingProfile) {
    setEditing(p);
    setFName(p.name);
    setFBase(String(p.base_rate));
    setFPerItem(String(p.per_item_rate));
    setFMinDays(String(p.estimated_days_min));
    setFMaxDays(String(p.estimated_days_max));
    setFCountries(p.countries ?? []);
    setFActive(p.is_active);
    setShowForm(true);
  }

  function toggleCountry(code: string) {
    setFCountries(prev =>
      prev.includes(code) ? prev.filter(c => c !== code) : [...prev, code]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const body = {
      name: fName,
      base_rate: Number(fBase),
      per_item_rate: Number(fPerItem),
      estimated_days_min: Number(fMinDays),
      estimated_days_max: Number(fMaxDays),
      countries: fCountries.length > 0 ? fCountries : null,
      is_active: fActive,
    };

    const url = editing
      ? `${API_BASE}/store/shipping/profiles/${editing.id}`
      : `${API_BASE}/store/shipping/profiles`;
    const method = editing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
      const json = await res.json();
      if (res.ok) {
        await fetchProfiles();
        setShowForm(false);
        setEditing(null);
        setMessage({ type: 'success', text: editing ? 'Profile updated.' : 'Profile created.' });
      } else {
        setMessage({ type: 'error', text: json.message ?? 'Failed.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const confirm = useConfirm();

  async function deleteProfile(id: number) {
    if (!await confirm({ title: "Delete Shipping Profile", message: "Delete this shipping profile?", variant: "destructive" })) return;
    try {
      const res = await fetch(`${API_BASE}/store/shipping/profiles/${id}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (res.ok) {
        await fetchProfiles();
        setMessage({ type: 'success', text: 'Profile deleted.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    }
  }

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">
              Phase 9 — Shipping
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Shipping Profiles</h1>
          <p className="text-sm text-white/70 max-w-xl">Configure shipping rates and delivery options for your products.</p>
        </div>
        <Button onClick={openNew}
          className="bg-[#38A8D8] text-white hover:bg-[#2E96C5] font-semibold h-11 px-5 rounded-xl shadow-md gap-2 shrink-0 self-start sm:self-auto">
          <Plus className="h-5 w-5" />
          New Profile
        </Button>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 ${
          message.type === 'success' ? 'bg-[#38A8D8]/20 text-[#38A8D8]' : 'bg-muted text-muted-foreground'
        }`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-4 shadow-xs">
          <h2 className="font-semibold">{editing ? 'Edit Profile' : 'New Shipping Profile'}</h2>

          <div>
            <label className="block text-sm text-muted-foreground mb-1.5">Name *</label>
            <Input value={fName} onChange={e => setFName(e.target.value)}
              required placeholder="e.g. Standard, Express" />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Base Rate (cents) *</label>
              <Input value={fBase} onChange={e => setFBase(e.target.value)}
                required type="number" min="0" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Per Extra Item (cents) *</label>
              <Input value={fPerItem} onChange={e => setFPerItem(e.target.value)}
                required type="number" min="0" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Est. Min Days *</label>
              <Input value={fMinDays} onChange={e => setFMinDays(e.target.value)}
                required type="number" min="1" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1.5">Est. Max Days *</label>
              <Input value={fMaxDays} onChange={e => setFMaxDays(e.target.value)}
                required type="number" min="1" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-2">
              Countries (leave empty for all)
            </label>
            <div className="flex flex-wrap gap-2">
              {COUNTRY_OPTIONS.map(({ code, name }) => (
                <button key={code} type="button" onClick={() => toggleCountry(code)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all ${
                    fCountries.includes(code)
                      ? 'bg-primary text-primary-foreground border-primary shadow-xs'
                      : 'bg-card text-muted-foreground border-border hover:border-primary/40 hover:text-foreground'
                  }`}>
                  {name}
                </button>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={fActive}
              onChange={e => setFActive(e.target.checked)}
              className="accent-primary" />
            <span className="text-sm">Active</span>
          </label>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Update' : 'Create'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>Cancel</Button>
          </div>
        </form>
      )}

      {profiles.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Truck className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold">No shipping profiles</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">Create shipping profiles to set rates for domestic and international delivery.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {profiles.map(p => (
            <div key={p.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md hover:border-primary/30 transition-all duration-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold">{p.name}</h3>
                  <Badge className={p.is_active ? 'bg-[#38A8D8]/20 text-[#38A8D8] border-[#38A8D8]/30' : 'bg-muted text-muted-foreground border-border'}>
                    {p.is_active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(p)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteProfile(p.id)}>
                    <Trash2 className="w-4 h-4 text-muted-foreground" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <span className="text-muted-foreground">Base rate:</span>{' '}
                  <strong>{formatPrice(p.base_rate, p.currency)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Per extra item:</span>{' '}
                  <strong>{formatPrice(p.per_item_rate, p.currency)}</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Est. delivery:</span>{' '}
                  <strong>{p.estimated_days_min}–{p.estimated_days_max} days</strong>
                </div>
                <div>
                  <span className="text-muted-foreground">Countries:</span>{' '}
                  {p.countries && p.countries.length > 0 ? (
                    <span className="inline-flex flex-wrap gap-1">
                      {p.countries.map(c => (
                        <span key={c} className="inline-flex items-center gap-0.5 text-xs bg-muted text-muted-foreground px-1.5 py-0.5 rounded">
                          <Globe className="w-3 h-3" /> {COUNTRY_NAMES[c] ?? c}
                        </span>
                      ))}
                    </span>
                  ) : (
                    <strong className="text-muted-foreground">All countries</strong>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
