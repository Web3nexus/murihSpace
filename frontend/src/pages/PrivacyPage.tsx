import { useState } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  Globe,
  Users,
  Download,
  Trash2,
  Check,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";

export default function PrivacyPage() {
  const [profileVisibility, setProfileVisibility] = useState<"public" | "members" | "private">("public");
  const [showEmail, setShowEmail] = useState(false);
  const [showDonations, setShowDonations] = useState(true);
  const [allowTagging, setAllowTagging] = useState(true);
  const [dataDownloading, setDataDownloading] = useState(false);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deleteText, setDeleteText] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await apiClient.put("/settings/privacy", {
        profile_visibility: profileVisibility,
        show_email: showEmail,
        show_donations: showDonations,
        allow_tagging: allowTagging,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch {
      // backend not ready
    } finally {
      setSaving(false);
    }
  };

  const handleDownloadData = async () => {
    setDataDownloading(true);
    setDownloadMsg(null);
    try {
      const res = await apiClient.post("/account/export", {}, { responseType: "blob" });
      const url = URL.createObjectURL(new Blob([res.data]));
      const a = document.createElement("a");
      a.href = url;
      a.download = "murihspace-data-export.zip";
      a.click();
      URL.revokeObjectURL(url);
      setDownloadMsg("Data export downloaded.");
    } catch {
      setDownloadMsg("Data export is not available yet.");
    } finally {
      setDataDownloading(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await apiClient.delete("/account", { data: { confirmation: deleteText } });
      localStorage.clear();
      window.location.href = "/login";
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6 w-full max-w-3xl mx-auto">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <Lock className="h-5 w-5 text-secondary" />
          Privacy & Visibility
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Control who can see your profile and how your data is used.
        </p>
      </div>

      {/* ── Profile Visibility ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
          <Eye className="h-3.5 w-3.5 text-secondary" /> Profile Visibility
        </h3>
        <div className="space-y-2">
          {[
            { value: "public" as const, icon: Globe, label: "Public", desc: "Anyone on MurihSpace can see your profile" },
            { value: "members" as const, icon: Users, label: "Members Only", desc: "Only logged-in members can see your profile" },
            { value: "private" as const, icon: EyeOff, label: "Private", desc: "Your profile is hidden from everyone except followers" },
          ].map((opt) => {
            const active = profileVisibility === opt.value;
            const Icon = opt.icon;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setProfileVisibility(opt.value)}
                className={`w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                  active ? "border-secondary bg-secondary/5" : "border-border bg-muted/30 hover:border-muted-foreground/30"
                }`}
              >
                <Icon className={`h-5 w-5 shrink-0 ${active ? "text-secondary" : "text-muted-foreground"}`} />
                <div className="flex-1">
                  <p className="text-xs font-bold text-foreground">{opt.label}</p>
                  <p className="text-[10px] text-muted-foreground">{opt.desc}</p>
                </div>
                <div className={`h-4 w-4 rounded-full border-2 ${active ? "border-secondary" : "border-muted-foreground/30"} flex items-center justify-center`}>
                  {active && <div className="h-2 w-2 rounded-full bg-secondary" />}
                </div>
              </button>
            );
          })}
        </div>
      </section>

      {/* ── Privacy Toggles ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
          <Users className="h-3.5 w-3.5 text-secondary" /> Profile Preferences
        </h3>
        <div className="space-y-2">
          {[
            { key: "email", label: "Show Email on Profile", desc: "Display your email address publicly on your profile page.", val: showEmail, set: setShowEmail },
            { key: "donations", label: "Show Donation & Tip Stats", desc: "Display your total received tips and donations on your profile.", val: showDonations, set: setShowDonations },
            { key: "tagging", label: "Allow Tagging", desc: "Allow other members to tag you in posts and comments.", val: allowTagging, set: setAllowTagging },
          ].map((item) => (
            <label key={item.key} className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30 cursor-pointer hover:border-muted-foreground/30 transition-all">
              <div className="space-y-0.5">
                <p className="text-xs font-bold text-foreground">{item.label}</p>
                <p className="text-[10px] text-muted-foreground">{item.desc}</p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={item.val}
                onClick={() => item.set(!item.val)}
                className={`relative h-6 w-11 rounded-full p-0.5 transition-colors shrink-0 ${item.val ? "bg-secondary" : "bg-muted-foreground/30"}`}
              >
                <div className={`h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${item.val ? "translate-x-5" : "translate-x-0"}`} />
              </button>
            </label>
          ))}
        </div>
      </section>

      {/* ── Data & Account ── */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
        <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
          <Download className="h-3.5 w-3.5 text-secondary" /> Data & Account
        </h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-foreground">Download My Data</p>
              <p className="text-[10px] text-muted-foreground">Export all your data including posts, messages, and account info.</p>
            </div>
            <button
              type="button"
              onClick={handleDownloadData}
              disabled={dataDownloading}
              className="px-4 py-2 rounded-xl border border-border text-xs font-bold text-foreground hover:bg-muted transition-all disabled:opacity-50"
            >
              {dataDownloading ? "Exporting..." : "Export"}
            </button>
          </div>
          {downloadMsg && (
            <p className="text-xs text-emerald-500 flex items-center gap-1"><Check className="h-3 w-3" />{downloadMsg}</p>
          )}

          <div className="flex items-center justify-between p-3 rounded-xl border border-red-500/20 bg-red-500/5">
            <div className="space-y-0.5">
              <p className="text-xs font-bold text-red-600 flex items-center gap-1.5">
                <Trash2 className="h-3.5 w-3.5" /> Delete Account
              </p>
              <p className="text-[10px] text-muted-foreground">Permanently delete your account and all associated data. This action cannot be undone.</p>
            </div>
            <button
              type="button"
              onClick={() => setDeleteConfirm(!deleteConfirm)}
              className="px-4 py-2 rounded-xl bg-red-500/10 text-red-600 text-xs font-bold hover:bg-red-500/20 transition-all"
            >
              Delete
            </button>
          </div>

          {deleteConfirm && (
            <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/5 space-y-3">
              <p className="text-xs font-bold text-red-600">Type <span className="font-mono bg-red-500/10 px-1 rounded">DELETE</span> to confirm</p>
              <input
                type="text"
                value={deleteText}
                onChange={(e) => setDeleteText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full rounded-xl border border-red-500/30 bg-card px-3 py-2 text-xs text-foreground focus:outline-none focus:border-red-500"
              />
              <button
                type="button"
                onClick={handleDeleteAccount}
                disabled={deleteText !== "DELETE"}
                className="px-5 py-2 rounded-xl bg-red-600 text-white text-xs font-bold hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                Permanently Delete My Account
              </button>
            </div>
          )}
        </div>
      </section>

      {/* ── Save ── */}
      <div className="flex items-center justify-end gap-3">
        {saved && (
          <span className="text-xs font-semibold text-emerald-500 flex items-center gap-1">
            <Check className="h-4 w-4" /> Privacy settings saved!
          </span>
        )}
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-6 py-2 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 disabled:opacity-50 transition-all shadow-xs"
        >
          {saving ? "Saving..." : "Save Preferences"}
        </button>
      </div>
    </div>
  );
}
