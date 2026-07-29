import { useState, useEffect, useCallback } from "react";
import { Settings, Loader2, Save, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function authHeaders() {
  const t = localStorage.getItem("murihspace-token") || localStorage.getItem("auth_token");
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

export default function AdminSettingsPage() {
  const [platformName, setPlatformName] = useState("MurihSpace");
  const [supportEmail, setSupportEmail] = useState("support@murihspace.com");
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);

  const fetchSettings = useCallback(async () => {
    setFetchError(null);
    try {
      const res = await fetch(`${API_BASE}/securegate/settings`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load settings");
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      if (d?.platform_name) setPlatformName(d.platform_name);
      if (d?.support_email) setSupportEmail(d.support_email);
      if (d?.maintenance_mode !== undefined) setMaintenanceMode(Boolean(d.maintenance_mode));
    } catch (e) { setFetchError(e instanceof Error ? e.message : "Failed to load settings"); }
    finally { setInitialLoading(false); }
  }, []);

  useEffect(() => { fetchSettings(); }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/securegate/settings`, { method: "PUT", headers: authHeaders(), body: JSON.stringify({ platform_name: platformName, support_email: supportEmail, maintenance_mode: maintenanceMode }) });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      setMsg("Settings saved!");
      setTimeout(() => setMsg(null), 2000);
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Save failed");
    } finally { setSaving(false); }
  };

  if (initialLoading) return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;

  return (
    <div className="w-full mx-auto max-w-[800px] space-y-6 p-6 lg:p-10">
      <div><h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5"><Settings className="h-6 w-6 text-[#38A8D8]" /> Admin Settings</h1><p className="text-xs text-muted-foreground mt-1">Platform configuration and settings.</p></div>

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-xs text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={() => { setInitialLoading(true); fetchSettings(); }} className="ml-auto text-muted-foreground hover:text-foreground font-bold">Retry</button>
        </div>
      )}

      <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
        <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground">Platform Name</label><Input value={platformName} onChange={(e) => setPlatformName(e.target.value)} /></div>
        <div className="space-y-2"><label className="text-xs font-bold text-muted-foreground">Support Email</label><Input type="email" value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} /></div>
        <div className="flex items-center justify-between p-3 rounded-xl border border-border">
          <div><p className="text-xs font-bold text-foreground">Maintenance Mode</p><p className="text-[10px] text-muted-foreground">Block all user access except admins</p></div>
          <button onClick={() => setMaintenanceMode(!maintenanceMode)} className={`w-10 h-5 rounded-full transition-colors ${maintenanceMode ? 'bg-rose-500' : 'bg-muted'}`}>
            <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform ${maintenanceMode ? 'translate-x-5' : 'translate-x-0.5'}`} />
          </button>
        </div>
        {msg && <p className={`text-xs font-bold ${msg === 'Settings saved!' ? 'text-emerald-400' : 'text-rose-400'}`}>{msg}</p>}
        <Button onClick={handleSave} disabled={saving} className="text-sm font-bold gap-1.5">{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Settings</Button>
      </div>
    </div>
  );
}
