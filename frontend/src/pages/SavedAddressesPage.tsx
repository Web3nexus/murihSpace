import { useState, useEffect, useCallback } from "react";
import { MapPin, Plus, Loader2, Edit, Trash2, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getAuthToken } from "@/lib/auth/token";
import { CountrySelect } from "@/components/forms/CountrySelect";
import { StateSelect } from "@/components/forms/StateSelect";
import { PhoneInput } from "@/components/forms/PhoneInput";
import { useConfirm } from "@/components/ui/DialogProvider";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Address {
  id: number;
  label: string;
  full_name: string;
  street_line1?: string;
  street?: string;
  city: string;
  state: string;
  country: string;
  postal_code?: string;
  zip?: string;
  phone?: string;
  is_default: boolean;
}

export default function SavedAddressesPage() {
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Address | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [label, setLabel] = useState("");
  const [fullName, setFullName] = useState("");
  const [street, setStreet] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [country, setCountry] = useState("GB");
  const [zip, setZip] = useState("");
  const [phone, setPhone] = useState("");

  const fetchAddresses = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/addresses`, { headers: getAuthHeaders() });
      if (!res.ok) throw new Error("Failed to load");
      const j = await res.json();
      const list = j?.success ? j?.data : j;
      setAddresses(list?.data ?? list ?? []);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAddresses(); }, [fetchAddresses]);

  const resetForm = () => {
    setLabel(""); setFullName(""); setStreet(""); setCity(""); setState(""); setCountry("GB"); setZip(""); setPhone("");
    setEditing(null); setShowForm(false); setMsg(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!label.trim() || !fullName.trim() || !street.trim() || !city.trim() || !country.trim()) return;
    setSaving(true);
    setMsg(null);
    try {
      const body = {
        label: label.trim(),
        full_name: fullName.trim(),
        street_line1: street.trim(),
        city: city.trim(),
        state: state.trim(),
        country: country.trim(),
        postal_code: zip.trim(),
        phone: phone.trim(),
      };
      const res = editing
        ? await fetch(`${API_BASE}/addresses/${editing.id}`, { method: "PATCH", headers: getAuthHeaders(), body: JSON.stringify(body) })
        : await fetch(`${API_BASE}/addresses`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify(body) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? j?.errors?.state?.[0] ?? "Save failed");
      resetForm();
      fetchAddresses();
      setMsg({ ok: true, text: editing ? "Address updated." : "Address saved." });
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
    } finally { setSaving(false); }
  };

  const setDefault = async (id: number) => {
    await fetch(`${API_BASE}/addresses/${id}/default`, { method: "PATCH", headers: getAuthHeaders() });
    fetchAddresses();
  };

  const confirm = useConfirm();

  const handleDelete = async (id: number) => {
    if (!await confirm({ title: "Delete Address", message: "Delete this address?", variant: "destructive" })) return;
    await fetch(`${API_BASE}/addresses/${id}`, { method: "DELETE", headers: getAuthHeaders() });
    fetchAddresses();
  };

  if (loading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <MapPin className="h-6 w-6 text-[#38A8D8]" /> Saved Addresses
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Manage your shipping and billing addresses.</p>
        </div>
        <Button onClick={() => { resetForm(); setShowForm(true); }} className="text-sm font-bold gap-1.5">
          <Plus className="h-4 w-4" /> Add Address
        </Button>
      </div>

      {showForm && (
        <form onSubmit={handleSave} className="border border-border rounded-2xl bg-card p-6 space-y-4">
          {msg && <div className={`p-3 rounded-xl text-xs font-bold ${msg.ok ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'}`}>{msg.text}</div>}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Label</label>
              <Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Home / Work" required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Full Name</label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} required />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-muted-foreground">Street Address</label>
              <Input value={street} onChange={(e) => setStreet(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">Country</label>
              <CountrySelect value={country} onChange={(iso2) => setCountry(iso2)} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">State / Province</label>
              <StateSelect countryIso2={country} value={state} onChange={setState} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">City</label>
              <Input value={city} onChange={(e) => setCity(e.target.value)} required />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-bold text-muted-foreground">ZIP / Postal Code</label>
              <Input value={zip} onChange={(e) => setZip(e.target.value)} />
            </div>
            <div className="space-y-2 md:col-span-2">
              <label className="text-xs font-bold text-muted-foreground">Phone</label>
              <PhoneInput countryIso2={country} value={phone} onChange={setPhone} />
            </div>
          </div>
          <div className="flex gap-2">
            <Button type="submit" disabled={saving} className="text-sm font-bold">
              {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}{editing ? "Update" : "Save"}
            </Button>
            <Button type="button" variant="ghost" onClick={resetForm} className="text-sm">Cancel</Button>
          </div>
        </form>
      )}

      {addresses.length === 0 ? (
        <div className="p-16 text-center border border-dashed border-border rounded-3xl bg-card">
          <MapPin className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-bold">No addresses saved</h3>
          <p className="text-xs text-muted-foreground mt-1">Add an address for faster checkout.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {addresses.map((a) => (
            <div key={a.id} className="border border-border rounded-2xl bg-card p-5 space-y-3 hover:shadow-md transition-shadow relative">
              {a.is_default && <span className="absolute top-3 right-3 text-emerald-400"><CheckCircle className="h-4 w-4" /></span>}
              <div className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-[#38A8D8]" />
                <span className="text-xs font-bold text-foreground">{a.label}</span>
                {a.is_default && <span className="text-[10px] text-emerald-400 font-bold">Default</span>}
              </div>
              <div className="text-xs text-muted-foreground space-y-0.5">
                <p className="font-semibold text-foreground">{a.full_name}</p>
                <p>{a.street_line1 || a.street}</p>
                <p>{a.city}{a.state ? `, ${a.state}` : ''} {a.postal_code || a.zip}</p>
                <p>{a.country}</p>
                {a.phone && <p>{a.phone}</p>}
              </div>
              <div className="flex gap-1 pt-2">
                {!a.is_default && <Button size="sm" variant="outline" className="text-[10px] h-7" onClick={() => setDefault(a.id)}>Set Default</Button>}
                <Button size="sm" variant="ghost" className="h-7 text-[10px]" onClick={() => {
                  setEditing(a);
                  setLabel(a.label);
                  setFullName(a.full_name);
                  setStreet(a.street_line1 || a.street || "");
                  setCity(a.city);
                  setState(a.state ?? "");
                  setCountry(a.country || "GB");
                  setZip(a.postal_code || a.zip || "");
                  setPhone(a.phone || "");
                  setShowForm(true);
                  setMsg(null);
                }}><Edit className="h-3 w-3" /></Button>
                <Button size="sm" variant="ghost" className="h-7 text-[10px] text-destructive" onClick={() => handleDelete(a.id)}><Trash2 className="h-3 w-3" /></Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
