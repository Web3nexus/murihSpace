import { useState, useEffect } from "react";
import {
  SparklesIcon,
  SaveIcon,
  RefreshCwIcon,
  MailIcon,
  CheckCircle2Icon,
  SlidersIcon,
  ClockIcon,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api/client";

interface QualificationSettings {
  enabled: boolean;
  follower_threshold: number;
  delay_amount: number;
  delay_unit: string;
  enabled_providers: string[];
  min_connected_accounts: number;
  combine_counts: boolean;
  email_enabled: boolean;
  email_subject: string;
  email_content: string;
  reminder_enabled: boolean;
  reminder_delay_hours: number;
  auto_expiry_hours: number;
}

const ALL_PROVIDERS = [
  { id: "instagram", label: "Instagram" },
  { id: "tiktok", label: "TikTok" },
  { id: "youtube", label: "YouTube" },
  { id: "facebook", label: "Facebook" },
  { id: "x", label: "X (Twitter)" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "twitch", label: "Twitch" },
];

export default function AdminCreatorQualificationPage() {
  const [settings, setSettings] = useState<QualificationSettings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      // Use the shared apiClient so Authorization header and base URL are set correctly.
      const res = await apiClient.get("/securegate/creator-qualification/settings");
      const d = res.data;
      const raw = d.data?.data || d.data || {};
      setSettings({
        enabled:                raw.enabled === undefined ? true : Boolean(Number(raw.enabled)),
        follower_threshold:     Number(raw.follower_threshold ?? 10000),
        delay_amount:           Number(raw.delay_amount ?? 24),
        delay_unit:             raw.delay_unit || "hours",
        enabled_providers:      Array.isArray(raw.enabled_providers) ? raw.enabled_providers : ALL_PROVIDERS.map(p => p.id),
        min_connected_accounts: Number(raw.min_connected_accounts ?? 1),
        combine_counts:         raw.combine_counts === undefined ? true : Boolean(Number(raw.combine_counts)),
        email_enabled:          raw.email_enabled === undefined ? true : Boolean(Number(raw.email_enabled)),
        email_subject:          raw.email_subject || "You may qualify as a MurihSpace Creator!",
        email_content:          raw.email_content || "Congratulations! Your combined social following has reached our creator threshold.",
        reminder_enabled:       raw.reminder_enabled === undefined ? false : Boolean(Number(raw.reminder_enabled)),
        reminder_delay_hours:   Number(raw.reminder_delay_hours ?? 48),
        auto_expiry_hours:      Number(raw.auto_expiry_hours ?? 168),
      });
    } catch {
      toast.error("Failed to load qualification settings.");
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;

    setSaving(true);
    try {
      await apiClient.put("/securegate/creator-qualification/settings", settings);
      toast.success("Creator qualification settings updated!");
      fetchSettings();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      toast.error(msg || "Failed to save settings.");
    } finally {
      setSaving(false);
    }
  };

  const toggleProvider = (providerId: string) => {
    if (!settings) return;
    const current = settings.enabled_providers;
    const next = current.includes(providerId)
      ? current.filter((p) => p !== providerId)
      : [...current, providerId];
    setSettings({ ...settings, enabled_providers: next });
  };

  // Guard against NaN when a number input is cleared.
  const safeNum = (val: string, fallback = 0) => Number(val) || fallback;

  if (loading || !settings) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <RefreshCwIcon className="h-6 w-6 animate-spin mr-2" /> Loading qualification settings...
      </div>
    );
  }

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-4xl w-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Creator Qualification Settings</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure social follower thresholds, delay rules, enabled platforms, and automated email invitations.
          </p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground font-semibold text-sm rounded-lg hover:opacity-90 transition disabled:opacity-50"
        >
          <SaveIcon className="h-4 w-4" /> {saving ? "Saving..." : "Save Settings"}
        </button>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Master Switch & Follower Rules */}
        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center justify-between border-b pb-4">
            <div className="flex items-center gap-2">
              <SparklesIcon className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Qualification Workflow</h2>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                aria-label="Enable qualification workflow"
                checked={settings.enabled}
                onChange={(e) => setSettings({ ...settings, enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="follower_threshold" className="block text-sm font-medium mb-1">Follower Threshold</label>
              <input
                id="follower_threshold"
                type="number"
                value={settings.follower_threshold}
                onChange={(e) => setSettings({ ...settings, follower_threshold: safeNum(e.target.value) })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                min="0"
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum combined followers to qualify.</p>
            </div>

            <div>
              <label htmlFor="min_connected_accounts" className="block text-sm font-medium mb-1">Min Connected Accounts</label>
              <input
                id="min_connected_accounts"
                type="number"
                value={settings.min_connected_accounts}
                onChange={(e) => setSettings({ ...settings, min_connected_accounts: safeNum(e.target.value, 1) })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                min="1"
              />
              <p className="text-xs text-muted-foreground mt-1">Minimum number of active social profiles.</p>
            </div>

            <div>
              <label htmlFor="delay_amount" className="block text-sm font-medium mb-1">Delay Amount</label>
              <input
                id="delay_amount"
                type="number"
                value={settings.delay_amount}
                onChange={(e) => setSettings({ ...settings, delay_amount: safeNum(e.target.value) })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                min="0"
              />
            </div>

            <div>
              <label htmlFor="delay_unit" className="block text-sm font-medium mb-1">Delay Unit</label>
              <select
                id="delay_unit"
                value={settings.delay_unit}
                onChange={(e) => setSettings({ ...settings, delay_unit: e.target.value })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
              >
                <option value="hours">Hours</option>
                <option value="days">Days</option>
              </select>
            </div>
          </div>
        </div>

        {/* Eligible Platforms */}
        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <SlidersIcon className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Eligible Platforms</h2>
          </div>
          <p className="text-sm text-muted-foreground">Select which social platforms contribute to the combined follower count.</p>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {ALL_PROVIDERS.map((prov) => {
              const active = settings.enabled_providers.includes(prov.id);
              return (
                <button
                  type="button"
                  key={prov.id}
                  onClick={() => toggleProvider(prov.id)}
                  className={`p-3 rounded-lg border text-sm font-medium flex items-center justify-between transition ${
                    active
                      ? "border-primary bg-primary/10 text-primary"
                      : "border-border bg-background text-muted-foreground hover:text-foreground"
                  }`}
                >
                  <span>{prov.label}</span>
                  {active && <CheckCircle2Icon className="h-4 w-4 text-primary" />}
                </button>
              );
            })}
          </div>
        </div>

        {/* Reminder & Expiry Settings */}
        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center gap-2 border-b pb-3">
            <ClockIcon className="h-5 w-5 text-primary" />
            <h2 className="font-semibold text-foreground">Reminder & Expiry</h2>
          </div>

          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Send Reminder Notification</p>
              <p className="text-xs text-muted-foreground">Re-notify users who haven't acted on their qualification.</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                aria-label="Enable reminder notification"
                checked={settings.reminder_enabled}
                onChange={(e) => setSettings({ ...settings, reminder_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="reminder_delay_hours" className="block text-sm font-medium mb-1">Reminder Delay (hours)</label>
              <input
                id="reminder_delay_hours"
                type="number"
                value={settings.reminder_delay_hours}
                onChange={(e) => setSettings({ ...settings, reminder_delay_hours: safeNum(e.target.value, 48) })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                min="1"
                disabled={!settings.reminder_enabled}
              />
              <p className="text-xs text-muted-foreground mt-1">Hours after initial notification to send reminder.</p>
            </div>

            <div>
              <label htmlFor="auto_expiry_hours" className="block text-sm font-medium mb-1">Auto-Expiry (hours)</label>
              <input
                id="auto_expiry_hours"
                type="number"
                value={settings.auto_expiry_hours}
                onChange={(e) => setSettings({ ...settings, auto_expiry_hours: safeNum(e.target.value, 168) })}
                className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
                min="1"
              />
              <p className="text-xs text-muted-foreground mt-1">Hours until a pending event expires without action.</p>
            </div>
          </div>
        </div>

        {/* Email Settings */}
        <div className="p-6 rounded-xl border border-border bg-card space-y-4">
          <div className="flex items-center justify-between border-b pb-3">
            <div className="flex items-center gap-2">
              <MailIcon className="h-5 w-5 text-primary" />
              <h2 className="font-semibold text-foreground">Automated Outreach Email</h2>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                aria-label="Enable automated outreach email"
                checked={settings.email_enabled}
                onChange={(e) => setSettings({ ...settings, email_enabled: e.target.checked })}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>

          <div>
            <label htmlFor="email_subject" className="block text-sm font-medium mb-1">Email Subject</label>
            <input
              id="email_subject"
              type="text"
              value={settings.email_subject}
              onChange={(e) => setSettings({ ...settings, email_subject: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>

          <div>
            <label htmlFor="email_content" className="block text-sm font-medium mb-1">Email Content Body</label>
            <textarea
              id="email_content"
              rows={4}
              value={settings.email_content}
              onChange={(e) => setSettings({ ...settings, email_content: e.target.value })}
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            />
          </div>
        </div>
      </form>
    </div>
  );
}
