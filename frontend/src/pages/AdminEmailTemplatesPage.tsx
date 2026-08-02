import { useEffect, useMemo, useState } from "react";
import { Mail, Loader2, Save, RotateCcw, CheckCircle2, AlertCircle, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api/v1";

interface EmailTemplate {
  id: number;
  key: string;
  name: string;
  description: string | null;
  subject: string;
  body_html: string;
  is_active: boolean;
}

function authHeaders() {
  const t = getAuthToken();
  return { Accept: "application/json", "Content-Type": "application/json", ...(t ? { Authorization: `Bearer ${t}` } : {}) };
}

function unwrap<T>(j: unknown): T {
  const d = (j as { success?: boolean; data?: unknown }) ?? {};
  if (d.success) {
    const inner = d.data as { data?: T };
    return (inner?.data ?? d.data) as T;
  }
  return d as unknown as T;
}

export default function AdminEmailTemplatesPage() {
  const [templates, setTemplates] = useState<EmailTemplate[]>([]);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [draft, setDraft] = useState<EmailTemplate | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState<string | null>(null);

  const load = async () => {
    try {
      const res = await fetch(`${API_BASE}/securegate/email-templates`, { headers: authHeaders() });
      if (!res.ok) throw new Error("Failed to load email templates");
      const j = await res.json();
      const list = unwrap<EmailTemplate[]>(j);
      setTemplates(list);
      if (!selectedKey && list.length) setSelectedKey(list[0].key);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = useMemo(() => templates.find((t) => t.key === selectedKey) ?? null, [templates, selectedKey]);

  useEffect(() => {
    if (selected) setDraft({ ...selected });
  }, [selected]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return templates;
    return templates.filter((t) => `${t.name} ${t.key} ${t.description ?? ""}`.toLowerCase().includes(q));
  }, [templates, query]);

  const save = async () => {
    if (!draft || !selectedKey) return;
    setSaving(true);
    try {
      const res = await fetch(`${API_BASE}/securegate/email-templates/${selectedKey}`, {
        method: "PUT",
        headers: authHeaders(),
        body: JSON.stringify({
          name: draft.name,
          description: draft.description,
          subject: draft.subject,
          body_html: draft.body_html,
          is_active: draft.is_active,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      const updated = unwrap<EmailTemplate>(j);
      setTemplates((prev) => prev.map((t) => (t.key === updated.key ? updated : t)));
      toast.success("Email template saved.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const reset = async (key: string) => {
    setResetting(key);
    try {
      const res = await fetch(`${API_BASE}/securegate/email-templates/${key}/reset`, {
        method: "POST",
        headers: authHeaders(),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Reset failed");
      const updated = unwrap<EmailTemplate>(j);
      setTemplates((prev) => prev.map((t) => (t.key === updated.key ? updated : t)));
      toast.success("Email template reset to default.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Reset failed");
    } finally {
      setResetting(null);
    }
  };

  if (loading) {
    return <div className="flex justify-center py-24"><Loader2 className="h-8 w-8 animate-spin text-[#38A8D8]" /></div>;
  }

  return (
    <div className="w-full mx-auto max-w-[980px] space-y-6 p-6 lg:p-10">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <Mail className="h-6 w-6 text-[#38A8D8]" /> Email Templates
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Customise the transactional emails sent to members. Placeholders like {"{{name}}"}, {"{{action_label}}"} and {"{{action_url}}"} are always available; others ({"{{currency}}"}, {"{{amount}}"}, {"{{reason}}"}, {"{{role}}"}) depend on the email type.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-[280px_1fr] gap-5 items-start">
        {/* Template list */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search templates…"
              className="pl-9"
            />
          </div>
          <div className="max-h-[60vh] overflow-y-auto space-y-1.5 pr-1">
            {filtered.map((t) => {
              const active = t.key === selectedKey;
              return (
                <button
                  key={t.key}
                  onClick={() => setSelectedKey(t.key)}
                  className={cn(
                    "w-full text-left rounded-xl border px-3 py-2.5 transition-all",
                    active ? "border-[#38A8D8] bg-[#38A8D8]/5 ring-1 ring-[#38A8D8]/20" : "border-border bg-card hover:border-[#38A8D8]/40"
                  )}
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[13px] font-bold text-foreground truncate">{t.name}</p>
                    <span
                      className={cn(
                        "h-1.5 w-1.5 shrink-0 rounded-full",
                        t.is_active ? "bg-emerald-500" : "bg-muted-foreground/40"
                      )}
                    />
                  </div>
                  <p className="text-[10px] font-mono text-muted-foreground mt-0.5">{t.key}</p>
                </button>
              );
            })}
            {filtered.length === 0 && (
              <p className="text-xs text-muted-foreground py-6 text-center">No templates match.</p>
            )}
          </div>
        </div>

        {/* Editor */}
        {draft && (
          <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-black text-foreground">{draft.name}</p>
                <p className="text-[11px] font-mono text-[#38A8D8]">{draft.key}</p>
                {draft.description && (
                  <p className="text-[11px] text-muted-foreground mt-1 leading-relaxed">{draft.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-muted-foreground">Active</label>
                <Switch
                  checked={draft.is_active}
                  onCheckedChange={(v) => setDraft({ ...draft, is_active: v })}
                />
              </div>
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted-foreground">Subject</label>
              <Input
                value={draft.subject ?? ""}
                onChange={(e) => setDraft({ ...draft, subject: e.target.value })}
                placeholder="Email subject line"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-[11px] font-bold text-muted-foreground">Body (HTML)</label>
              <Textarea
                value={draft.body_html ?? ""}
                onChange={(e) => setDraft({ ...draft, body_html: e.target.value })}
                placeholder="<p>Hello {{name}},</p>"
                rows={12}
                className="mt-1 font-mono text-[12px] leading-relaxed"
              />
              <p className="text-[10px] text-muted-foreground mt-1.5">
                Available placeholders: <code className="text-[#38A8D8]">{"{{name}}"}</code>, <code className="text-[#38A8D8]">{"{{action_label}}"}</code>, <code className="text-[#38A8D8]">{"{{action_url}}"}</code>, <code className="text-[#38A8D8]">{"{{footnote}}"}</code> and type-specific ones (<code className="text-[#38A8D8]">{"{{currency}}"}</code>, <code className="text-[#38A8D8]">{"{{amount}}"}</code>, <code className="text-[#38A8D8]">{"{{reason}}"}</code>, <code className="text-[#38A8D8]">{"{{role}}"}</code>).
              </p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              <Button onClick={save} disabled={saving} className="text-sm font-bold gap-1.5">
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                Save template
              </Button>
              <Button
                variant="outline"
                onClick={() => reset(draft.key)}
                disabled={resetting === draft.key}
                className="text-sm font-bold gap-1.5"
              >
                {resetting === draft.key ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
                Reset to default
              </Button>
              {draft.is_active ? (
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <CheckCircle2 className="h-3.5 w-3.5" /> Live — used for outgoing email
                </span>
              ) : (
                <span className="text-[11px] font-semibold text-muted-foreground flex items-center gap-1">
                  <AlertCircle className="h-3.5 w-3.5" /> Inactive — system defaults are used
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
