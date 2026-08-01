import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck, UserPlus, Loader2, Search, Pencil, Trash2, AlertCircle,
  CheckCircle2, X, ChevronLeft, ChevronRight, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

interface AdminAccount {
  id: number;
  name: string;
  email: string;
  username: string;
  role: string;
  admin_role: string;
  admin_permissions: string[];
  status: string;
  created_at: string;
}

interface RoleMeta {
  roles: Record<string, string>;
  permissions: Record<string, string>;
}

const ROLE_STYLES: Record<string, string> = {
  super_admin: "bg-violet-500/20 text-violet-400 border-violet-500/30",
  content_admin: "bg-sky-500/20 text-sky-400 border-sky-500/30",
  commerce_admin: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  support_admin: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
};

const PERM_LABELS: Record<string, { short: string; color: string }> = {
  users: { short: "Users", color: "bg-blue-500/15 text-blue-400" },
  kyc: { short: "KYC", color: "bg-sky-500/15 text-sky-400" },
  content: { short: "Content", color: "bg-fuchsia-500/15 text-fuchsia-400" },
  commerce: { short: "Commerce", color: "bg-amber-500/15 text-amber-400" },
  payouts: { short: "Payouts", color: "bg-emerald-500/15 text-emerald-400" },
  analytics: { short: "Analytics", color: "bg-purple-500/15 text-purple-400" },
  settings: { short: "Settings", color: "bg-slate-500/15 text-slate-300" },
  admins: { short: "Admins", color: "bg-rose-500/15 text-rose-400" },
};

