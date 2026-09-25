import { useState, useEffect, useCallback } from "react";
import {
  ChatCircleDots,
  Sparkle,
  Moon,
  Clock,
  FloppyDisk,
  Spinner as Loader2,
  CheckCircle,
  Eye,
  Lightning,
  Storefront,
} from "@phosphor-icons/react";
import { Button } from "@/components/ui/button";
import { authFetch } from "@/lib/api/authFetch";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { Link } from "react-router";

const GREETING_PRESETS = [
  {
    label: "Friendly Welcome",
    text: "Hi there! Thanks for reaching out. How can I help you today?",
  },
  {
    label: "Store & Orders",
    text: "Hello! Thanks for visiting my store. Let me know if you have questions about products, shipping, or custom orders.",
  },
  {
    label: "Collabs & Booking",
    text: "Hi! Thanks for contacting me. If you want to collaborate, book a meeting, or enquire about services, please leave the details!",
  },
  {
    label: "Creator Community",
    text: "Welcome to my space! I'm delighted to connect with you. Leave your message and I'll get right back to you.",
  },
];

const AWAY_PRESETS = [
  {
    label: "Standard Away",
    text: "Thanks for your message! I am currently away or outside business hours, but I'll reply as soon as I return.",
  },
  {
    label: "High Volume",
    text: "Hi! I'm currently working through messages and will respond within 24 hours. Thanks for your patience!",
  },
  {
    label: "Focus / Production",
    text: "Hey! I'm currently in the studio recording and creating content. I'll check messages as soon as I wrap up.",
  },
];

