import { useState, useEffect, useCallback } from 'react';
import { Plus, MapPin, Trash2, CheckCircle, Loader2, Edit, Circle } from 'lucide-react';
import { useConfirm } from '@/components/ui/DialogProvider';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = getAuthToken();
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

interface Address {
  id: number;
  label: string;
  full_name: string;
  phone: string | null;
  street_line1: string;
  street_line2: string | null;
  city: string;
  state: string;
  postal_code: string | null;
  country: string;
  type: string;
  is_default: boolean;
  created_at: string;
}

const COUNTRY_NAMES: Record<string, string> = { NG: 'Nigeria', US: 'United States', GB: 'United Kingdom', GH: 'Ghana', KE: 'Kenya', ZA: 'South Africa', UG: 'Uganda' };

const emptyForm = {
  label: 'Home', full_name: '', phone: '',
  street_line1: '', street_line2: '', city: '', state: '',
  postal_code: '', country: 'NG', type: 'both', is_default: false,
};

export function AddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [form, setForm] = useState(emptyForm);

  const fetchAddresses = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/addresses`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setAddresses(json.data?.data ?? []);
      }
    } catch {
      // ignore
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  function openNew() {
    setForm(emptyForm);
    setEditing(null);
    setShowForm(true);
  }

  function openEdit(addr: Address) {
    setForm({
      label: addr.label, full_name: addr.full_name, phone: addr.phone ?? '',
      street_line1: addr.street_line1, street_line2: addr.street_line2 ?? '',
      city: addr.city, state: addr.state,
      postal_code: addr.postal_code ?? '', country: addr.country,
      type: addr.type, is_default: addr.is_default,
    });
    setEditing(addr);
    setShowForm(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setIsSubmitting(true);
    setMessage(null);

    const url = editing
      ? `${API_BASE}/addresses/${editing.id}`
      : `${API_BASE}/addresses`;
    const method = editing ? 'PUT' : 'POST';

    try {
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(form) });
      const json = await res.json();
      if (res.ok) {
        await fetchAddresses();
        setShowForm(false);
        setEditing(null);
        setMessage({ type: 'success', text: editing ? 'Address updated.' : 'Address added.' });
      } else {
        setMessage({ type: 'error', text: json.message ?? 'Something went wrong.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setIsSubmitting(false);
    }
  }

  const confirm = useConfirm();

  async function deleteAddress(id: number) {
    if (!await confirm({ title: "Delete Address", message: "Delete this address?", variant: "destructive" })) return;
    try {
      const res = await fetch(`${API_BASE}/addresses/${id}`, {
        method: 'DELETE', headers: getAuthHeaders(),
      });
      if (res.ok) {
        await fetchAddresses();
        setMessage({ type: 'success', text: 'Address deleted.' });
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error.' });
    }
  }

  async function setDefault(id: number) {
    try {
      const res = await fetch(`${API_BASE}/addresses/${id}/default`, {
        method: 'POST', headers: getAuthHeaders(),
      });
      if (res.ok) {
        await fetchAddresses();
        setMessage({ type: 'success', text: 'Default address updated.' });
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
      {/* ── Page Header Banner ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <div className="flex items-center gap-2">
            <span className="px-2.5 py-0.5 rounded-full bg-[#2164b6]/20 text-[#2164b6] dark:text-[#7ab0ff] text-xs font-semibold uppercase tracking-wider border border-[#2164b6]/30">
              Phase 9 — Physical Marketplace
            </span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Addresses</h1>
          <p className="text-sm text-white/70 max-w-xl">Manage your shipping and billing addresses.</p>
        </div>
        <Button onClick={openNew} className="bg-[#2164b6] text-white hover:bg-[#1a5091] font-semibold h-11 px-5 rounded-xl shadow-md gap-2 shrink-0 self-start sm:self-auto">
          <Plus className="h-5 w-5" /> Add Address
        </Button>
      </div>

      {message && (
        <div className={`px-4 py-3 rounded-xl text-sm flex items-center gap-2 border ${
          message.type === 'success' ? 'bg-emerald-50/50 text-emerald-600 border-emerald-200/50' : 'bg-destructive/10 text-destructive border-destructive/20'
        }`}>
          {message.text}
        </div>
      )}

      {showForm && (
        <form onSubmit={handleSubmit} className="rounded-2xl border border-border bg-card p-6 space-y-4">
          <h2 className="font-semibold text-foreground">{editing ? 'Edit Address' : 'New Address'}</h2>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Label</label>
              <select value={form.label} onChange={e => setForm(p => ({ ...p, label: e.target.value }))}
                className="w-full rounded-xl border-border bg-card px-3 py-2 text-sm text-foreground">
                <option>Home</option><option>Work</option><option>Office</option><option>Other</option>
              </select>
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Type</label>
              <select value={form.type} onChange={e => setForm(p => ({ ...p, type: e.target.value }))}
                className="w-full rounded-xl border-border bg-card px-3 py-2 text-sm text-foreground">
                <option value="both">Shipping & Billing</option>
                <option value="shipping">Shipping</option>
                <option value="billing">Billing</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Full Name *</label>
              <Input value={form.full_name} onChange={e => setForm(p => ({ ...p, full_name: e.target.value }))}
                required className="text-sm" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Phone</label>
              <Input value={form.phone} onChange={e => setForm(p => ({ ...p, phone: e.target.value }))}
                className="text-sm" />
            </div>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Street Line 1 *</label>
            <Input value={form.street_line1} onChange={e => setForm(p => ({ ...p, street_line1: e.target.value }))}
              required className="text-sm" />
          </div>
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Street Line 2</label>
            <Input value={form.street_line2} onChange={e => setForm(p => ({ ...p, street_line2: e.target.value }))}
              className="text-sm" />
          </div>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">City *</label>
              <Input value={form.city} onChange={e => setForm(p => ({ ...p, city: e.target.value }))}
                required className="text-sm" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">State *</label>
              <Input value={form.state} onChange={e => setForm(p => ({ ...p, state: e.target.value }))}
                required className="text-sm" />
            </div>
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Postal Code</label>
              <Input value={form.postal_code} onChange={e => setForm(p => ({ ...p, postal_code: e.target.value }))}
                className="text-sm" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm text-muted-foreground mb-1">Country</label>
              <select value={form.country} onChange={e => setForm(p => ({ ...p, country: e.target.value }))}
                className="w-full rounded-xl border-border bg-card px-3 py-2 text-sm text-foreground">
                {Object.entries(COUNTRY_NAMES).map(([code, name]) => (
                  <option key={code} value={code}>{name} ({code})</option>
                ))}
              </select>
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={form.is_default}
                  onChange={e => setForm(p => ({ ...p, is_default: e.target.checked }))} />
                <span className="text-sm text-muted-foreground">Set as default</span>
              </label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
              {editing ? 'Update' : 'Save'}
            </Button>
            <Button type="button" variant="outline" onClick={() => { setShowForm(false); setEditing(null); }}>
              Cancel
            </Button>
          </div>
        </form>
      )}

      {addresses.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-12 text-center space-y-3 bg-card">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <MapPin className="h-6 w-6" />
          </div>
          <h3 className="text-base font-semibold text-foreground">No addresses saved</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">Add a shipping or billing address to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {addresses.map((addr) => (
            <div key={addr.id} className="rounded-2xl border border-border bg-card overflow-hidden shadow-xs hover:shadow-md hover:border-primary/30 transition-all duration-200 p-5">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge variant="secondary">{addr.label}</Badge>
                  <Badge variant="outline">{addr.type}</Badge>
                  {addr.is_default && (
                    <Badge variant="secondary" className="flex items-center gap-1">
                      <CheckCircle className="w-3 h-3 text-emerald-500" /> Default
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" onClick={() => openEdit(addr)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button variant="ghost" size="icon" onClick={() => deleteAddress(addr.id)}>
                    <Trash2 className="w-4 h-4 text-destructive" />
                  </Button>
                </div>
              </div>

              <div className="mt-3 text-sm text-foreground space-y-0.5">
                <p className="font-medium">{addr.full_name}</p>
                <p>{addr.street_line1}{addr.street_line2 ? `, ${addr.street_line2}` : ''}</p>
                <p>{addr.city}, {addr.state} {addr.postal_code}</p>
                <p className="text-muted-foreground">{COUNTRY_NAMES[addr.country] ?? addr.country}</p>
                {addr.phone && <p className="text-muted-foreground mt-1">{addr.phone}</p>}
              </div>

              {!addr.is_default && (
                <Button variant="link" size="sm" onClick={() => setDefault(addr.id)} className="mt-3 h-auto p-0 text-sm">
                  <Circle className="w-3.5 h-3.5" /> Set as default
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