export function AdminManagementPage() {
  const [admins, setAdmins] = useState<AdminAccount[]>([]);
  const [meta, setMeta] = useState<RoleMeta | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);

  const [showAdd, setShowAdd] = useState(false);
  const [addMode, setAddMode] = useState<"existing" | "new">("existing");
  const [editing, setEditing] = useState<AdminAccount | null>(null);
  const [removing, setRemoving] = useState<AdminAccount | null>(null);
  const [saving, setSaving] = useState(false);
  const [submittingRemove, setSubmittingRemove] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [form, setForm] = useState({
    user_id: "",
    name: "",
    email: "",
    password: "",
    admin_role: "support_admin",
    permissions: [] as string[],
  });

  const [editForm, setEditForm] = useState({
    admin_role: "support_admin",
    permissions: [] as string[],
    status: "active",
  });

  const fetchMeta = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/securegate/admins/roles`, { headers: authHeaders() });
      if (!res.ok) return;
      const j = await res.json();
      setMeta(j?.data?.data ?? j?.data ?? null);
    } catch { /* ignore */ }
  }, []);

  const fetchAdmins = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      params.set("page", String(page));
      params.set("per_page", "20");
      const res = await fetch(`${API_BASE}/securegate/admins?${params}`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load admins");
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      setAdmins(d?.data ?? []);
      setLastPage(d?.last_page ?? 1);
      setTotal(d?.total ?? 0);
    } catch {
      setFetchError("Failed to load admins");
    } finally {
      setLoading(false);
    }
  }, [search, page]);

  useEffect(() => { fetchMeta(); }, [fetchMeta]);
  useEffect(() => { fetchAdmins(); }, [fetchAdmins]);

  const resetForm = () => setForm({ user_id: "", name: "", email: "", password: "", admin_role: "support_admin", permissions: [] });

  const togglePerm = (perm: string, set: (p: string[]) => void, cur: string[]) => {
    set(cur.includes(perm) ? cur.filter((p) => p !== perm) : [...cur, perm]);
  };

  const effectivePerms = (role: string, perms: string[]) =>
    role === "super_admin" ? Object.keys(meta?.permissions ?? {}) : perms;

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setMsg(null);
    const body: Record<string, unknown> = { admin_role: form.admin_role };
    const perms = effectivePerms(form.admin_role, form.permissions);
    if (perms.length > 0) body.permissions = perms;
    if (addMode === "existing") {
      if (!form.user_id) { setMsg({ ok: false, text: "Select a user or switch to 'New account'." }); setSaving(false); return; }
      body.user_id = Number(form.user_id);
    } else {
      if (!form.name || !form.email || form.password.length < 8) {
        setMsg({ ok: false, text: "Name, valid email and password (8+ chars) are required." });
        setSaving(false); return;
      }
      body.name = form.name; body.email = form.email; body.password = form.password;
    }

    try {
      const res = await fetch(`${API_BASE}/securegate/admins`, {
        method: "POST", headers: authHeaders(), body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: j?.message ?? "Failed to add admin." }); return; }
      setMsg({ ok: true, text: "Admin added." });
      setShowAdd(false); resetForm(); fetchAdmins();
    } catch { setMsg({ ok: false, text: "Error adding admin." }); }
    finally { setSaving(false); }
  };

  const openEdit = (a: AdminAccount) => {
    setEditForm({
      admin_role: a.admin_role,
      permissions: a.admin_permissions ?? [],
      status: a.status ?? "active",
    });
    setEditing(a);
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    setSaving(true); setMsg(null);
    const body: Record<string, unknown> = {
      admin_role: editForm.admin_role,
      status: editForm.status,
    };
    const perms = effectivePerms(editForm.admin_role, editForm.permissions);
    if (perms.length > 0) body.permissions = perms;

    try {
      const res = await fetch(`${API_BASE}/securegate/admins/${editing.id}`, {
        method: "PUT", headers: authHeaders(), body: JSON.stringify(body),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: j?.message ?? "Failed to update." }); return; }
      setMsg({ ok: true, text: "Admin updated." });
      setEditing(null); fetchAdmins();
    } catch { setMsg({ ok: false, text: "Error updating admin." }); }
    finally { setSaving(false); }
  };

  const handleRemove = async () => {
    if (!removing) return;
    setSubmittingRemove(true); setMsg(null);
    try {
      const res = await fetch(`${API_BASE}/securegate/admins/${removing.id}`, {
        method: "DELETE", headers: authHeaders(),
      });
      const j = await res.json().catch(() => ({}));
      if (!res.ok) { setMsg({ ok: false, text: j?.message ?? "Failed to remove admin." }); setRemoving(null); setSubmittingRemove(false); return; }
      setMsg({ ok: true, text: "Admin removed." });
      setRemoving(null); fetchAdmins();
    } catch { setMsg({ ok: false, text: "Error removing admin." }); setRemoving(null); }
    finally { setSubmittingRemove(false); }
  };

  const superAdminCount = admins.filter((a) => a.admin_role === "super_admin").length;
  const sectionAdminCount = admins.filter((a) => a.admin_role !== "super_admin").length;
  const suspendedCount = admins.filter((a) => a.status === "suspended").length;

  const roles = meta?.roles ?? {};

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-6 sm:p-8 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-lg">
        <div className="space-y-1.5">
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-[#38A8D8]/20 text-[#38A8D8] text-xs font-semibold uppercase tracking-wider border border-[#38A8D8]/30">
            <ShieldCheck className="h-3.5 w-3.5" /> Admin
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">Admin Management</h1>
          <p className="text-sm text-white/70 max-w-xl">Manage admin roles, permissions and access</p>
        </div>
        <Button
          onClick={() => { setShowAdd(!showAdd); setEditing(null); setMsg(null); resetForm(); }}
          className="bg-[#38A8D8] hover:bg-[#2d94c2] text-white font-bold"
        >
          <UserPlus className="h-4 w-4 mr-2" />{showAdd ? "Cancel" : "Add Admin"}
        </Button>
      </div>

      {msg && (
        <div className={`flex items-center gap-2 rounded-xl border px-4 py-3 text-xs font-semibold ${msg.ok ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400" : "border-rose-500/30 bg-rose-500/10 text-rose-400"}`}>
          {msg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          {msg.text}
          <button onClick={() => setMsg(null)} className="ml-auto text-current opacity-70 hover:opacity-100"><X className="h-4 w-4" /></button>
        </div>
      )}

      {fetchError && (
        <div className="flex items-center gap-2 rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-xs text-rose-400">
          <AlertCircle className="h-4 w-4 shrink-0" /> {fetchError}
          <button onClick={fetchAdmins} className="ml-auto text-rose-300 hover:text-rose-200 font-bold">Retry</button>
        </div>
      )}

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Total Admins", value: total, color: "text-[#38A8D8]" },
          { label: "Super Admins", value: superAdminCount, color: "text-violet-400" },
          { label: "Section Admins", value: sectionAdminCount, color: "text-sky-400" },
          { label: "Suspended", value: suspendedCount, color: "text-rose-400" },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-border bg-card p-4">
            <p className={`text-2xl font-black ${s.color}`}>{s.value}</p>
            <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {showAdd && (
        <form onSubmit={handleAdd} className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-extrabold flex items-center gap-2"><Shield className="h-5 w-5 text-[#38A8D8]" /> Add Admin</h2>
              <p className="text-xs text-muted-foreground">Grant a staff member admin access with a role and permissions.</p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button type="button" onClick={() => setAddMode("existing")} className={`rounded-xl border p-3 text-left text-xs font-bold transition ${addMode === "existing" ? "border-[#38A8D8] bg-[#38A8D8]/10 text-[#38A8D8]" : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/40"}`}>
              Promote existing user
              <span className="block text-[10px] font-medium opacity-70 mt-0.5">Pick an account already on the platform</span>
            </button>
            <button type="button" onClick={() => setAddMode("new")} className={`rounded-xl border p-3 text-left text-xs font-bold transition ${addMode === "new" ? "border-[#38A8D8] bg-[#38A8D8]/10 text-[#38A8D8]" : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/40"}`}>
              Create new admin
              <span className="block text-[10px] font-medium opacity-70 mt-0.5">Set up a fresh staff account with credentials</span>
            </button>
            <div className="hidden sm:block" />
          </div>

          {addMode === "existing" ? (
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">User ID</Label>
              <Input
                type="number" min="1" placeholder="e.g. 79" value={form.user_id}
                onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              />
              <p className="text-[10px] text-muted-foreground">Enter the ID of the user to promote to admin. Find IDs in All Users.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Full Name</Label><Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Jane Doe" /></div>
              <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Email</Label><Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="jane@murihspace.com" /></div>
              <div className="space-y-2"><Label className="text-xs font-bold text-muted-foreground">Password (8+ chars)</Label><Input type="password" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="••••••••" /></div>
            </div>
          )}

          <div className="space-y-2">
            <Label className="text-xs font-bold text-muted-foreground">Admin Role</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {Object.entries(roles).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setForm({ ...form, admin_role: key, permissions: key === "super_admin" ? [] : form.permissions })}
                  className={`rounded-xl border px-3 py-2.5 text-left transition ${form.admin_role === key ? "border-[#38A8D8] bg-[#38A8D8]/10 text-[#38A8D8]" : "border-border bg-muted/30 text-foreground hover:border-muted-foreground/40"}`}
                >
                  <span className="text-xs font-bold block">{label as string}</span>
                  {key === "super_admin" && <span className="text-[9px] font-medium opacity-70">All permissions</span>}
                </button>
              ))}
            </div>
          </div>

          {form.admin_role !== "super_admin" && (
            <div className="space-y-2">
              <Label className="text-xs font-bold text-muted-foreground">Permissions</Label>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {Object.entries(meta?.permissions ?? {}).map(([key, label]) => (
                  <button
                    key={key}
                    type="button"
                    onClick={() => togglePerm(key, (p) => setForm({ ...form, permissions: p }), form.permissions)}
                    className={`rounded-lg border px-3 py-2 text-[11px] font-semibold text-left transition ${form.permissions.includes(key) ? "border-[#38A8D8] bg-[#38A8D8]/10 text-[#38A8D8]" : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/40"}`}
                  >
                    {label as string}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={saving} className="bg-[#38A8D8] hover:bg-[#2d94c2] text-white font-bold text-sm">
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <UserPlus className="h-4 w-4" />} Add Admin
            </Button>
            <Button type="button" variant="outline" onClick={() => { setShowAdd(false); resetForm(); }}>Cancel</Button>
          </div>
        </form>
      )}

      <div className="rounded-2xl border border-border bg-card overflow-hidden">
        <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(1); }}
              placeholder="Search by name, email or username..."
              className="pl-9 h-9 text-xs"
            />
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-[#38A8D8]" /></div>
        ) : admins.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Shield className="h-8 w-8 text-muted-foreground/40 mb-2" />
            <p className="text-sm font-semibold text-muted-foreground">No admins found</p>
            <p className="text-xs text-muted-foreground/70 mt-0.5">Try adjusting your search or add a new admin.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-[10px] uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-bold">Admin</th>
                  <th className="px-4 py-3 font-bold">Role</th>
                  <th className="px-4 py-3 font-bold">Permissions</th>
                  <th className="px-4 py-3 font-bold">Status</th>
                  <th className="px-4 py-3 font-bold">Joined</th>
                  <th className="px-4 py-3 font-bold text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <tr key={a.id} className="border-b border-border/60 last:border-0 hover:bg-muted/30 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#38A8D8] to-purple-600 p-[2px] shrink-0">
                          <div className="w-full h-full rounded-full bg-card flex items-center justify-center text-xs font-black text-[#1a2e3b]">
                            {a.name?.charAt(0)?.toUpperCase() ?? "?"}
                          </div>
                        </div>
                        <div className="min-w-0">
                          <p className="font-bold text-foreground truncate">{a.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">@{a.username} · {a.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-bold ${ROLE_STYLES[a.admin_role] ?? "bg-muted text-muted-foreground"}`}>
                        {roles[a.admin_role] ?? a.admin_role}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1 max-w-[220px]">
                        {(a.admin_permissions ?? []).length === 0 ? (
                          <span className="text-[10px] text-muted-foreground/60">None</span>
                        ) : (
                          (a.admin_permissions ?? []).map((p) => (
                            <span key={p} className={`px-1.5 py-0.5 rounded text-[9px] font-bold ${PERM_LABELS[p]?.color ?? "bg-muted text-muted-foreground"}`}>
                              {PERM_LABELS[p]?.short ?? p}
                            </span>
                          ))
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${a.status === "suspended" ? "bg-amber-500/20 text-amber-400" : "bg-emerald-500/20 text-emerald-400"}`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {a.created_at ? new Date(a.created_at).toLocaleDateString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="sm" onClick={() => openEdit(a)} title="Edit role & permissions" className="h-7 px-2 text-muted-foreground hover:text-foreground">
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button variant="ghost" size="sm" onClick={() => setRemoving(a)} title="Remove admin" className="h-7 px-2 text-muted-foreground hover:text-rose-500">
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {lastPage > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-border">
            <p className="text-xs text-muted-foreground">Page {page} of {lastPage}</p>
            <div className="flex gap-1">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}><ChevronLeft className="h-3.5 w-3.5" /></Button>
              <Button variant="outline" size="sm" disabled={page >= lastPage} onClick={() => setPage(page + 1)}><ChevronRight className="h-3.5 w-3.5" /></Button>
            </div>
          </div>
        )}
      </div>

      <Dialog open={!!editing} onOpenChange={(o) => { if (!o) { setEditing(null); setMsg(null); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><ShieldCheck className="h-5 w-5 text-[#38A8D8]" /> Edit Admin</DialogTitle>
            <DialogDescription>
              Update role and permissions for <span className="font-bold text-foreground">{editing?.name}</span>
            </DialogDescription>
          </DialogHeader>
          {editing && (
            <form onSubmit={handleUpdate} className="space-y-5">
              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground">Admin Role</Label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {Object.entries(roles).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, admin_role: key, permissions: key === "super_admin" ? [] : editForm.permissions })}
                      className={`rounded-xl border px-3 py-2.5 text-left transition ${editForm.admin_role === key ? "border-[#38A8D8] bg-[#38A8D8]/10 text-[#38A8D8]" : "border-border bg-muted/30 text-foreground hover:border-muted-foreground/40"}`}
                    >
                      <span className="text-xs font-bold block">{label as string}</span>
                      {key === "super_admin" && <span className="text-[9px] font-medium opacity-70">All permissions</span>}
                    </button>
                  ))}
                </div>
              </div>

              {editForm.admin_role !== "super_admin" && (
                <div className="space-y-2">
                  <Label className="text-xs font-bold text-muted-foreground">Permissions</Label>
                  <div className="grid grid-cols-2 gap-2">
                    {Object.entries(meta?.permissions ?? {}).map(([key, label]) => (
                      <button
                        key={key}
                        type="button"
                        onClick={() => togglePerm(key, (p) => setEditForm({ ...editForm, permissions: p }), editForm.permissions)}
                        className={`rounded-lg border px-3 py-2 text-[11px] font-semibold text-left transition ${editForm.permissions.includes(key) ? "border-[#38A8D8] bg-[#38A8D8]/10 text-[#38A8D8]" : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/40"}`}
                      >
                        {label as string}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-2">
                <Label className="text-xs font-bold text-muted-foreground">Status</Label>
                <div className="grid grid-cols-2 gap-2">
                  {["active", "suspended"].map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => setEditForm({ ...editForm, status: s })}
                      className={`rounded-xl border px-3 py-2.5 text-xs font-bold text-left capitalize transition ${editForm.status === s ? "border-[#38A8D8] bg-[#38A8D8]/10 text-[#38A8D8]" : "border-border bg-muted/30 text-muted-foreground hover:border-muted-foreground/40"}`}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button type="submit" disabled={saving} className="bg-[#38A8D8] hover:bg-[#2d94c2] text-white font-bold text-sm">
                  {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Save Changes
                </Button>
                <Button type="button" variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              </div>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!removing} onOpenChange={(o) => { if (!o) setRemoving(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Trash2 className="h-5 w-5 text-rose-500" /> Remove Admin</DialogTitle>
            <DialogDescription>
              Remove <span className="font-bold text-foreground">{removing?.name}</span> from admin? They will be downgraded to a regular member account.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2">
            <Button onClick={handleRemove} disabled={submittingRemove} variant="destructive" className="font-bold text-sm">
              {submittingRemove ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} Remove Admin
            </Button>
            <Button variant="outline" onClick={() => setRemoving(null)}>Cancel</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminManagementPage;