export default function AutomatedRepliesPage() {
  const { user } = useAuth();
  const [greetingEnabled, setGreetingEnabled] = useState(false);
  const [greetingMessage, setGreetingMessage] = useState("");
  const [awayEnabled, setAwayEnabled] = useState(false);
  const [awayMessage, setAwayMessage] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const fetchSettings = useCallback(async () => {
    try {
      const res = await authFetch("/settings/chat");
      if (res.ok) {
        const json = await res.json();
        const data = json.data?.data ?? json.data ?? json;
        setGreetingEnabled(Boolean(data.greeting_message_enabled));
        setGreetingMessage(
          data.greeting_message || "Hi there! Thanks for reaching out. How can I help you today?"
        );
        setAwayEnabled(Boolean(data.away_message_enabled));
        setAwayMessage(
          data.away_message || "Thanks for your message! I am currently away, but will reply as soon as possible."
        );
      }
    } catch (err) {
      console.error("Failed to load chat settings", err);
      toast.error("Could not load automated replies settings.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  const handleSave = async () => {
    setSaving(true);
    setSaveSuccess(false);
    try {
      const res = await authFetch("/settings/chat", {
        method: "PUT",
        body: JSON.stringify({
          greeting_message_enabled: greetingEnabled,
          greeting_message: greetingMessage.trim(),
          away_message_enabled: awayEnabled,
          away_message: awayMessage.trim(),
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || "Failed to update automated replies");
      }

      setSaveSuccess(true);
      toast.success("Automated greeting and reply settings saved successfully!");
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
        <Loader2 weight="fill" className="h-8 w-8 animate-spin text-primary" />
        <p className="text-xs font-medium">Loading automated reply settings...</p>
      </div>
    );
  }

  return (
    <div className="w-full max-w-4xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight text-foreground flex items-center gap-2.5">
            <ChatCircleDots weight="fill" className="h-6 w-6 text-primary" />
            Automated Greeting &amp; Replies
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Greet new contacts instantly and automatically reply when you are offline or away.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {greetingEnabled || awayEnabled ? (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
              <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
              Active
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-muted text-muted-foreground">
              <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
              Disabled
            </span>
          )}

          {user?.role === "vendor" || user?.role === "creator" ? (
            <Link
              to="/app/settings/store"
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-muted hover:bg-muted/80 text-foreground transition-colors"
            >
              <Storefront weight="fill" className="h-3.5 w-3.5 text-primary" />
              Store Settings
            </Link>
          ) : null}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Main Settings Form (8 cols) */}
        <div className="lg:col-span-7 space-y-6">
          {/* Card 1: Greeting Message */}
          <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
                  <Sparkle weight="fill" className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Welcome Greeting Message</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sent automatically when someone sends their first message to you.
                  </p>
                </div>
              </div>

              {/* Toggle switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={greetingEnabled}
                  onChange={(e) => setGreetingEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
              </label>
            </div>

            {greetingEnabled && (
              <div className="space-y-3 pt-2 border-t border-border/40 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">Greeting Content</span>
                    <span className="text-muted-foreground">{greetingMessage.length}/1000</span>
                  </div>
                  <textarea
                    rows={4}
                    value={greetingMessage}
                    onChange={(e) => setGreetingMessage(e.target.value.slice(0, 1000))}
                    placeholder="Enter your automated greeting message..."
                    className="w-full rounded-xl border border-border bg-background p-3 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                  />
                </div>

                {/* Preset suggestions */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Quick Templates
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {GREETING_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setGreetingMessage(p.text)}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/40"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Card 2: Away Message */}
          <div className="p-5 rounded-2xl bg-card border border-border/60 shadow-sm space-y-4">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-500 shrink-0">
                  <Moon weight="fill" className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-foreground">Away / Offline Message</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Sent when a user messages you while you are offline or away.
                  </p>
                </div>
              </div>

              {/* Toggle switch */}
              <label className="relative inline-flex items-center cursor-pointer shrink-0">
                <input
                  type="checkbox"
                  checked={awayEnabled}
                  onChange={(e) => setAwayEnabled(e.target.checked)}
                  className="sr-only peer"
                />
                <div className="w-11 h-6 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-amber-500"></div>
              </label>
            </div>

            {awayEnabled && (
              <div className="space-y-3 pt-2 border-t border-border/40 animate-in fade-in duration-200">
                <div className="space-y-1.5">
                  <div className="flex justify-between items-center text-xs">
                    <span className="font-semibold text-foreground">Away Message Content</span>
                    <span className="text-muted-foreground">{awayMessage.length}/1000</span>
                  </div>
                  <textarea
                    rows={4}
                    value={awayMessage}
                    onChange={(e) => setAwayMessage(e.target.value.slice(0, 1000))}
                    placeholder="Enter your away message..."
                    className="w-full rounded-xl border border-border bg-background p-3 text-xs leading-relaxed text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-amber-500/20 resize-none"
                  />
                </div>

                {/* Preset suggestions */}
                <div className="space-y-1.5">
                  <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                    Quick Templates
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {AWAY_PRESETS.map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => setAwayMessage(p.text)}
                        className="text-[11px] font-medium px-2.5 py-1 rounded-lg bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors border border-border/40"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3 pt-2">
            <Button
              onClick={handleSave}
              disabled={saving}
              className="text-xs font-bold gap-2 px-5 py-2.5 bg-primary text-primary-foreground shadow"
            >
              {saving ? (
                <>
                  <Loader2 weight="fill" className="h-4 w-4 animate-spin" /> Saving...
                </>
              ) : saveSuccess ? (
                <>
                  <CheckCircle weight="fill" className="h-4 w-4 text-emerald-400" /> Saved!
                </>
              ) : (
                <>
                  <FloppyDisk weight="fill" className="h-4 w-4" /> Save Changes
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Live Preview Sidebar (5 cols) */}
        <div className="lg:col-span-5 space-y-4">
          <div className="p-4 rounded-2xl bg-card border border-border/60 shadow-sm space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-border/40">
              <span className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <Eye weight="fill" className="h-4 w-4 text-primary" /> Live Chat Preview
              </span>
              <span className="text-[10px] font-semibold text-muted-foreground">What users will see</span>
            </div>

            {/* Chat preview card */}
            <div className="p-3.5 rounded-xl bg-muted/30 border border-border/50 space-y-3">
              {/* User message (inbound) */}
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground p-3 text-xs leading-relaxed shadow-sm">
                  Hi {user?.name?.split(" ")[0] || "there"}, I had a question about your profile!
                  <span className="block text-[9px] text-primary-foreground/70 text-right mt-1">10:42 AM</span>
                </div>
              </div>

              {/* Automated reply bubble */}
              {greetingEnabled && greetingMessage ? (
                <div className="flex justify-start items-start gap-2">
                  <div className="h-7 w-7 rounded-full bg-primary/20 text-primary font-bold flex items-center justify-center text-[10px] shrink-0 overflow-hidden">
                    {user?.avatar_url || user?.avatar ? (
                      <img src={user.avatar_url || user.avatar || ""} alt="" className="h-full w-full object-cover" />
                    ) : (
                      user?.name?.charAt(0) || "U"
                    )}
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-card border border-border p-3 text-xs text-foreground leading-relaxed shadow-sm space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Sparkle weight="fill" className="h-2.5 w-2.5" />
                        Auto Reply
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{greetingMessage}</p>
                    <span className="block text-[9px] text-muted-foreground mt-1">10:42 AM</span>
                  </div>
                </div>
              ) : awayEnabled && awayMessage ? (
                <div className="flex justify-start items-start gap-2">
                  <div className="h-7 w-7 rounded-full bg-amber-500/20 text-amber-500 font-bold flex items-center justify-center text-[10px] shrink-0 overflow-hidden">
                    {user?.avatar_url || user?.avatar ? (
                      <img src={user.avatar_url || user.avatar || ""} alt="" className="h-full w-full object-cover" />
                    ) : (
                      user?.name?.charAt(0) || "U"
                    )}
                  </div>
                  <div className="max-w-[85%] rounded-2xl rounded-bl-sm bg-card border border-border p-3 text-xs text-foreground leading-relaxed shadow-sm space-y-1">
                    <div className="flex items-center gap-1.5">
                      <span className="text-[9px] font-black uppercase tracking-wider bg-amber-500/10 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full inline-flex items-center gap-1">
                        <Moon weight="fill" className="h-2.5 w-2.5" />
                        Away
                      </span>
                    </div>
                    <p className="whitespace-pre-wrap">{awayMessage}</p>
                    <span className="block text-[9px] text-muted-foreground mt-1">10:42 AM</span>
                  </div>
                </div>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground space-y-1">
                  <Lightning weight="fill" className="h-5 w-5 text-muted-foreground mx-auto opacity-50" />
                  <p className="font-semibold">Automated replies are disabled</p>
                  <p className="text-[11px] opacity-75">Toggle Greeting or Away message above to see preview</p>
                </div>
              )}
            </div>

            {/* Explanatory notes */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/10 text-xs text-muted-foreground space-y-1.5">
              <p className="font-semibold text-foreground flex items-center gap-1.5">
                <Clock weight="fill" className="h-3.5 w-3.5 text-primary" /> Delivery Logic
              </p>
              <ul className="list-disc list-inside text-[11px] space-y-1 text-muted-foreground/90">
                <li>Greeting messages are sent once per contact on their first message or after 14 days of inactivity.</li>
                <li>Away messages trigger when you are offline and have not sent an auto-reply in 24 hours.</li>
                <li>Both messages are sent instantly and delivered via real-time WebSocket events.</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
