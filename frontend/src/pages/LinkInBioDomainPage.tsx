import { useState, useEffect, useCallback } from "react";
import { Globe, Loader2, ExternalLink, CheckCircle2, XCircle, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { authFetch } from "@/lib/api/authFetch";





export default function LinkInBioDomainPage() {
  const [domain, setDomain] = useState("");
  const [saving, setSaving] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [verified, setVerified] = useState<boolean | null>(null);
  const [verifiedAt, setVerifiedAt] = useState<string | null>(null);
  const [currentDomain, setCurrentDomain] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      await authFetch(`/link-in-bio/design`, {  });
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { loadStatus(); }, [loadStatus]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!domain.trim()) return;
    setSaving(true);
    setMsg(null);
    setVerified(null);
    try {
      const res = await authFetch(`/link-in-bio/domain`, {
        method: "PUT", 
        body: JSON.stringify({ domain: domain.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j?.message ?? "Save failed");
      setCurrentDomain(domain.trim());
      setMsg({ ok: true, text: "Domain saved. Click \"Verify DNS\" below to confirm your DNS setup." });
    } catch (e) {
      setMsg({ ok: false, text: e instanceof Error ? e.message : "Save failed" });
    } finally { setSaving(false); }
  };

  const handleVerify = async () => {
    setVerifying(true);
    setMsg(null);
    try {
      const res = await authFetch(`/link-in-bio/domain/verify`, {
        method: "POST", 
      });
      const j = await res.json();
      const d = j?.success ? j?.data : j;
      if (res.ok) {
        setVerified(d.verified);
        setVerifiedAt(d.verified_at);
        if (d.verified) {
          setMsg({ ok: true, text: "Domain verified! Your DNS is properly configured." });
        } else {
          setMsg({ ok: false, text: "DNS check failed. Make sure your CNAME record points to link.murihspace.com and try again." });
        }
      } else {
        setMsg({ ok: false, text: d?.message ?? "Verification failed." });
      }
    } catch {
      setMsg({ ok: false, text: "Network error during verification." });
    } finally { setVerifying(false); }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 p-6 lg:p-8">
      <div>
        <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
          <Globe className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" /> Custom Domain
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Connect your own domain (e.g. yourname.com).</p>
      </div>

      {verified === true && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/5 p-5 flex items-center gap-3">
          <CheckCircle2 className="h-8 w-8 text-emerald-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-emerald-500">Domain Verified</p>
            <p className="text-xs text-muted-foreground">
              {currentDomain} &middot; Verified {verifiedAt ? new Date(verifiedAt).toLocaleDateString() : ""}
            </p>
          </div>
        </div>
      )}

      {verified === false && (
        <div className="rounded-2xl border border-rose-500/20 bg-rose-500/5 p-5 flex items-center gap-3">
          <XCircle className="h-8 w-8 text-rose-500 shrink-0" />
          <div>
            <p className="text-sm font-bold text-rose-500">DNS Not Configured</p>
            <p className="text-xs text-muted-foreground">Add a CNAME record pointing to link.murihspace.com</p>
          </div>
        </div>
      )}

      <div className="border border-border rounded-2xl bg-card p-6 space-y-4">
        <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs">
          <p className="font-bold text-amber-400">How it works</p>
          <p className="mt-1 text-muted-foreground">
            Enter your domain below, then add a CNAME record pointing to{" "}
            <code className="text-foreground font-mono">link.murihspace.com</code> in your DNS settings.
            Once configured, click "Verify DNS" to confirm.
          </p>
        </div>

        <form onSubmit={handleSave} className="space-y-4">
          {msg && (
            <div className={`p-3 rounded-xl text-xs font-bold border ${
              msg.ok ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/20" : "bg-rose-500/10 text-rose-400 border-rose-500/20"
            }`}>{msg.text}</div>
          )}
          <div className="space-y-2">
            <label className="text-xs font-bold text-muted-foreground">Your Domain</label>
            <div className="flex gap-2">
              <Input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="yourname.com" className="flex-1 font-mono text-sm" />
              <Button type="submit" disabled={saving || !domain.trim()} className="text-sm font-bold shrink-0">
                {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}Save
              </Button>
            </div>
          </div>
        </form>
      </div>

      <div className="border border-border rounded-2xl bg-card p-6 space-y-3">
        <h2 className="text-xs font-bold text-muted-foreground uppercase tracking-wider">DNS Configuration</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="text-left border-b border-border">
                <th className="pb-2 font-bold text-muted-foreground">Type</th>
                <th className="pb-2 font-bold text-muted-foreground">Name</th>
                <th className="pb-2 font-bold text-muted-foreground">Value</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-border/50">
                <td className="py-2 font-mono font-bold text-foreground">CNAME</td>
                <td className="py-2 font-mono text-muted-foreground">@</td>
                <td className="py-2 font-mono text-[#2164b6] dark:text-[#7ab0ff]">link.murihspace.com</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between">
          <a href="https://docs.murihspace.com/custom-domains" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-[#2164b6] dark:text-[#7ab0ff] font-bold hover:underline">
            <ExternalLink className="h-3 w-3" /> View full setup guide
          </a>
          <Button
            variant="outline"
            size="sm"
            onClick={handleVerify}
            disabled={verifying || !currentDomain}
            className="gap-1.5 text-xs"
          >
            {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
            Verify DNS
          </Button>
        </div>
      </div>
    </div>
  );
}
