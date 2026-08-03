import { useState, useEffect } from "react";
import {
  Share2Icon,
  PlusIcon,
  Trash2Icon,
  RefreshCwIcon,
  SparklesIcon,
  ExternalLinkIcon,
  BadgeCheckIcon,
} from "lucide-react";
import { Link } from "react-router";
import { toast } from "sonner";

interface SocialAccount {
  id: number;
  provider: string;
  username: string | null;
  profile_url: string | null;
  follower_count: number | null;
  following_count: number | null;
  verified_on_provider: boolean;
  count_is_self_reported: boolean;
  sync_status: string;
  connected_at: string | null;
  last_synced_at: string | null;
}

interface FollowerSummary {
  combined_followers: number;
  provider_breakdown: Record<string, number>;
  account_count: number;
  threshold: number;
  meets_threshold: boolean;
}

interface ProviderOption {
  provider: string;
  label: string;
  enabled: boolean;
}

export default function ConnectedAccountsPage() {
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [summary, setSummary] = useState<FollowerSummary | null>(null);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);

  // Manual connect form
  const [selectedProvider, setSelectedProvider] = useState("instagram");
  const [username, setUsername] = useState("");
  const [profileUrl, setProfileUrl] = useState("");
  const [followerCount, setFollowerCount] = useState<number | "">("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [accRes, sumRes, provRes] = await Promise.all([
        fetch("/api/v1/social-accounts", { headers: { Accept: "application/json" } }),
        fetch("/api/v1/social-accounts/follower-summary", { headers: { Accept: "application/json" } }),
        fetch("/api/v1/social-accounts/supported-providers", { headers: { Accept: "application/json" } }),
      ]);

      if (accRes.ok) {
        const d = await accRes.json();
        setAccounts(d.data?.data || d.data || []);
      }
      if (sumRes.ok) {
        const d = await sumRes.json();
        setSummary(d.data?.data || d.data || null);
      }
      if (provRes.ok) {
        const d = await provRes.json();
        setProviders(d.data?.data || d.data || []);
      }
    } catch (e) {
      toast.error("Failed to load connected accounts data.");
    } finally {
      setLoading(false);
    }
  };

  const handleManualConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || followerCount === "") {
      toast.error("Please enter a username and follower count.");
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch("/api/v1/social-accounts/manual", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({
          provider: selectedProvider,
          username: username.trim(),
          profile_url: profileUrl.trim() || undefined,
          follower_count: Number(followerCount),
        }),
      });

      if (res.ok) {
        toast.success("Social account connected!");
        setModalOpen(false);
        setUsername("");
        setProfileUrl("");
        setFollowerCount("");
        fetchData();
      } else {
        const err = await res.json();
        toast.error(err.message || "Failed to connect account.");
      }
    } catch (e) {
      toast.error("Connection error.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDisconnect = async (id: number) => {
    if (!confirm("Are you sure you want to disconnect this social account?")) return;

    try {
      const res = await fetch(`/api/v1/social-accounts/${id}`, {
        method: "DELETE",
        headers: { Accept: "application/json" },
      });

      if (res.ok) {
        toast.success("Account disconnected.");
        fetchData();
      } else {
        toast.error("Failed to disconnect account.");
      }
    } catch (e) {
      toast.error("Network error.");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCwIcon className="h-6 w-6 animate-spin mr-2" /> Loading connected accounts...
      </div>
    );
  }

  const threshold = summary?.threshold || 10000;
  const combined = summary?.combined_followers || 0;
  const progressPercent = Math.min(100, Math.round((combined / threshold) * 100));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold tracking-tight">Connected Social Accounts</h2>
          <p className="text-sm text-muted-foreground">
            Connect your social channels to display follower credentials and qualify for Creator benefits.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-medium text-sm rounded-lg hover:opacity-90 transition"
        >
          <PlusIcon className="h-4 w-4" /> Add Social Account
        </button>
      </div>

      {/* Creator Threshold Qualification Banner */}
      <div className="p-6 rounded-xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-transparent relative overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-foreground">Combined Creator Qualification</h3>
            </div>
            <p className="text-sm text-muted-foreground mt-1">
              Combine followers across all connected social channels to reach the{" "}
              <strong className="text-foreground">{threshold.toLocaleString()}</strong> threshold.
            </p>
          </div>
          {summary?.meets_threshold ? (
            <Link
              to="/app/settings/upgrade"
              className="inline-flex items-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-sm rounded-lg transition shrink-0"
            >
              <BadgeCheckIcon className="h-4 w-4" /> Apply as Creator
            </Link>
          ) : (
            <span className="text-xs font-semibold px-3 py-1 bg-secondary text-secondary-foreground rounded-full shrink-0">
              {combined.toLocaleString()} / {threshold.toLocaleString()} followers
            </span>
          )}
        </div>

        {/* Progress bar */}
        <div className="mt-4 w-full bg-secondary/50 h-2.5 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              summary?.meets_threshold ? "bg-emerald-500" : "bg-primary"
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-muted-foreground mt-1.5">
          <span>{progressPercent}% towards Creator threshold</span>
          <span>{threshold.toLocaleString()} needed</span>
        </div>
      </div>

      {/* Accounts List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {accounts.length === 0 ? (
          <div className="col-span-2 p-8 text-center border border-dashed rounded-xl text-muted-foreground">
            <Share2Icon className="h-10 w-10 mx-auto mb-2 opacity-50" />
            <p className="font-medium">No social accounts connected yet</p>
            <p className="text-sm mt-1">Click "Add Social Account" above to link your channels.</p>
          </div>
        ) : (
          accounts.map((acc) => (
            <div
              key={acc.id}
              className="p-5 rounded-xl border border-border bg-card flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-primary capitalize">
                  {acc.provider.substring(0, 2)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground capitalize">{acc.provider}</span>
                    {acc.verified_on_provider && (
                      <span title="Verified profile">
                        <BadgeCheckIcon className="h-4 w-4 text-sky-500 fill-sky-500/20" />
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">@{acc.username || "unnamed"}</p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">
                      {(acc.follower_count || 0).toLocaleString()} followers
                    </span>
                    {acc.count_is_self_reported && (
                      <span className="px-1.5 py-0.5 bg-muted rounded text-[10px]">Self-reported</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                {acc.profile_url && (
                  <a
                    href={acc.profile_url}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2 text-muted-foreground hover:text-foreground rounded-lg border border-transparent hover:border-border transition"
                  >
                    <ExternalLinkIcon className="h-4 w-4" />
                  </a>
                )}
                <button
                  onClick={() => handleDisconnect(acc.id)}
                  className="p-2 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded-lg transition"
                  title="Disconnect"
                >
                  <Trash2Icon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Manual Connect Modal */}
      {modalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border border-border w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex justify-between items-center">
              <h3 className="text-lg font-bold">Connect Social Account</h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-muted-foreground hover:text-foreground text-sm"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleManualConnect} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Platform</label>
                <select
                  value={selectedProvider}
                  onChange={(e) => setSelectedProvider(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                >
                  {providers.map((p) => (
                    <option key={p.provider} value={p.provider}>
                      {p.label} {!p.enabled ? "(Disabled by Admin)" : ""}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Username / Handle</label>
                <input
                  type="text"
                  placeholder="e.g. johndoe_official"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Follower Count</label>
                <input
                  type="number"
                  placeholder="e.g. 5000"
                  value={followerCount}
                  onChange={(e) => setFollowerCount(e.target.value ? Number(e.target.value) : "")}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                  min="0"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Profile Link (optional)</label>
                <input
                  type="url"
                  placeholder="https://instagram.com/johndoe_official"
                  value={profileUrl}
                  onChange={(e) => setProfileUrl(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-4 py-2 bg-primary text-primary-foreground text-sm font-medium rounded-lg hover:opacity-90 transition disabled:opacity-50"
                >
                  {submitting ? "Connecting..." : "Save Account"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
