import { useState, useEffect, useCallback } from "react";
import { BarChart3, Loader2, TrendingUp, ToggleLeft, ToggleRight, RotateCcw, Play, Square, FlaskConical, Check, AlertCircle, Zap, Plus, Trash2, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { getAuthToken } from "@/lib/auth/token";
import { useConfirm, usePrompt } from "@/components/ui/DialogProvider";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? "http://localhost:8000/api/v1";

function getAuthHeaders() {
  const token = getAuthToken();
  return { "Content-Type": "application/json", Accept: "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

const FEED_TYPES = ["home", "following", "trending", "community", "recommended"];

export default function AdminAlgorithmPage() {
  const [tab, setTab] = useState<"weights" | "configs" | "boosts" | "abtests" | "changes">("weights");
  const [weights, setWeights] = useState<any[]>([]);
  const [configs, setConfigs] = useState<any[]>([]);
  const [boosts, setBoosts] = useState<any[]>([]);
  const [abTests, setAbTests] = useState<any[]>([]);
  const [changes, setChanges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [feedType, setFeedType] = useState("home");
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [boostForm, setBoostForm] = useState({ boostable_type: "", boostable_id: "", boost_factor: "2", reason: "", ends_at: "" });
  const [abForm, setAbForm] = useState({ name: "", feed_type: "home", control_config: "{}", variant_config: "{}", traffic_percentage: "50" });
  const [showBoostForm, setShowBoostForm] = useState(false);
  const [showAbForm, setShowAbForm] = useState(false);
  const [saving, setSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [wRes, cRes, bRes, aRes, chRes] = await Promise.all([
        fetch(`${API_BASE}/securegate/feed-algorithm/weights?feed_type=${feedType}`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/securegate/feed-algorithm/configs`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/securegate/feed-algorithm/boosts`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/securegate/feed-algorithm/ab-tests`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/securegate/feed-algorithm/changes`, { headers: getAuthHeaders() }),
      ]);
      if (wRes.ok) setWeights(await wRes.json());
      if (cRes.ok) setConfigs(await cRes.json());
      if (bRes.ok) setBoosts(await bRes.json());
      if (aRes.ok) setAbTests(await aRes.json());
      if (chRes.ok) { const j = await chRes.json(); setChanges(j?.data ?? j ?? []); }
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [feedType]);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const confirm = useConfirm();
  const prompt = usePrompt();

  const handleUpdateWeight = async (id: number, field: string, value: any) => {
    const reason = await prompt({ title: "Reason Required", message: "Reason for this weight change:" });
    if (!reason) return;
    try {
      const body: any = { reason };
      body[field] = value;
      const res = await fetch(`${API_BASE}/securegate/feed-algorithm/weights/${id}`, {
        method: "PUT", headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) { setMsg({ ok: true, text: "Weight updated." }); fetchAll(); }
      else { const j = await res.json(); setMsg({ ok: false, text: j.message || "Failed." }); }
    } catch { setMsg({ ok: false, text: "Error." }); }
  };

  const handlePromote = async (id: number) => {
    const reason = await prompt({ title: "Promote Config", message: "Reason for promotion to production:" });
    if (!reason) return;
    try {
      await fetch(`${API_BASE}/securegate/feed-algorithm/configs/${id}/promote`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ reason }) });
      setMsg({ ok: true, text: "Promoted to production." }); fetchAll();
    } catch { /* ignore */ }
  };

  const handleRollback = async (id: number) => {
    const reason = await prompt({ title: "Rollback Config", message: "Reason for rollback:" });
    if (!reason) return;
    try {
      await fetch(`${API_BASE}/securegate/feed-algorithm/configs/${id}/rollback`, { method: "POST", headers: getAuthHeaders(), body: JSON.stringify({ reason }) });
      fetchAll();
    } catch { /* ignore */ }
  };

  const handleCreateBoost = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/securegate/feed-algorithm/boosts`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify({ ...boostForm, boost_factor: parseFloat(boostForm.boost_factor), traffic_percentage: undefined }),
      });
      if (res.ok) { setMsg({ ok: true, text: "Boost created." }); setShowBoostForm(false); setBoostForm({ boostable_type: "", boostable_id: "", boost_factor: "2", reason: "", ends_at: "" }); fetchAll(); }
      else { const j = await res.json(); setMsg({ ok: false, text: j.message || "Failed." }); }
    } catch { setMsg({ ok: false, text: "Error." }); }
    finally { setSaving(false); }
  };

  const handleCreateAbTest = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      const body = {
        ...abForm,
        control_config: JSON.parse(abForm.control_config),
        variant_config: JSON.parse(abForm.variant_config),
        traffic_percentage: parseInt(abForm.traffic_percentage),
      };
      const res = await fetch(`${API_BASE}/securegate/feed-algorithm/ab-tests`, {
        method: "POST", headers: getAuthHeaders(),
        body: JSON.stringify(body),
      });
      if (res.ok) { setMsg({ ok: true, text: "A/B test created." }); setShowAbForm(false); setAbForm({ name: "", feed_type: "home", control_config: "{}", variant_config: "{}", traffic_percentage: "50" }); fetchAll(); }
      else { const j = await res.json(); setMsg({ ok: false, text: j.message || "Failed." }); }
    } catch (e: any) { setMsg({ ok: false, text: "Invalid JSON in config." }); }
    finally { setSaving(false); }
  };

  const handleSeed = async () => {
    if (!await confirm({ title: "Seed Default Weights", message: "Seed default weights? This will not overwrite existing." })) return;
    try {
      await fetch(`${API_BASE}/securegate/feed-algorithm/seed`, { method: "POST", headers: getAuthHeaders() });
      setMsg({ ok: true, text: "Default weights seeded." }); fetchAll();
    } catch { /* ignore */ }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2"><BarChart3 className="w-6 h-6 text-blue-500" /> Feed Algorithm</h1>
          <p className="text-sm text-gray-500 mt-1">Manage ranking weights, boosting, A/B tests, and feed configuration</p>
        </div>
        <div className="flex gap-2">
          <Button variant={tab === "weights" ? "default" : "outline"} size="sm" onClick={() => setTab("weights")}>Weights</Button>
          <Button variant={tab === "configs" ? "default" : "outline"} size="sm" onClick={() => setTab("configs")}>Configs</Button>
          <Button variant={tab === "boosts" ? "default" : "outline"} size="sm" onClick={() => setTab("boosts")}>Boosts</Button>
          <Button variant={tab === "abtests" ? "default" : "outline"} size="sm" onClick={() => setTab("abtests")}>A/B Tests</Button>
          <Button variant={tab === "changes" ? "default" : "outline"} size="sm" onClick={() => setTab("changes")}>Audit Log</Button>
        </div>
      </div>

      {msg && (
        <div className={`mb-4 p-3 rounded-lg flex items-center gap-2 text-sm ${msg.ok ? "bg-green-50 text-green-700" : "bg-red-50 text-red-700"}`}>
          {msg.ok ? <Check className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}{msg.text}
        </div>
      )}

      {tab === "weights" && (
        <div>
          <div className="flex items-center gap-3 mb-4">
            <label className="text-sm font-medium">Feed Type:</label>
            <select value={feedType} onChange={e => setFeedType(e.target.value)} className="border rounded-lg px-3 py-1.5 text-sm">
              {FEED_TYPES.map(ft => <option key={ft} value={ft}>{ft.charAt(0).toUpperCase() + ft.slice(1)}</option>)}
            </select>
            <Button variant="outline" size="sm" onClick={handleSeed}><RotateCcw className="w-3 h-3 mr-1" />Seed Defaults</Button>
          </div>
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50"><h2 className="font-semibold">Ranking Signals</h2></div>
            {loading ? (
              <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div>
            ) : (
              <div className="divide-y">
                {weights.map((w: any) => (
                  <div key={w.id} className="p-4 flex items-center justify-between hover:bg-gray-50">
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{w.label || w.signal_name}</span>
                        <Badge className={w.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}>{w.is_active ? "Active" : "Disabled"}</Badge>
                      </div>
                      <p className="text-xs text-gray-400">{w.signal_name} {w.group && `- ${w.group}`}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" onClick={() => handleUpdateWeight(w.id, "weight", Math.max(0, parseFloat(w.weight) - 0.5).toFixed(4))} disabled={!w.is_active}>-</Button>
                        <span className="w-16 text-center font-mono text-sm font-semibold">{parseFloat(w.weight).toFixed(2)}</span>
                        <Button variant="ghost" size="sm" onClick={() => handleUpdateWeight(w.id, "weight", (parseFloat(w.weight) + 0.5).toFixed(4))} disabled={!w.is_active}>+</Button>
                      </div>
                      <Button variant="ghost" size="sm" onClick={() => handleUpdateWeight(w.id, "is_active", !w.is_active)}>
                        {w.is_active ? <ToggleRight className="w-4 h-4 text-green-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "configs" && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50"><h2 className="font-semibold">Feed Configurations</h2></div>
          {loading ? <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div> : (
            <div className="divide-y">
              {configs.map((c: any) => (
                <div key={c.id} className="p-4 flex items-center justify-between">
                  <div>
                    <p className="font-medium">{c.label}</p>
                    <p className="text-xs text-gray-400">Stage: <Badge className={c.stage === "production" ? "bg-green-100 text-green-700" : c.stage === "staging" ? "bg-yellow-100 text-yellow-700" : "bg-gray-100 text-gray-600"}>{c.stage}</Badge> {c.is_active ? "Active" : "Inactive"}</p>
                  </div>
                  <div className="flex gap-2">
                    {c.stage !== "production" && <Button variant="outline" size="sm" onClick={() => handlePromote(c.id)}><TrendingUp className="w-3 h-3 mr-1" />Promote</Button>}
                    {c.stage === "production" && <Button variant="outline" size="sm" onClick={() => handleRollback(c.id)}><RotateCcw className="w-3 h-3 mr-1" />Rollback</Button>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "boosts" && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowBoostForm(!showBoostForm)}><Plus className="w-4 h-4 mr-2" />Add Boost</Button>
          </div>
          {showBoostForm && (
            <form onSubmit={handleCreateBoost} className="bg-white border rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Input placeholder="Boostable Type (e.g. posts)" value={boostForm.boostable_type} onChange={e => setBoostForm(f => ({ ...f, boostable_type: e.target.value }))} required />
                <Input type="number" placeholder="Boostable ID" value={boostForm.boostable_id} onChange={e => setBoostForm(f => ({ ...f, boostable_id: e.target.value }))} required />
                <Input type="number" step="0.1" placeholder="Factor (e.g. 2)" value={boostForm.boost_factor} onChange={e => setBoostForm(f => ({ ...f, boost_factor: e.target.value }))} required />
                <Input type="date" value={boostForm.ends_at} onChange={e => setBoostForm(f => ({ ...f, ends_at: e.target.value }))} />
              </div>
              <Input placeholder="Reason" value={boostForm.reason} onChange={e => setBoostForm(f => ({ ...f, reason: e.target.value }))} required />
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Zap className="w-4 h-4 mr-2" />}Create Boost</Button>
                <Button type="button" variant="outline" onClick={() => setShowBoostForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50"><h2 className="font-semibold">Active Boosts</h2></div>
            {boosts.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No active boosts</div>
            ) : (
              <div className="divide-y">
                {boosts.map((b: any) => (
                  <div key={b.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{b.boostable_type} #{b.boostable_id} &times;{b.boost_factor}</p>
                      <p className="text-xs text-gray-400">{b.reason} {b.ends_at && <>until {new Date(b.ends_at).toLocaleDateString()}</>}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className="bg-green-100 text-green-700">Active</Badge>
                      <Button variant="ghost" size="sm" onClick={async () => { if (await confirm({ title: "Remove Boost", message: "Remove boost?", variant: "destructive" })) { await fetch(`${API_BASE}/securegate/feed-algorithm/boosts/${b.id}`, { method: "DELETE", headers: getAuthHeaders() }); fetchAll(); } }}><Trash2 className="w-4 h-4 text-red-500" /></Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "abtests" && (
        <div>
          <div className="flex justify-end mb-4">
            <Button onClick={() => setShowAbForm(!showAbForm)}><FlaskConical className="w-4 h-4 mr-2" />New A/B Test</Button>
          </div>
          {showAbForm && (
            <form onSubmit={handleCreateAbTest} className="bg-white border rounded-xl p-4 mb-4 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Input placeholder="Test Name" value={abForm.name} onChange={e => setAbForm(f => ({ ...f, name: e.target.value }))} required />
                <select value={abForm.feed_type} onChange={e => setAbForm(f => ({ ...f, feed_type: e.target.value }))} className="border rounded-lg px-3 py-2 text-sm">
                  {FEED_TYPES.map(ft => <option key={ft} value={ft}>{ft}</option>)}
                </select>
                <Input type="number" placeholder="Traffic % (1-100)" value={abForm.traffic_percentage} onChange={e => setAbForm(f => ({ ...f, traffic_percentage: e.target.value }))} />
              </div>
              <Input placeholder='Control Config JSON (e.g. {"recency":15})' value={abForm.control_config} onChange={e => setAbForm(f => ({ ...f, control_config: e.target.value }))} />
              <Input placeholder='Variant Config JSON' value={abForm.variant_config} onChange={e => setAbForm(f => ({ ...f, variant_config: e.target.value }))} />
              <div className="flex gap-2">
                <Button type="submit" disabled={saving}>{saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}Create</Button>
                <Button type="button" variant="outline" onClick={() => setShowAbForm(false)}>Cancel</Button>
              </div>
            </form>
          )}
          <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
            <div className="p-4 border-b bg-gray-50"><h2 className="font-semibold">A/B Tests</h2></div>
            {abTests.length === 0 ? (
              <div className="text-center py-8 text-gray-400 text-sm">No A/B tests created</div>
            ) : (
              <div className="divide-y">
                {abTests.map((t: any) => (
                  <div key={t.id} className="p-4 flex items-center justify-between">
                    <div>
                      <p className="font-medium">{t.name}</p>
                      <p className="text-xs text-gray-400">{t.feed_type} &middot; {t.traffic_percentage}% variant</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={t.status === "running" ? "bg-green-100 text-green-700" : t.status === "draft" ? "bg-gray-100 text-gray-600" : "bg-blue-100 text-blue-700"}>{t.status}</Badge>
                      {t.status === "draft" && <Button variant="outline" size="sm" onClick={async () => { await fetch(`${API_BASE}/securegate/feed-algorithm/ab-tests/${t.id}/start`, { method: "POST", headers: getAuthHeaders() }); fetchAll(); }}><Play className="w-3 h-3 mr-1" />Start</Button>}
                      {t.status === "running" && <Button variant="outline" size="sm" onClick={async () => { await fetch(`${API_BASE}/securegate/feed-algorithm/ab-tests/${t.id}/end`, { method: "POST", headers: getAuthHeaders() }); fetchAll(); }}><Square className="w-3 h-3 mr-1" />End</Button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === "changes" && (
        <div className="bg-white border rounded-xl shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50"><h2 className="font-semibold">Algorithm Change Audit Log</h2></div>
          {loading ? <div className="p-12 text-center"><Loader2 className="w-6 h-6 animate-spin mx-auto text-gray-400" /></div> : changes.length === 0 ? (
            <div className="text-center py-8 text-gray-400 text-sm"><FileText className="w-8 h-8 mx-auto mb-2 opacity-40" /><p>No changes recorded yet</p></div>
          ) : (
            <div className="divide-y">
              {changes.map((ch: any) => (
                <div key={ch.id} className="p-4 text-sm">
                  <div className="flex items-center justify-between">
                    <p className="font-medium">{ch.action.replace(/_/g, " ")}</p>
                    <span className="text-xs text-gray-400">{new Date(ch.created_at).toLocaleString()}</span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    by {ch.admin?.name || "Unknown"}
                    {ch.signal_name && <> &middot; {ch.signal_name}</>}
                    {ch.previous_weight !== null && ch.new_weight !== null && <> &middot; {parseFloat(ch.previous_weight).toFixed(2)} &rarr; {parseFloat(ch.new_weight).toFixed(2)}</>}
                  </p>
                  {ch.reason && <p className="text-xs text-gray-400 mt-0.5">Reason: {ch.reason}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
