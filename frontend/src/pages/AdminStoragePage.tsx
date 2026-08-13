import { useState, useEffect, useCallback } from "react";
import { HardDrive, Loader2, Plus, Trash2, Save, AlertCircle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api/authFetch";





interface DiskOption {
  name: string;
  driver: string;
  label: string;
}

interface StorageRule {
  label: string;
  mime_pattern: string;
  disk: string;
  folder: string;
}

interface StorageConfig {
  default: string;
  default_folder: string;
  private_disk?: string;
  rules: StorageRule[];
}

export default function AdminStoragePage() {
  const [config, setConfig] = useState<StorageConfig | null>(null);
  const [disks, setDisks] = useState<DiskOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const loadConfig = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch(`/securegate/storage`, {  });
      const j = await res.json();
      const d = j?.data?.data ?? j?.data ?? j;
      setConfig(d.config ?? d);
      setDisks(d.available_disks ?? []);
    } catch { setMsg({ ok: false, text: "Failed to load storage config" }); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadConfig(); }, [loadConfig]);

  const save = async () => {
    if (!config) return;
    setSaving(true);
    setMsg(null);
    try {
      const res = await authFetch(`/securegate/storage`, {
        method: "PUT",
        
        body: JSON.stringify(config),
      });
      const j = await res.json();
      setMsg({ ok: res.ok, text: j.message ?? (res.ok ? "Saved" : "Failed") });
    } catch { setMsg({ ok: false, text: "Network error" }); }
    setSaving(false);
  };

  const addRule = () => {
    if (!config) return;
    const defaultDisk = disks.length > 0 ? disks[0].name : config.default;
    setConfig({
      ...config,
      rules: [...config.rules, { label: "", mime_pattern: "*", disk: defaultDisk, folder: "uploads" }],
    });
  };

  const updateRule = (i: number, field: string, value: string) => {
    if (!config) return;
    const rules = [...config.rules];
    rules[i] = { ...rules[i], [field]: value };
    setConfig({ ...config, rules });
  };

  const removeRule = (i: number) => {
    if (!config) return;
    setConfig({ ...config, rules: config.rules.filter((_, idx) => idx !== i) });
  };

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
            Storage Configuration
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Route file types to different storage providers. Update <code>.env</code> with provider credentials.
          </p>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 flex items-center gap-2 rounded-lg border p-3 text-sm ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600" : "border-destructive/30 bg-destructive/10 text-destructive"}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{msg.text}</span>
        </div>
      )}

      <div className="space-y-6">
        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <h2 className="text-sm font-bold text-foreground">Default Settings</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Default Disk</label>
              <select
                value={config?.default ?? ""}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, default: e.target.value } : prev)}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
              >
                {disks.map((d) => (
                  <option key={d.name} value={d.name}>{d.label} ({d.driver})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Private Files Disk</label>
              <select
                value={config?.private_disk ?? ""}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, private_disk: e.target.value } : prev)}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
              >
                {disks.map((d) => (
                  <option key={d.name} value={d.name}>{d.label} ({d.driver})</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wider">Default Folder</label>
              <input
                type="text"
                value={config?.default_folder ?? ""}
                onChange={(e) => setConfig((prev) => prev ? { ...prev, default_folder: e.target.value } : prev)}
                className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">Routing Rules</h2>
            <Button type="button" size="sm" variant="outline" onClick={addRule} className="gap-1">
              <Plus className="h-3 w-3" /> Add Rule
            </Button>
          </div>

          {(!config?.rules || config.rules.length === 0) && (
            <p className="text-xs text-muted-foreground py-4 text-center">
              No routing rules. All files will use the default disk.
            </p>
          )}

          <div className="space-y-3">
            {config?.rules.map((rule, i) => (
              <div key={i} className="grid grid-cols-12 gap-2 items-end p-3 rounded-lg bg-muted/40">
                <div className="col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Label</label>
                  <input
                    type="text"
                    value={rule.label}
                    onChange={(e) => updateRule(i, "label", e.target.value)}
                    placeholder="e.g. Images"
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="col-span-2 space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">MIME Pattern</label>
                  <input
                    type="text"
                    value={rule.mime_pattern}
                    onChange={(e) => updateRule(i, "mime_pattern", e.target.value)}
                    placeholder="image/*"
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs font-mono"
                  />
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Disk</label>
                  <select
                    value={rule.disk}
                    onChange={(e) => updateRule(i, "disk", e.target.value)}
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                  >
                    {disks.map((d) => (
                      <option key={d.name} value={d.name}>{d.label}</option>
                    ))}
                  </select>
                </div>
                <div className="col-span-3 space-y-1">
                  <label className="text-[10px] font-bold text-muted-foreground">Folder</label>
                  <input
                    type="text"
                    value={rule.folder}
                    onChange={(e) => updateRule(i, "folder", e.target.value)}
                    placeholder="images"
                    className="w-full rounded-md border border-border bg-card px-2 py-1.5 text-xs"
                  />
                </div>
                <div className="col-span-1 flex items-end pb-1">
                  <button
                    type="button"
                    onClick={() => removeRule(i)}
                    className="p-1.5 rounded-md text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="flex justify-end">
          <Button type="button" onClick={save} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {saving ? "Saving..." : "Save Configuration"}
          </Button>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h2 className="text-sm font-bold text-foreground">Available Disks</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {disks.map((d) => (
              <div key={d.name} className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-semibold text-foreground">{d.label}</p>
                <p className="text-[10px] text-muted-foreground font-mono mt-0.5">{d.name}</p>
                <p className="text-[10px] text-muted-foreground">Driver: {d.driver}</p>
              </div>
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground">
            Configure provider credentials in your <code className="bg-muted px-1 rounded">.env</code> file.
          </p>
        </div>
      </div>
    </div>
  );
}
