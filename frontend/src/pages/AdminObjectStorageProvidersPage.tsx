import { useState, useEffect, useCallback } from "react";
import { HardDrive, Plus, Pencil, Trash2, Loader2, Save, X, Check, AlertCircle, CheckCircle2, Eye, EyeOff, ChevronRight, HelpCircle, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

interface Provider {
  id: number;
  key: string;
  label: string;
  driver: string;
  access_key: string;
  secret_key?: string;
  region: string | null;
  bucket: string;
  endpoint: string | null;
  url: string | null;
  use_path_style_endpoint: boolean;
  is_active: boolean;
  created_at: string;
}

const emptyForm: Omit<Provider, "id" | "created_at"> = {
  key: "",
  label: "",
  driver: "s3",
  access_key: "",
  region: "eu-central-1",
  bucket: "",
  endpoint: "https://eu2.contabostorage.com",
  url: "",
  use_path_style_endpoint: true,
  is_active: true,
};

export default function AdminObjectStorageProvidersPage() {
  const [providers, setProviders] = useState<Provider[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState<Partial<Provider> | null>(null);
  const [showSecret, setShowSecret] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadProviders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/securegate/storage/providers`, { headers: getAuthHeaders() });
      const j = await res.json();
      const list = j?.data ?? j?.providers ?? [];
      setProviders(Array.isArray(list) ? list : []);
    } catch {
      setMsg({ ok: false, text: "Failed to load providers" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadProviders(); }, [loadProviders]);

  function beginAdd() {
    setEditing({ ...emptyForm });
    setShowSecret(false);
    setMsg(null);
  }

  function beginEdit(p: Provider) {
    setEditing({ ...p, secret_key: "" });
    setShowSecret(false);
    setMsg(null);
  }

  function cancelEdit() {
    setEditing(null);
  }

  function setField(field: string, value: unknown) {
    setEditing((prev) => prev ? { ...prev, [field]: value } : prev);
  }

  async function save() {
    if (!editing) return;
    setSaving(true);
    setMsg(null);

    const body: Record<string, unknown> = {
      key: editing.key,
      label: editing.label,
      driver: editing.driver ?? "s3",
      access_key: editing.access_key,
      region: editing.region || null,
      bucket: editing.bucket,
      endpoint: editing.endpoint || null,
      url: editing.url || null,
      use_path_style_endpoint: editing.use_path_style_endpoint ?? true,
      is_active: editing.is_active ?? true,
    };

    if (editing.secret_key) {
      body.secret_key = editing.secret_key;
    }

    try {
      const isEdit = "id" in editing && editing.id;
      const url = isEdit
        ? `${API_BASE}/securegate/storage/providers/${editing.id}`
        : `${API_BASE}/securegate/storage/providers`;
      const method = isEdit ? "PUT" : "POST";

      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(body) });
      const j = await res.json();

      if (!res.ok) {
        const errMsg = j?.message ?? j?.error ?? "Failed to save";
        setMsg({ ok: false, text: errMsg });
      } else {
        setMsg({ ok: true, text: isEdit ? "Provider updated." : "Provider created." });
        setEditing(null);
        loadProviders();
      }
    } catch {
      setMsg({ ok: false, text: "Network error" });
    }
    setSaving(false);
  }

  async function remove(provider: Provider) {
    if (!confirm(`Delete "${provider.label}"? This cannot be undone.`)) return;
    try {
      const res = await fetch(`${API_BASE}/securegate/storage/providers/${provider.id}`, {
        method: "DELETE",
        headers: getAuthHeaders(),
      });
      if (res.ok) {
        setMsg({ ok: true, text: "Provider deleted." });
        loadProviders();
      } else {
        setMsg({ ok: false, text: "Failed to delete provider." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error" });
    }
  }

  async function toggleActive(provider: Provider) {
    try {
      const res = await fetch(`${API_BASE}/securegate/storage/providers/${provider.id}`, {
        method: "PUT",
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: !provider.is_active }),
      });
      if (res.ok) {
        loadProviders();
      }
    } catch {
      // silent
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <HardDrive className="h-6 w-6" />
            Object Storage Providers
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add S3-compatible storage providers (Contabo, Wasabi, DigitalOcean Spaces, MinIO, etc.)
          </p>
        </div>
        {!editing && (
          <Button type="button" onClick={beginAdd} className="gap-1">
            <Plus className="h-4 w-4" /> Add Provider
          </Button>
        )}
      </div>

      <details className="mb-6 rounded-xl border border-border bg-card overflow-hidden">
        <summary className="flex items-center gap-2 p-3 cursor-pointer select-none hover:bg-muted/30 transition-colors text-sm font-medium text-muted-foreground">
          <HelpCircle className="h-4 w-4 text-primary" />
          Quick Setup Guide
          <ChevronRight className="h-4 w-4 ml-auto details-open:rotate-90 transition-transform [details[open]_&]:rotate-90" />
        </summary>
        <div className="px-4 pb-4 space-y-3 border-t border-border pt-3">
          <div className="grid gap-3 text-xs">
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="font-semibold text-foreground mb-1">Contabo Object Storage</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Create bucket in <a href="https://console.contabo.com/object-storage" target="_blank" rel="noopener noreferrer" className="text-primary underline">Contabo Console</a> <ExternalLink className="h-3 w-3 inline" /></li>
                <li>Go to bucket → <strong>Access Keys</strong> → generate a key pair</li>
                <li>Set <strong>Endpoint</strong> to <code className="bg-muted px-1 rounded">https://eu.contabostorage.com</code> (adjust region)</li>
                <li>Leave <strong>Use Path-Style Endpoint</strong> <strong>unchecked</strong></li>
                <li>Public URL format: <code className="bg-muted px-1 rounded">{`https://{bucket}.eu.contabostorage.com`}</code></li>
              </ol>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="font-semibold text-foreground mb-1">Wasabi</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Create bucket in <a href="https://console.wasabi.com" target="_blank" rel="noopener noreferrer" className="text-primary underline">Wasabi Console</a> <ExternalLink className="h-3 w-3 inline" /></li>
                <li>Go to <strong>Access Keys</strong> → create key pair</li>
                <li>Set <strong>Endpoint</strong> to <code className="bg-muted px-1 rounded">{`https://s3.{region}.wasabisys.com`}</code></li>
                <li>Check <strong>Use Path-Style Endpoint</strong></li>
              </ol>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="font-semibold text-foreground mb-1">DigitalOcean Spaces</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Create Space in <a href="https://cloud.digitalocean.com/spaces" target="_blank" rel="noopener noreferrer" className="text-primary underline">DO Control Panel</a> <ExternalLink className="h-3 w-3 inline" /></li>
                <li>Generate API key (Spaces Access Key)</li>
                <li>Set <strong>Endpoint</strong> to <code className="bg-muted px-1 rounded">{`https://{region}.digitaloceanspaces.com`}</code></li>
                <li>Leave <strong>Use Path-Style Endpoint</strong> <strong>unchecked</strong></li>
                <li>Set <strong>CDN / Public URL</strong> to <code className="bg-muted px-1 rounded">{`https://{bucket}.{region}.cdn.digitaloceanspaces.com`}</code></li>
              </ol>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="font-semibold text-foreground mb-1">Bunny CDN (Storage Zone)</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Create a Storage Zone in <a href="https://panel.bunny.net" target="_blank" rel="noopener noreferrer" className="text-primary underline">Bunny Panel</a> <ExternalLink className="h-3 w-3 inline" /></li>
                <li>Go to <strong>FTP & API</strong> → copy API Access Key</li>
                <li>Set <strong>Endpoint</strong> to <code className="bg-muted px-1 rounded">{`https://{storage-zone}.{region}.storage.bunnycdn.com`}</code></li>
                <li>Check <strong>Use Path-Style Endpoint</strong></li>
              </ol>
            </div>
            <div className="rounded-lg border border-border bg-muted/30 p-3">
              <p className="font-semibold text-foreground mb-1">MinIO (Self-Hosted)</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Create bucket via MinIO Console or <code className="bg-muted px-1 rounded">mc mb</code></li>
                <li>Set <strong>Endpoint</strong> to your server URL (e.g. <code className="bg-muted px-1 rounded">https://minio.example.com</code>)</li>
                <li>Check <strong>Use Path-Style Endpoint</strong></li>
              </ol>
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground pt-1 border-t border-border">
            After adding a provider, go to the <strong>Storage Configuration</strong> page to set it as the Default or Private Files disk.
          </p>
        </div>
      </details>

      {msg && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      {editing && (
        <div className="rounded-xl border border-border bg-card p-5 space-y-4 mb-6">
          <h2 className="text-sm font-bold text-foreground">
            {"id" in editing && editing.id ? "Edit Provider" : "New Provider"}
          </h2>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Machine Key</label>
              <input
                type="text"
                value={editing.key ?? ""}
                onChange={(e) => setField("key", e.target.value)}
                placeholder="contabo_prod"
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono"
              />
              <p className="text-[10px] text-muted-foreground">Unique identifier (lowercase, no spaces)</p>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Display Label</label>
              <input
                type="text"
                value={editing.label ?? ""}
                onChange={(e) => setField("label", e.target.value)}
                placeholder="Contabo Production"
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Access Key ID</label>
              <input
                type="text"
                value={editing.access_key ?? ""}
                onChange={(e) => setField("access_key", e.target.value)}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Secret Access Key</label>
              <div className="relative">
                <input
                  type={showSecret ? "text" : "password"}
                  value={editing.secret_key ?? ""}
                  onChange={(e) => setField("secret_key", e.target.value)}
                  className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono pr-8"
                  placeholder={editing.id ? "(unchanged)" : ""}
                />
                <button
                  type="button"
                  onClick={() => setShowSecret(!showSecret)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showSecret ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Bucket</label>
              <input
                type="text"
                value={editing.bucket ?? ""}
                onChange={(e) => setField("bucket", e.target.value)}
                placeholder="my-bucket"
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Region</label>
              <input
                type="text"
                value={editing.region ?? ""}
                onChange={(e) => setField("region", e.target.value)}
                placeholder="eu-central-1"
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Endpoint URL</label>
              <input
                type="text"
                value={editing.endpoint ?? ""}
                onChange={(e) => setField("endpoint", e.target.value)}
                placeholder="https://eu2.contabostorage.com"
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">CDN / Public URL</label>
              <input
                type="text"
                value={editing.url ?? ""}
                onChange={(e) => setField("url", e.target.value)}
                placeholder="https://cdn.example.com"
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm font-mono"
              />
            </div>
          </div>

          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.use_path_style_endpoint ?? true}
                onChange={(e) => setField("use_path_style_endpoint", e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-xs font-medium text-muted-foreground">Use Path-Style Endpoint</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={editing.is_active ?? true}
                onChange={(e) => setField("is_active", e.target.checked)}
                className="rounded border-border"
              />
              <span className="text-xs font-medium text-muted-foreground">Active</span>
            </label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={cancelEdit} className="gap-1">
              <X className="h-4 w-4" /> Cancel
            </Button>
            <Button type="button" onClick={save} disabled={saving} className="gap-1">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {saving ? "Saving..." : "Save"}
            </Button>
          </div>
        </div>
      )}

      {providers.length === 0 && !editing && (
        <div className="rounded-xl border border-border bg-card p-10 text-center">
          <HardDrive className="h-10 w-10 text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No storage providers configured.</p>
          <p className="text-xs text-muted-foreground mt-1">Add a provider to start using S3-compatible object storage.</p>
        </div>
      )}

      {providers.length > 0 && (
        <div className="space-y-3">
          {providers.map((p) => (
            <div key={p.id} className="rounded-xl border border-border bg-card p-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => toggleActive(p)}
                  className={`p-1 rounded-full transition-colors ${p.is_active ? "text-emerald-500 hover:text-emerald-600" : "text-muted-foreground/40 hover:text-muted-foreground"}`}
                  title={p.is_active ? "Active (click to disable)" : "Inactive (click to enable)"}
                >
                  {p.is_active ? <Check className="h-4 w-4" /> : <X className="h-4 w-4" />}
                </button>
                <div>
                  <p className="text-sm font-semibold text-foreground">{p.label}</p>
                  <p className="text-xs text-muted-foreground font-mono">
                    {p.key} &middot; {p.bucket} &middot; {p.region ?? "no region"}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <Button type="button" variant="ghost" size="sm" onClick={() => beginEdit(p)}>
                  <Pencil className="h-3.5 w-3.5" />
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => remove(p)} className="text-destructive hover:text-destructive">
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
